'use client';
/**
 * Splits data access. Group data belongs to several people, so it is NOT in Dexie and NOT synced by lib/sync.ts: it is read
 * from Supabase on demand (RLS: members only) and written only through security definer RPCs (supabase/schema.sql,
 * "splits"). Nothing here touches the user's own budget.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { SyncError, authedFetch } from './sync';
import { supabaseEnv } from './supabaseClient';
import { roundMoney } from './money';
import type { GroupItem, GroupMember, Settlement } from './split';

export interface GroupRoom {
  id: string;
  name: string;
  currency: string;
  createdBy: string | null;
  createdAt: string;
  linkCode: string;
  closed: boolean;
  expiresAt: string | null;
}

export interface GroupData {
  room: GroupRoom;
  members: GroupMember[];
  items: GroupItem[];
  settlements: (Settlement & { id: string; createdAt: string })[];
}

interface Row { [k: string]: unknown }

/** Plain words from a PostgREST / RPC error ("Sync failed (400) {"message":"shares must add up..."}"). */
export function friendlyError(e: unknown): string {
  if (e instanceof SyncError) {
    if (e.kind === 'offline') return 'You look offline.';
    const m = /"message"\s*:\s*"([^"]+)"/.exec(e.message);
    if (m) return m[1][0].toUpperCase() + m[1].slice(1);
    if (e.kind === 'auth') return 'Please sign in again.';
    if (/\(404\)/.test(e.message)) return 'Splits is not set up on the server yet.';
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}

const json = async <T>(path: string, init: RequestInit = {}): Promise<T> => (await authedFetch(path, init)).json() as Promise<T>;
const rpc = <T>(fn: string, args: Record<string, unknown>) => json<T>(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

export async function loadGroups(): Promise<GroupData[]> {
  const rooms = await json<Row[]>('group_rooms?deleted_at=is.null&select=*&order=created_at.desc');
  if (!rooms.length) return [];
  const inIds = `in.(${rooms.map((r) => r.id).join(',')})`;
  const [members, items, settles] = await Promise.all([
    json<Row[]>(`group_members?group_id=${inIds}&select=group_id,user_id,display_name&order=joined_at.asc`),
    json<Row[]>(`group_transactions?group_id=${inIds}&deleted_at=is.null&select=*&order=created_at.desc`),
    json<Row[]>(`group_settlements?group_id=${inIds}&deleted_at=is.null&select=*&order=created_at.desc`),
  ]);
  return rooms.map((r) => {
    const gid = r.id as string;
    const mem = members.filter((m) => m.group_id === gid).map((m) => ({ id: m.user_id as string, name: (m.display_name as string) || 'Member' }));
    const known = new Set(mem.map((m) => m.id));
    const its = items.filter((i) => i.group_id === gid).map((i): GroupItem => ({
      id: i.id as string,
      total: Number(i.total),
      paidBy: i.paid_by as string,
      shares: Object.fromEntries(Object.entries((i.user_share as Record<string, number>) ?? {}).map(([k, v]) => [k, Number(v)])),
      type: i.item_type as string,
      subtype: (i.item_subtype as string | null) ?? undefined,
      notes: (i.notes as string | null) ?? undefined,
      createdBy: (i.created_by as string) ?? '',
      createdAt: Date.parse(i.created_at as string),
    }));
    // someone who left still appears on old items: keep them out of the member list but nameable
    for (const it of its) for (const id of [it.paidBy, ...Object.keys(it.shares)]) if (!known.has(id)) { known.add(id); mem.push({ id, name: 'Former member' }); }
    return {
      room: {
        id: gid, name: r.name as string, currency: (r.currency as string) ?? 'INR', createdBy: (r.created_by as string | null) ?? null,
        createdAt: r.created_at as string, linkCode: r.link_code as string, closed: !!r.invitation_expired, expiresAt: (r.invite_expires_at as string | null) ?? null,
      },
      members: mem,
      items: its,
      settlements: settles.filter((s) => s.group_id === gid).map((s) => ({
        id: s.id as string, from: s.from_user as string, to: s.to_user as string, amount: Number(s.amount), createdAt: s.created_at as string,
      })),
    };
  });
}

export const createGroup = (name: string, currency: string) => rpc<{ id: string; link_code: string }>('create_group', { p_name: name, p_currency: currency });
export const joinGroup = (code: string) => rpc<string>('join_group', { p_code: code });
export const setInvites = (group: string, open: boolean) => rpc<string>('set_group_invites', { p_group: group, p_open: open });
export const addItem = (a: { group: string; total: number; paidBy: string; type: string; subtype?: string; notes?: string; shares: Record<string, number> }) =>
  rpc<string>('add_group_item', { p_group: a.group, p_total: roundMoney(a.total), p_paid_by: a.paidBy, p_type: a.type, p_subtype: a.subtype ?? null, p_notes: a.notes ?? null, p_shares: a.shares });
export const editItem = (id: string, a: { total: number; paidBy: string; type: string; subtype?: string; notes?: string; shares: Record<string, number> }) =>
  rpc<null>('edit_group_item', { p_id: id, p_total: roundMoney(a.total), p_paid_by: a.paidBy, p_type: a.type, p_subtype: a.subtype ?? null, p_notes: a.notes ?? null, p_shares: a.shares });
export const deleteItem = (id: string) => rpc<null>('delete_group_item', { p_id: id });
export const addSettlement = (group: string, from: string, to: string, amount: number) =>
  rpc<string>('add_group_settlement', { p_group: group, p_from: from, p_to: to, p_amount: roundMoney(amount) });
export const deleteSettlement = (id: string) => rpc<null>('delete_group_settlement', { p_id: id });
export const leaveGroup = (group: string) => rpc<null>('leave_group', { p_group: group });
export const deleteGroup = (group: string) => rpc<null>('delete_group', { p_group: group });

export type InvitePreview = { status: 'open' | 'closed' | 'expired' | 'missing'; name?: string; creator?: string; members?: number };

/** The invite page's look at a group BEFORE the person signs in: anon key only, returns just name / first name / count. */
export async function previewInvite(code: string): Promise<InvitePreview> {
  const env = supabaseEnv();
  if (!env) throw new SyncError('Cloud sync is not configured', 'server');
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/rpc/group_preview`, {
      method: 'POST',
      headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
    });
  } catch {
    throw new SyncError('You are offline', 'offline');
  }
  if (!res.ok) throw new SyncError(`Preview failed (${res.status})`, 'server', res.status);
  return (await res.json()) as InvitePreview;
}

/* ---------- invite link and the code waiting for a sign-in ---------- */
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://www.chelav.app';
export const inviteUrl = (code: string) => `${APP_ORIGIN.replace(/\/$/, '')}/join/?code=${encodeURIComponent(code)}`;
const PENDING_KEY = 'chelav.pendingJoin';
/** A person who joined by link before making a budget lands in Splits alone; this remembers that across a reload. */
const SPLITS_ONLY_KEY = 'chelav.splitsOnly';
export const getSplitsOnly = (): boolean => { try { return localStorage.getItem(SPLITS_ONLY_KEY) === '1'; } catch { return false; } };
export const setSplitsOnlyFlag = (on: boolean) => { try { if (on) localStorage.setItem(SPLITS_ONLY_KEY, '1'); else localStorage.removeItem(SPLITS_ONLY_KEY); } catch { /* ignore */ } };
export const savePendingJoin = (code: string) => { try { localStorage.setItem(PENDING_KEY, code); } catch { /* private mode: the link is opened again */ } };
export const readPendingJoin = (): string | null => { try { return localStorage.getItem(PENDING_KEY); } catch { return null; } };
export const clearPendingJoin = () => { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } };

/* ---------- store: one load shared by the list and the detail ---------- */
interface SplitsState {
  groups: GroupData[] | null;
  loading: boolean;
  error: string | null;
  /** The group to open when the Splits tab next shows (after joining by link or creating one). */
  focusId: string | null;
  setFocus: (id: string | null) => void;
  refresh: () => Promise<void>;
  clear: () => void;
}
let inflight: Promise<void> | null = null;
export const useSplitsStore = create<SplitsState>((set) => ({
  groups: null,
  loading: false,
  error: null,
  focusId: null,
  setFocus: (focusId) => set({ focusId }),
  refresh: () => {
    if (inflight) return inflight;
    set({ loading: true });
    inflight = loadGroups()
      .then((groups) => set({ groups, error: null, loading: false }))
      .catch((e) => set({ error: friendlyError(e), loading: false }))
      .finally(() => { inflight = null; });
    return inflight;
  },
  clear: () => set({ groups: null, error: null, loading: false, focusId: null }),
}));

/** Loads when mounted and again when the app comes back to the foreground. */
export function useSplits(enabled: boolean) {
  const st = useSplitsStore();
  useEffect(() => {
    if (!enabled) return;
    void st.refresh();
    const on = () => document.visibilityState === 'visible' && void useSplitsStore.getState().refresh();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return st;
}

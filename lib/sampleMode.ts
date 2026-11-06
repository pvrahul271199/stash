'use client';
import Dexie from 'dexie';
import { GUEST_UID, SAMPLE_UID, dbNameFor, openUserDB, useActiveUid } from '@/db/schema';
import { fillSample } from '@/db/queries';
import { getAuth } from './auth';

/**
 * "Explore with sample data". The sample lives in its own throwaway database (`stash-sample`), so:
 *  - it really is in a database and the whole app works on it (Today, History, Insights, ...);
 *  - anything the visitor logs lands in that sandbox only: it is rebuilt from scratch on every visit and dropped when they
 *    exit, so nothing they type in sample mode is kept;
 *  - a real guest's data is never touched (it used to be tombstoned by the old sample fill) and sample data is never
 *    claimed into an account or synced (guests do not sync).
 * Sample mode lasts for the browser tab's session (sessionStorage): a reload keeps you in it (with fresh sample data), closing
 * the tab drops you back at the welcome screen.
 */
const FLAG = 'stash:sample-mode';

function flagSet(): boolean {
  try {
    return window.sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}
function setFlag(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(FLAG, '1');
    else window.sessionStorage.removeItem(FLAG);
  } catch {
    /* without sessionStorage a reload simply leaves sample mode */
  }
}

/** True while the sample sandbox is the open database. */
export function useSampleMode(): boolean {
  return useActiveUid() === SAMPLE_UID;
}

async function dropSandbox() {
  try {
    await Dexie.delete(dbNameFor(SAMPLE_UID));
  } catch {
    /* best effort: it is rebuilt on the next visit anyway */
  }
}

let filling = false;
/** True while the sandbox is being built: it is open but still empty, which must not be mistaken for "the visitor emptied it". */
export function isSampleFilling(): boolean {
  return filling;
}

/** Opens a fresh sandbox full of two months of dummy data. A signed-in account never goes through here. */
export async function enterSampleMode(now: Date = new Date()): Promise<void> {
  if (getAuth().uid) throw new Error('Sample mode is for guests');
  filling = true;
  try {
    await openUserDB(GUEST_UID); // releases the sandbox handle if it was open
    await dropSandbox();
    await openUserDB(SAMPLE_UID);
    await fillSample(now);
    setFlag(true);
  } finally {
    filling = false;
  }
}

/** Leaves sample mode: back to the guest database, sandbox deleted (including anything logged in it). */
export async function exitSampleMode(): Promise<void> {
  setFlag(false);
  await openUserDB(GUEST_UID);
  await dropSandbox();
}

/** At app start: a reload inside sample mode rebuilds the sandbox. Returns true when it did. */
export async function resumeSampleMode(): Promise<boolean> {
  if (!flagSet()) return false;
  if (getAuth().uid) {
    setFlag(false); // signed in since: the flag is stale
    await dropSandbox();
    return false;
  }
  await enterSampleMode();
  return true;
}

/** Called once an account is signed in: the sample is not wanted any more. */
export async function discardSampleAfterSignIn(): Promise<void> {
  setFlag(false);
  await dropSandbox();
}

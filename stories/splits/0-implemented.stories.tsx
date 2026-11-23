import type { Meta } from '@storybook/react-vite';
import { AddItemScreen } from '@/components/splits/AddItemScreen';
import { GroupScreen } from '@/components/splits/GroupScreen';
import { InviteTicket } from '@/components/splits/InviteTicket';
import { NewGroupSheet } from '@/components/splits/NewGroupSheet';
import type { GroupData } from '@/lib/groups';
import { GROUPS, PEOPLE, Phone } from './kit';

/**
 * The REAL Splits components (components/splits/*) fed with mock data, so what is built can be seen next to the
 * redesign options. Buttons that talk to the server do nothing here (no Supabase in Storybook).
 */
const meta: Meta = { title: 'Splits / 0. As built', parameters: { layout: 'centered' } };
export default meta;

const data = (i: number): GroupData => {
  const g = GROUPS[i];
  return {
    room: { id: g.id, name: g.name, currency: i === 1 ? 'USD' : 'INR', createdBy: g.createdBy, createdAt: '2026-11-12T00:00:00Z', linkCode: 'G0A7R1P', closed: false, expiresAt: null },
    members: PEOPLE.filter((p) => g.members.includes(p.id)),
    items: g.items.map((it, n) => ({ ...it, createdAt: Date.now() - n * 86400000 })),
    settlements: g.settlements.map((s, n) => ({ ...s, id: `s${n}`, createdAt: new Date().toISOString() })),
  };
};
const noop = () => {};

export const Group_Goa = () => <Phone><GroupScreen data={data(0)} me="u1" onBack={noop} /></Phone>;
export const Group_Flat_USD = () => <Phone><GroupScreen data={data(1)} me="u1" onBack={noop} /></Phone>;
export const Group_Settled = () => <Phone><GroupScreen data={data(2)} me="u1" onBack={noop} /></Phone>;
export const AddItem = () => <Phone><AddItemScreen data={data(0)} me="u1" onClose={noop} /></Phone>;
export const NewGroup = () => <Phone><NewGroupSheet onClose={noop} onCreated={noop} /></Phone>;
export const Invite_Goa = () => <Phone><InviteTicket data={data(0)} me="u1" onClose={noop} /></Phone>;
export const Invite_Flat = () => <Phone><InviteTicket data={data(1)} me="u1" onClose={noop} /></Phone>;

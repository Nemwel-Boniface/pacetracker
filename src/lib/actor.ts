import { headers } from 'next/headers';
import { getAdminSession, getMemberSession } from './auth';
import { ADMIN_MEMBER_ID, ensureAdminMember } from './data';

export const ADMIN_ACTOR_HEADER = 'x-pt-actor';

export interface Actor { memberId: string; isAdmin: boolean; }

// Who is making a member-scoped request. Admin pages send `x-pt-actor: admin` so the admin acts as
// their seeded member record (pt-admin-member) — explicit, so a browser holding both a member and an
// admin cookie never gets the wrong identity.
export async function getActor(): Promise<Actor | null> {
  const h = await headers();
  if (h.get(ADMIN_ACTOR_HEADER) === 'admin') {
    if (!await getAdminSession()) return null;
    await ensureAdminMember();
    return { memberId: ADMIN_MEMBER_ID, isAdmin: true };
  }
  const session = await getMemberSession();
  return session ? { memberId: session.memberId, isAdmin: false } : null;
}

// For public pages (main page card, chatbot) that can't send the admin header: whoever is signed in,
// preferring the member session so a member's own view always wins over a leftover admin cookie.
export async function getViewer(): Promise<Actor | null> {
  const session = await getMemberSession();
  if (session) return { memberId: session.memberId, isAdmin: false };
  if (!await getAdminSession()) return null;
  await ensureAdminMember();
  return { memberId: ADMIN_MEMBER_ID, isAdmin: true };
}

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllMembers, getAllActivities, getAllChallenges, getChallengeParticipants } from '@/lib/data';

// Sign-ups, challenge joiners and logging consistency for the admin dashboard. Read-only, computed from
// existing records: windows are rolling 7-day blocks ending today (UTC), matching activity dates.
function shiftDay(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T12:00:00Z').getTime() - new Date(from + 'T12:00:00Z').getTime()) / 86400000);
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = shiftDay(today, -6);      // this week = the last 7 days including today
    const prevStart = shiftDay(today, -13);     // the 7 days before that
    const inWeek = (d: string) => d >= weekStart && d <= today;
    const inPrev = (d: string) => d >= prevStart && d < weekStart;

    // Test identities (shadow account, *.test QA members) are left out of every number.
    const [allMembers, activities, challenges] = await Promise.all([getAllMembers(), getAllActivities(), getAllChallenges()]);
    const members = allMembers.filter(m => !m.isShadowUser && !m.email?.toLowerCase().endsWith('.test'));
    const memberIds = new Set(members.map(m => m.id));

    const signupsThisWeek = members.filter(m => inWeek(m.joinedAt.slice(0, 10)))
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
      .map(m => ({ id: m.id, name: m.name, date: m.joinedAt.slice(0, 10), pendingInvite: !!(m.isInvited && !m.inviteAccepted) }));
    const signupsPrevWeek = members.filter(m => inPrev(m.joinedAt.slice(0, 10))).length;
    const pendingInvites = members.filter(m => m.isInvited && !m.inviteAccepted).length;

    const daysByMember = new Map<string, Set<string>>();
    for (const a of activities) {
      if (!memberIds.has(a.memberId)) continue;
      if (!daysByMember.has(a.memberId)) daysByMember.set(a.memberId, new Set());
      daysByMember.get(a.memberId)!.add(a.date);
    }
    const daysIn = (days: Set<string>, from: string, to: string) => [...days].filter(d => d >= from && d <= to).length;

    const active = members.filter(m => m.isActive && !(m.isInvited && !m.inviteAccepted));
    let loggedThisWeek = 0, loggedPrevWeek = 0, regulars = 0, fourWeeks = 0;
    const goneQuiet: { id: string; name: string; lastDate: string; daysQuiet: number }[] = [];
    const neverLogged: { id: string; name: string; joined: string }[] = [];
    for (const m of active) {
      const days = daysByMember.get(m.id);
      if (!days || days.size === 0) { neverLogged.push({ id: m.id, name: m.name, joined: m.joinedAt.slice(0, 10) }); continue; }
      const thisWeek = daysIn(days, weekStart, today);
      if (thisWeek > 0) loggedThisWeek++;
      if (daysIn(days, prevStart, shiftDay(weekStart, -1)) > 0) loggedPrevWeek++;
      if (thisWeek >= 3) regulars++;
      if ([0, 1, 2, 3].every(w => daysIn(days, shiftDay(today, -7 * w - 6), shiftDay(today, -7 * w)) > 0)) fourWeeks++;
      const lastDate = [...days].sort().pop()!;
      const daysQuiet = daysBetween(lastDate, today);
      if (daysQuiet >= 7) goneQuiet.push({ id: m.id, name: m.name, lastDate, daysQuiet });
    }
    goneQuiet.sort((a, b) => a.daysQuiet - b.daysQuiet);
    neverLogged.sort((a, b) => b.joined.localeCompare(a.joined));

    const running = challenges.filter(c => c.kind !== 'trivia' && c.status !== 'cancelled' && c.endDate && c.endDate >= today);
    const challengeJoins = (await Promise.all(running.map(async c => {
      const accepted = (await getChallengeParticipants(c.id)).filter(p => p.status === 'accepted' && memberIds.has(p.memberId));
      const recent = accepted.filter(p => inWeek((p.respondedAt ?? p.invitedAt).slice(0, 10)))
        .sort((a, b) => (b.respondedAt ?? b.invitedAt).localeCompare(a.respondedAt ?? a.invitedAt));
      return { id: c.id, title: c.title, featured: c.featureStatus === 'featured', total: accepted.length, newThisWeek: recent.length, newNames: recent.map(p => p.memberName) };
    }))).filter(c => c.total > 0).sort((a, b) => b.newThisWeek - a.newThisWeek || b.total - a.total);

    return NextResponse.json({
      window: { weekStart, today },
      signups: { thisWeek: signupsThisWeek, prevWeek: signupsPrevWeek, pendingInvites, totalMembers: members.length },
      consistency: { activeMembers: active.length, loggedThisWeek, loggedPrevWeek, regulars, fourWeeks },
      goneQuiet, neverLogged, challengeJoins,
    });
  } catch { return NextResponse.json({ error: 'Failed to compute engagement' }, { status: 500 }); }
}

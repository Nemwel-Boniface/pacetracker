import { getRedis, KEYS } from './redis';
import { Member, ActivityLog, MemberStats, PrizeCategory, Winner, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS, getTier } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function getAllMembers(): Promise<Member[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.members);
  if (!ids?.length) return [];
  const members = await Promise.all(ids.map(id => r.get<Member>(KEYS.member(id))));
  return members.filter(Boolean) as Member[];
}
export async function getMember(id: string): Promise<Member | null> { return getRedis().get<Member>(KEYS.member(id)); }
export async function saveMember(m: Member): Promise<void> { const r = getRedis(); await r.set(KEYS.member(m.id), m); await r.sadd(KEYS.members, m.id); }
export async function deleteMember(id: string): Promise<void> { const r = getRedis(); await r.del(KEYS.member(id)); await r.srem(KEYS.members, id); }
export async function toggleMemberActive(id: string): Promise<Member | null> {
  const m = await getMember(id); if (!m) return null; m.isActive = !m.isActive; await saveMember(m); return m;
}

export async function logActivity(a: ActivityLog): Promise<void> {
  const r = getRedis();
  await r.set(KEYS.activity(a.id), a);
  await r.sadd(KEYS.activities, a.id);
  await r.sadd(KEYS.memberActivities(a.memberId), a.id);
  await r.sadd(KEYS.dailyActivities(a.date), a.id);
}
export async function deleteActivity(id: string): Promise<void> {
  const r = getRedis(); const a = await r.get<ActivityLog>(KEYS.activity(id)); if (!a) return;
  await r.del(KEYS.activity(id)); await r.srem(KEYS.activities, id);
  await r.srem(KEYS.memberActivities(a.memberId), id); await r.srem(KEYS.dailyActivities(a.date), id);
}
export async function getActivitiesForDate(date: string): Promise<ActivityLog[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.dailyActivities(date));
  if (!ids?.length) return [];
  const acts = await Promise.all(ids.map(id => r.get<ActivityLog>(KEYS.activity(id))));
  return (acts.filter(Boolean) as ActivityLog[]).sort((a,b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
}
export async function getMemberActivities(memberId: string): Promise<ActivityLog[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.memberActivities(memberId));
  if (!ids?.length) return [];
  const acts = await Promise.all(ids.map(id => r.get<ActivityLog>(KEYS.activity(id))));
  return (acts.filter(Boolean) as ActivityLog[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
export async function getAllActivities(): Promise<ActivityLog[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.activities);
  if (!ids?.length) return [];
  const acts = await Promise.all(ids.map(id => r.get<ActivityLog>(KEYS.activity(id))));
  return (acts.filter(Boolean) as ActivityLog[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function computeMemberStats(memberId: string): Promise<MemberStats | null> {
  const member = await getMember(memberId); if (!member) return null;
  const activities = await getMemberActivities(memberId);
  let totalPoints = 0, runSessions = 0, lunchActivities = 0, raceSignups = 0, racesCompleted = 0;
  const activeDates = new Set<string>();
  for (const act of activities) {
    totalPoints += act.points; activeDates.add(act.date);
    if (act.category === 'run_session') runSessions++;
    if (act.category === 'lunch_time_activity') lunchActivities++;
    if (act.category === 'race_signup') raceSignups++;
    if (act.category === 'race_complete') racesCompleted++;
  }
  const sortedDates = [...activeDates].sort().reverse();
  return { memberId, memberName: member.name, country: member.country, totalPoints, tier: getTier(totalPoints), runSessions, lunchActivities, raceSignups, racesCompleted, activeDays: activeDates.size, lastActive: sortedDates[0], isActive: member.isActive };
}
export async function getAllMemberStats(): Promise<MemberStats[]> {
  const members = await getAllMembers(); if (!members.length) return [];
  const stats = await Promise.all(members.map(m => computeMemberStats(m.id)));
  return (stats.filter(Boolean) as MemberStats[]).sort((a,b) => b.totalPoints - a.totalPoints);
}

export async function getAllPrizes(): Promise<PrizeCategory[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.prizes);
  if (!ids?.length) return [];
  const prizes = await Promise.all(ids.map(id => r.get<PrizeCategory>(KEYS.prize(id))));
  return (prizes.filter(Boolean) as PrizeCategory[]).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export async function savePrize(p: PrizeCategory): Promise<void> { const r = getRedis(); await r.set(KEYS.prize(p.id), p); await r.sadd(KEYS.prizes, p.id); }
export async function deletePrize(id: string): Promise<void> { const r = getRedis(); await r.del(KEYS.prize(id)); await r.srem(KEYS.prizes, id); }

export async function getAllWinners(): Promise<Winner[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.winners);
  if (!ids?.length) return [];
  const winners = await Promise.all(ids.map(id => r.get<Winner>(KEYS.winner(id))));
  return winners.filter(Boolean) as Winner[];
}
export async function saveWinner(w: Winner): Promise<void> { const r = getRedis(); await r.set(KEYS.winner(w.id), w); await r.sadd(KEYS.winners, w.id); }
export async function deleteWinner(id: string): Promise<void> { const r = getRedis(); await r.del(KEYS.winner(id)); await r.srem(KEYS.winners, id); }
export async function getVisibleWinners(): Promise<Winner[]> { return (await getAllWinners()).filter(w => w.isVisible); }
export async function getVisiblePrizes(): Promise<PrizeCategory[]> { return (await getAllPrizes()).filter(p => p.isVisible); }
import { getRedis, KEYS } from './redis';
import { Member, ActivityLog, MemberStats, PrizeCategory, Winner, CountryConfig, Feedback, DEFAULT_COUNTRIES, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS, getTier } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// ─── Members ────────────────────────────────────────────────────────────────
export const ADMIN_MEMBER_ID = 'pt-admin-member';
export const SHADOW_MEMBER_ID = 'pt-shadow-member';
export const SHADOW_MEMBER_EMAIL = process.env.SHADOW_MEMBER_EMAIL || 'shadow@pacetracker.test';
const SHADOW_MEMBER_PASSWORD = process.env.SHADOW_MEMBER_PASSWORD || 'Move2026test!';

const ADMIN_MEMBER_SEED: Member = {
  id: ADMIN_MEMBER_ID,
  name: 'Nemwel Boniface',
  email: 'n.nyandoro@edencaremedical.com',
  country: 'Kenya',
  isActive: true,
  joinedAt: '2024-01-01T00:00:00.000Z',
  avatarInitials: 'NB',
  isAdminMember: true,
};

async function ensureAdminMember(): Promise<void> {
  const r = getRedis();
  const exists = await r.sismember(KEYS.members, ADMIN_MEMBER_ID);
  if (!exists) await saveMember(ADMIN_MEMBER_SEED);
}

async function ensureShadowMember(): Promise<void> {
  const r = getRedis();
  const exists = await r.sismember(KEYS.members, SHADOW_MEMBER_ID);
  if (!exists) {
    const passwordHash = await bcrypt.hash(SHADOW_MEMBER_PASSWORD, 10);
    const shadow: Member = {
      id: SHADOW_MEMBER_ID,
      name: 'Test User',
      email: SHADOW_MEMBER_EMAIL,
      country: 'Kenya',
      isActive: true,
      joinedAt: '2024-01-01T00:00:00.000Z',
      avatarInitials: 'TU',
      isShadowUser: true,
      passwordHash,
    };
    await saveMember(shadow);
    await setEmailIndex(SHADOW_MEMBER_EMAIL, SHADOW_MEMBER_ID);
  }
}

export async function getAllMembers(): Promise<Member[]> {
  await ensureAdminMember();
  await ensureShadowMember();
  const r = getRedis(); const ids = await r.smembers(KEYS.members);
  if (!ids?.length) return [];
  const members = await Promise.all(ids.map(id => r.get<Member>(KEYS.member(id))));
  return members.filter(Boolean) as Member[];
}
export async function getMember(id: string): Promise<Member | null> { return getRedis().get<Member>(KEYS.member(id)); }
export async function saveMember(m: Member): Promise<void> { const r = getRedis(); await r.set(KEYS.member(m.id), m); await r.sadd(KEYS.members, m.id); }
export async function deleteMember(id: string): Promise<void> {
  if (id === ADMIN_MEMBER_ID || id === SHADOW_MEMBER_ID) return;
  const r = getRedis();
  const m = await getMember(id);
  if (m?.email) await r.hdel(KEYS.emailIndex, m.email.toLowerCase());
  await r.del(KEYS.member(id)); await r.srem(KEYS.members, id);
}
export async function toggleMemberActive(id: string): Promise<Member | null> {
  const m = await getMember(id); if (!m) return null; m.isActive = !m.isActive; await saveMember(m); return m;
}
export function sanitizeMember(m: Member): Omit<Member, 'passwordHash'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = m; return safe;
}

// ─── Email index ─────────────────────────────────────────────────────────────
export async function getMemberIdByEmail(email: string): Promise<string | null> {
  return getRedis().hget<string>(KEYS.emailIndex, email.toLowerCase());
}
export async function setEmailIndex(email: string, memberId: string): Promise<void> {
  await getRedis().hset(KEYS.emailIndex, { [email.toLowerCase()]: memberId });
}

// ─── Activities ──────────────────────────────────────────────────────────────
export async function logActivity(a: ActivityLog): Promise<void> {
  const r = getRedis();
  await r.set(KEYS.activity(a.id), a);
  await r.sadd(KEYS.activities, a.id);
  await r.sadd(KEYS.memberActivities(a.memberId), a.id);
  await r.sadd(KEYS.dailyActivities(a.date), a.id);
}
export async function updateActivity(a: ActivityLog): Promise<void> {
  await getRedis().set(KEYS.activity(a.id), a);
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
export async function getMemberActivitiesForDate(memberId: string, date: string): Promise<ActivityLog[]> {
  const all = await getActivitiesForDate(date);
  return all.filter(a => a.memberId === memberId);
}
export async function getAllActivities(): Promise<ActivityLog[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.activities);
  if (!ids?.length) return [];
  const acts = await Promise.all(ids.map(id => r.get<ActivityLog>(KEYS.activity(id))));
  return (acts.filter(Boolean) as ActivityLog[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Stats ───────────────────────────────────────────────────────────────────
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
  const visible = members.filter(m => !m.isShadowUser);
  const stats = await Promise.all(visible.map(m => computeMemberStats(m.id)));
  return (stats.filter(Boolean) as MemberStats[]).sort((a,b) => b.totalPoints - a.totalPoints);
}

// ─── Prizes ──────────────────────────────────────────────────────────────────
export async function getAllPrizes(): Promise<PrizeCategory[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.prizes);
  if (!ids?.length) return [];
  const prizes = await Promise.all(ids.map(id => r.get<PrizeCategory>(KEYS.prize(id))));
  return (prizes.filter(Boolean) as PrizeCategory[]).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export async function savePrize(p: PrizeCategory): Promise<void> { const r = getRedis(); await r.set(KEYS.prize(p.id), p); await r.sadd(KEYS.prizes, p.id); }
export async function deletePrize(id: string): Promise<void> { const r = getRedis(); await r.del(KEYS.prize(id)); await r.srem(KEYS.prizes, id); }

// ─── Winners ─────────────────────────────────────────────────────────────────
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

// ─── Countries ───────────────────────────────────────────────────────────────
function countrySlug(name: string): string { return name.toLowerCase().replace(/\s+/g, '_'); }

async function seedDefaultCountries(): Promise<void> {
  for (const c of DEFAULT_COUNTRIES) { await saveCountry(c); }
}

export async function getAllCountries(): Promise<CountryConfig[]> {
  const r = getRedis();
  const slugs = await r.smembers(KEYS.countries);
  if (!slugs?.length) { await seedDefaultCountries(); return [...DEFAULT_COUNTRIES].sort((a,b) => a.name.localeCompare(b.name)); }
  const configs = await Promise.all(slugs.map(slug => r.get<CountryConfig>(KEYS.country(slug))));
  return (configs.filter(Boolean) as CountryConfig[]).sort((a,b) => a.name.localeCompare(b.name));
}

export async function getActiveCountries(): Promise<CountryConfig[]> {
  return (await getAllCountries()).filter(c => c.isActive);
}

export async function saveCountry(c: CountryConfig): Promise<void> {
  const r = getRedis(); const slug = countrySlug(c.name);
  await r.set(KEYS.country(slug), c); await r.sadd(KEYS.countries, slug);
}

export async function toggleCountry(name: string): Promise<CountryConfig | null> {
  const slug = countrySlug(name);
  const c = await getRedis().get<CountryConfig>(KEYS.country(slug));
  if (!c) return null; c.isActive = !c.isActive; await saveCountry(c); return c;
}

export async function deleteCountry(name: string): Promise<void> {
  const r = getRedis(); const slug = countrySlug(name);
  await r.del(KEYS.country(slug)); await r.srem(KEYS.countries, slug);
}

// ─── Feedback ────────────────────────────────────────────────────────────────
export async function getAllFeedback(): Promise<Feedback[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.feedback);
  if (!ids?.length) return [];
  const items = await Promise.all(ids.map(id => r.get<Feedback>(KEYS.feedbackItem(id))));
  return (items.filter(Boolean) as Feedback[]).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
export async function getMemberFeedback(memberId: string): Promise<Feedback[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.memberFeedback(memberId));
  if (!ids?.length) return [];
  const items = await Promise.all(ids.map(id => r.get<Feedback>(KEYS.feedbackItem(id))));
  return (items.filter(Boolean) as Feedback[]).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
export async function saveFeedback(fb: Feedback): Promise<void> {
  const r = getRedis();
  await Promise.all([r.set(KEYS.feedbackItem(fb.id), fb), r.sadd(KEYS.feedback, fb.id), r.sadd(KEYS.memberFeedback(fb.memberId), fb.id)]);
}
export async function updateFeedback(id: string, patch: Partial<Feedback>): Promise<Feedback | null> {
  const r = getRedis(); const fb = await r.get<Feedback>(KEYS.feedbackItem(id));
  if (!fb) return null;
  const updated = { ...fb, ...patch };
  await r.set(KEYS.feedbackItem(id), updated);
  return updated;
}

// Re-export for convenience
export { uuidv4, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS };

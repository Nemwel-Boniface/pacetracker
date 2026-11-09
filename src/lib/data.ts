import { getRedis, KEYS } from './redis';
import { Member, ActivityLog, MemberStats, PrizeCategory, Winner, CountryConfig, Feedback, DEFAULT_COUNTRIES, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS, getTier, Challenge, ChallengeParticipant, ChallengeLeaderboardEntry, ChallengeMemberStats, ChallengePace, ActivityType, getChallengeDisplayStatus, CHALLENGE_CATEGORY_ACTIVITY_TYPES, challengeLengthDays, AppSettings, DEFAULT_APP_SETTINGS, MAX_CO_FACILITATORS } from '@/types';
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

export async function ensureAdminMember(): Promise<void> {
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
export async function getActivity(id: string): Promise<ActivityLog | null> {
  return getRedis().get<ActivityLog>(KEYS.activity(id));
}
export async function logActivity(a: ActivityLog): Promise<void> {
  const r = getRedis();
  await r.set(KEYS.activity(a.id), a);
  await r.sadd(KEYS.activities, a.id);
  await r.sadd(KEYS.memberActivities(a.memberId), a.id);
  await r.sadd(KEYS.dailyActivities(a.date), a.id);
  if (a.isTeamActivity && a.teamActivityId) {
    await r.sadd(KEYS.groupActivityLogs(a.teamActivityId), a.id);
  }
}
export async function updateActivity(a: ActivityLog): Promise<void> {
  await getRedis().set(KEYS.activity(a.id), a);
}
export async function deleteActivity(id: string): Promise<void> {
  const r = getRedis();
  const a = await r.get<ActivityLog>(KEYS.activity(id));
  if (!a) return;
  await r.del(KEYS.activity(id));
  await r.srem(KEYS.activities, id);
  await r.srem(KEYS.memberActivities(a.memberId), id);
  await r.srem(KEYS.dailyActivities(a.date), id);
  // Cascade: delete all team auto-logs when a group activity (owner) is deleted
  if (a.teamMembers && a.teamMembers.length > 0) {
    const autoLogIds = await r.smembers(KEYS.groupActivityLogs(id));
    if (autoLogIds?.length) {
      await Promise.all(autoLogIds.map(async (autoId) => {
        const autoLog = await r.get<ActivityLog>(KEYS.activity(autoId));
        if (!autoLog) return;
        await r.del(KEYS.activity(autoId));
        await r.srem(KEYS.activities, autoId);
        await r.srem(KEYS.memberActivities(autoLog.memberId), autoId);
        await r.srem(KEYS.dailyActivities(autoLog.date), autoId);
      }));
    }
    await r.del(KEYS.groupActivityLogs(id));
  }
  // If this IS a team auto-log, remove it from the parent index
  if (a.isTeamActivity && a.teamActivityId) {
    await r.srem(KEYS.groupActivityLogs(a.teamActivityId), id);
  }
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
  const visible = members.filter(m => !m.isShadowUser && !(m.isInvited && !m.inviteAccepted));
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

// ─── Challenges ──────────────────────────────────────────────────────────────
export async function getChallenge(id: string): Promise<Challenge | null> {
  return getRedis().get<Challenge>(KEYS.challenge(id));
}
export async function saveChallenge(c: Challenge): Promise<void> {
  const r = getRedis();
  await Promise.all([
    r.set(KEYS.challenge(c.id), c),
    r.sadd(KEYS.challenges, c.id),
    r.sadd(KEYS.memberChallenges(c.ownerId), c.id),
  ]);
}
export async function getAllChallenges(): Promise<Challenge[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.challenges);
  if (!ids?.length) return [];
  const items = await Promise.all(ids.map(id => r.get<Challenge>(KEYS.challenge(id))));
  return (items.filter(Boolean) as Challenge[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getMemberChallenges(memberId: string): Promise<Challenge[]> {
  const r = getRedis(); const ids = await r.smembers(KEYS.memberChallenges(memberId));
  if (!ids?.length) return [];
  const items = await Promise.all(ids.map(id => r.get<Challenge>(KEYS.challenge(id))));
  return (items.filter(Boolean) as Challenge[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getChallengeParticipant(challengeId: string, memberId: string): Promise<ChallengeParticipant | null> {
  return getRedis().get<ChallengeParticipant>(KEYS.challengeParticipant(challengeId, memberId));
}
export async function saveChallengeParticipant(p: ChallengeParticipant): Promise<void> {
  const r = getRedis();
  await Promise.all([
    r.set(KEYS.challengeParticipant(p.challengeId, p.memberId), p),
    r.sadd(KEYS.challengeParticipants(p.challengeId), p.memberId),
    r.sadd(KEYS.memberChallenges(p.memberId), p.challengeId),
  ]);
}
export async function getChallengeParticipants(challengeId: string): Promise<ChallengeParticipant[]> {
  const r = getRedis(); const memberIds = await r.smembers(KEYS.challengeParticipants(challengeId));
  if (!memberIds?.length) return [];
  const items = await Promise.all(memberIds.map(id => r.get<ChallengeParticipant>(KEYS.challengeParticipant(challengeId, id))));
  return items.filter(Boolean) as ChallengeParticipant[];
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00Z').getTime();
  const db = new Date(b + 'T12:00:00Z').getTime();
  return Math.round((db - da) / 86400000);
}

// These assume a distance-goal Challenge (kind !== 'trivia') — every call site guards on
// kind before reaching here, so the non-null assertions below are safe in practice.
export function activityCountsForChallenge(challenge: Challenge, a: ActivityLog): boolean {
  const types = CHALLENGE_CATEGORY_ACTIVITY_TYPES[challenge.category!];
  if (!types.includes(a.activityType) || a.date < challenge.startDate! || a.date > challenge.endDate! || !a.distance) return false;
  return !challenge.taggedOnly || (a.challengeIds ?? []).includes(challenge.id);
}

export async function computeChallengeStats(challenge: Challenge, memberId: string): Promise<ChallengeMemberStats> {
  const counted = (await getMemberActivities(memberId)).filter(a => activityCountsForChallenge(challenge, a));
  const km = counted.reduce((sum, a) => sum + (a.distance ?? 0), 0);
  return {
    km: Math.round(km * 10) / 10,
    points: counted.reduce((sum, a) => sum + a.points, 0),
    activityCount: counted.length,
    groupActivityCount: counted.filter(a => a.isTeamActivity || (a.teamMembers?.length ?? 0) > 0).length,
  };
}

export async function computeChallengeProgress(challenge: Challenge, memberId: string): Promise<number> {
  return (await computeChallengeStats(challenge, memberId)).km;
}

export function computeChallengePace(challenge: Challenge, progressKm: number): ChallengePace {
  const periodDays = challengeLengthDays(challenge.startDate!, challenge.endDate!);
  const today = new Date().toISOString().slice(0, 10);
  const percentageSoFar = Math.min(100, Math.round((progressKm / challenge.goalKm!) * 100));
  // Not started yet — nobody can be behind a pace that hasn't begun.
  if (today < challenge.startDate!) return { percentage: percentageSoFar, expectedKm: 0, onPace: true, daysElapsed: 0, daysRemaining: periodDays, periodDays };
  const endDate = challenge.endDate!;
  const clampedToday = today < endDate ? today : endDate;
  const daysElapsed = Math.min(periodDays, Math.max(1, daysBetween(challenge.startDate!, clampedToday) + 1));
  const expectedKm = Math.round(challenge.goalKm! * (daysElapsed / periodDays) * 10) / 10;
  const percentage = Math.min(100, Math.round((progressKm / challenge.goalKm!) * 100));
  return { percentage, expectedKm, onPace: progressKm >= expectedKm, daysElapsed, daysRemaining: Math.max(0, periodDays - daysElapsed), periodDays };
}

export async function getChallengeLeaderboard(challenge: Challenge): Promise<ChallengeLeaderboardEntry[]> {
  const participants = (await getChallengeParticipants(challenge.id)).filter(p => p.status === 'accepted');
  const entries = await Promise.all(participants.map(async p => {
    const { km: progressKm, points, activityCount, groupActivityCount } = await computeChallengeStats(challenge, p.memberId);
    const percentage = Math.min(100, Math.round((progressKm / challenge.goalKm!) * 100));
    return { memberId: p.memberId, memberName: p.memberName, progressKm, percentage, rank: 0, points, activityCount, groupActivityCount };
  }));
  // Distance decides the rank — one 15km outing beats three 4km ones. Points only break ties.
  entries.sort((a, b) => b.progressKm - a.progressKm || b.points - a.points);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

// Active distance challenges the member has joined that an activity on `date` could be tagged with.
export async function getLoggableChallenges(memberId: string, date: string): Promise<Challenge[]> {
  const challenges = await getMemberChallenges(memberId);
  const eligible = await Promise.all(challenges.map(async c => {
    if (c.kind === 'trivia' || c.status === 'cancelled' || date < c.startDate! || date > c.endDate!) return null;
    const p = await getChallengeParticipant(c.id, memberId);
    return p?.status === 'accepted' ? c : null;
  }));
  return eligible.filter(Boolean) as Challenge[];
}

// Validates the challenges a logger picked for their own activity. Returns an error message for the
// first problem found so the client can show it, rather than silently dropping a tag.
export async function resolveChallengeTags(
  memberId: string, requestedIds: unknown, date: string, activityType: ActivityType, distance: number | undefined,
): Promise<{ ids: string[] } | { error: string }> {
  const ids = Array.isArray(requestedIds) ? [...new Set(requestedIds.filter((x): x is string => typeof x === 'string'))] : [];
  if (ids.length === 0) return { ids: [] };
  if (!distance) return { error: 'Add a distance (km) to count this activity toward a challenge' };
  const loggable = new Map((await getLoggableChallenges(memberId, date)).map(c => [c.id, c]));
  for (const id of ids) {
    const c = loggable.get(id);
    if (!c) return { error: 'One of the selected challenges is not active for you on this date' };
    if (!CHALLENGE_CATEGORY_ACTIVITY_TYPES[c.category!].includes(activityType)) {
      return { error: `"${c.title}" only counts ${c.category === 'cycling' ? 'cycling' : 'runs, walks and hikes'}` };
    }
  }
  return { ids };
}

// A teammate's auto-logged copy carries only the logger's challenges the teammate has also joined.
export async function challengeTagsForMember(memberId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const accepted = await Promise.all(ids.map(async id => (await getChallengeParticipant(id, memberId))?.status === 'accepted'));
  return ids.filter((_, i) => accepted[i]);
}

export async function getOpenChallenges(): Promise<Challenge[]> {
  return (await getAllChallenges()).filter(c => c.kind !== 'trivia' && c.visibility === 'open' && getChallengeDisplayStatus(c) === 'active');
}

// Validates picked co-facilitators: active, real members, not the owner. Returns an error message on a bad pick.
export async function resolveCoFacilitators(ownerId: string, requestedIds: unknown): Promise<{ coFacilitators: { id: string; name: string }[] } | { error: string }> {
  const ids = Array.isArray(requestedIds) ? [...new Set(requestedIds.filter((x): x is string => typeof x === 'string' && x !== ownerId))] : [];
  if (ids.length > MAX_CO_FACILITATORS) return { error: `Pick at most ${MAX_CO_FACILITATORS} co-facilitators` };
  const coFacilitators: { id: string; name: string }[] = [];
  for (const id of ids) {
    const m = await getMember(id);
    if (!m || !m.isActive || m.isShadowUser) return { error: 'One of the selected co-facilitators is not an active member' };
    coFacilitators.push({ id: m.id, name: m.name });
  }
  return { coFacilitators };
}

// Joins each co-facilitator to the challenge so it shows up in their own Challenges list.
export async function joinCoFacilitators(challenge: Challenge): Promise<void> {
  const now = new Date().toISOString();
  for (const f of challenge.coFacilitators ?? []) {
    const existing = await getChallengeParticipant(challenge.id, f.id);
    if (existing?.status === 'accepted') continue;
    await saveChallengeParticipant({
      ...(existing ?? { invitedAt: now }),
      challengeId: challenge.id, memberId: f.id, memberName: f.name, status: 'accepted',
      invitedBy: challenge.ownerId, invitedByName: challenge.ownerName, respondedAt: now,
    });
  }
}

export async function getAcceptedParticipantCount(challengeId: string): Promise<number> {
  return (await getChallengeParticipants(challengeId)).filter(p => p.status === 'accepted').length;
}

// Live or upcoming featured challenges, oldest feature first so the main page order stays stable.
export async function getFeaturedChallenges(): Promise<Challenge[]> {
  return (await getAllChallenges())
    .filter(c => c.kind !== 'trivia' && c.featureStatus === 'featured' && getChallengeDisplayStatus(c) === 'active')
    .sort((a, b) => (a.featuredAt ?? a.createdAt).localeCompare(b.featuredAt ?? b.createdAt));
}

// How many challenges are featured right now vs the admin's limit, not counting `excludeId` itself.
export async function getFeatureCapacity(excludeId?: string): Promise<{ current: number; max: number; full: boolean }> {
  const [featured, settings] = await Promise.all([getFeaturedChallenges(), getAppSettings()]);
  const current = featured.filter(c => c.id !== excludeId).length;
  return { current, max: settings.maxFeaturedChallenges, full: current >= settings.maxFeaturedChallenges };
}

// Ended (not cancelled) distance challenges, most recently finished first.
export async function getEndedChallenges(): Promise<Challenge[]> {
  return (await getAllChallenges())
    .filter(c => c.kind !== 'trivia' && getChallengeDisplayStatus(c) === 'ended')
    .sort((a, b) => b.endDate!.localeCompare(a.endDate!));
}

// ─── App settings ────────────────────────────────────────────────────────────
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const s = await getRedis().get<Partial<AppSettings>>(KEYS.settings);
    return s ? { ...DEFAULT_APP_SETTINGS, ...s } : DEFAULT_APP_SETTINGS;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

// Re-export for convenience
export { uuidv4, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS };

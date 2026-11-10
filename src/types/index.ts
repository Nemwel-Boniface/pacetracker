export type Country = string;
export type ActivityType = 'run' | 'walk' | 'hike' | 'cycling' | 'yoga' | 'pilates' | 'swimming' | 'cardio' | 'gym_leg_day' | 'gym_upper_body' | 'gym_full_body' | 'compound_workout' | 'lunch_walk' | 'lunch_stretch' | 'lunch_mobility' | 'other';
export type ActivityCategory = 'run_session' | 'lunch_time_activity' | 'race_signup' | 'race_complete';
export type PointTier = 'getting_started' | 'building_momentum' | 'consistency_crew' | 'move_together_champions';

export interface CountryConfig { name: string; flag: string; isActive: boolean; }
export type MarathonDistance = '5k' | '10k' | '21k';
export interface Member { id: string; name: string; email: string; country: Country; isActive: boolean; joinedAt: string; avatarInitials: string; passwordHash?: string; selfRegistered?: boolean; isAdminMember?: boolean; isShadowUser?: boolean; isInvited?: boolean; inviteAccepted?: boolean; marathonRegistered?: boolean; marathonDistance?: MarathonDistance; }
export interface TeamMember { id: string; name: string; }
export interface ActivityLog { id: string; memberId: string; memberName: string; activityType: ActivityType; category: ActivityCategory; date: string; notes?: string; points: number; loggedAt: string; distance?: number; duration?: number; steps?: number; teamMembers?: TeamMember[]; teamActivityId?: string; isTeamActivity?: boolean; teamActivityOwner?: TeamMember; challengeIds?: string[]; }
export interface MemberStats { memberId: string; memberName: string; country: Country; totalPoints: number; tier: PointTier; runSessions: number; lunchActivities: number; raceSignups: number; racesCompleted: number; activeDays: number; lastActive?: string; isActive: boolean; }
export interface PrizeCategory { id: string; name: string; amount: number; description: string; criteria: string; isVisible: boolean; createdAt: string; }
export interface Winner { id: string; prizeCategoryId: string; prizeCategoryName: string; memberId: string; memberName: string; country: Country; isVisible: boolean; announcedAt: string; }

export type FeedbackCategory = 'suggestion' | 'bug' | 'question' | 'other';
export type FeedbackStatus = 'pending' | 'acknowledged' | 'in_progress' | 'done';
export interface Feedback { id: string; memberId: string; memberName: string; message: string; category: FeedbackCategory; status: FeedbackStatus; adminComment?: string; submittedAt: string; updatedAt?: string; }

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = { suggestion: '💡 Suggestion', bug: '🐛 Bug Report', question: '❓ Question', other: '💬 General' };
export const FEEDBACK_STATUS_CONFIG: Record<FeedbackStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Received', bg: '#fef9c3', color: '#854d0e' },
  acknowledged: { label: 'Seen by Rhino', bg: '#dbeafe', color: '#1e40af' },
  in_progress: { label: 'In Progress', bg: '#ffedd5', color: '#9a3412' },
  done: { label: 'Done ✅', bg: '#dcfce7', color: '#14532d' },
};

export const ACTIVITY_POINTS: Record<ActivityCategory, number> = { run_session: 2, lunch_time_activity: 1, race_signup: 5, race_complete: 10 };
export const ACTIVITY_CATEGORY_MAP: Record<ActivityType, ActivityCategory> = { run: 'run_session', walk: 'run_session', hike: 'run_session', cycling: 'run_session', swimming: 'run_session', cardio: 'run_session', gym_leg_day: 'run_session', gym_upper_body: 'run_session', gym_full_body: 'run_session', compound_workout: 'run_session', yoga: 'run_session', pilates: 'run_session', lunch_walk: 'lunch_time_activity', lunch_stretch: 'lunch_time_activity', lunch_mobility: 'lunch_time_activity', other: 'run_session' };
export const ACTIVITY_LABELS: Record<ActivityType, string> = { run: '🏃 Run', walk: '🚶 Walk', hike: '🥾 Hike', cycling: '🚴 Cycling', swimming: '🏊 Swimming', cardio: '💪 Cardio', gym_leg_day: '🦵 Gym – Leg Day', gym_upper_body: '💪 Gym – Upper Body', gym_full_body: '🏋️ Gym – Full Body', compound_workout: '⚡ Compound Workout', yoga: '🧘 Yoga', pilates: '🧘‍♀️ Pilates', lunch_walk: '🍃 Lunch Walk', lunch_stretch: '🤸 Lunch Stretch', lunch_mobility: '🔄 Lunch Mobility', other: '✨ Other' };
export const TIER_CONFIG: Record<PointTier, { label: string; min: number; max: number | null; color: string; emoji: string }> = {
  getting_started: { label: 'Getting Started', min: 1, max: 10, color: '#94a3b8', emoji: '🌱' },
  building_momentum: { label: 'Building Momentum', min: 11, max: 20, color: '#f97316', emoji: '🔥' },
  consistency_crew: { label: 'Consistency Crew', min: 21, max: 30, color: '#16a34a', emoji: '⚡' },
  move_together_champions: { label: 'Move Together Champions', min: 31, max: null, color: '#dc2626', emoji: '🏆' },
};
export function getTier(points: number): PointTier {
  if (points >= 31) return 'move_together_champions';
  if (points >= 21) return 'consistency_crew';
  if (points >= 11) return 'building_momentum';
  return 'getting_started';
}
export function getCountryFlag(country: string, configs: CountryConfig[]): string {
  return configs.find(c => c.name === country)?.flag || '🌍';
}

export type ChallengeCategory = 'run_walk' | 'cycling';
// 'custom' = the creator picked both the start and end date.
export type ChallengePeriod = 'weekly' | 'monthly' | 'custom';
export type ChallengeStatus = 'active' | 'cancelled';
export type ChallengeInviteStatus = 'pending' | 'accepted' | 'declined' | 'left';
// A Challenge with no `kind` is a legacy record — always treat it as 'distance', never write a backfill.
export type ChallengeKind = 'distance' | 'trivia';
// Missing = 'invite' (every challenge created before open challenges existed was invite-only).
export type ChallengeVisibility = 'open' | 'invite';
// Main-page featuring. Missing = never requested. Members can only request; an admin features or declines.
// Stays 'featured' after the challenge ends so it shows up in the public past-challenges history.
export type ChallengeFeatureStatus = 'requested' | 'featured' | 'declined';

export interface Challenge {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  kind?: ChallengeKind;
  // True only for the single historical Trivia record backfilled from the standalone Methali game.
  // That game is a separate live system (its own Redis key, its own admin/public pages) — this
  // entry exists so it's discoverable in the unified Trivias list, but "Manage"/"view live" should
  // always route to the real Methali pages, never to this record's own (frozen) control panel.
  isLegacyMethali?: boolean;
  // Distance-only fields — required in practice when kind is 'distance' (or omitted), unused for 'trivia'.
  category?: ChallengeCategory;
  period?: ChallengePeriod;
  goalKm?: number;
  visibility?: ChallengeVisibility;
  // True for challenges created after activity tagging shipped: only activities the logger explicitly
  // tagged with this challenge count. Missing = legacy auto-match (every matching activity in range counts).
  taggedOnly?: boolean;
  // Shown on the main page card and in the chatbot. Required before a challenge can be featured.
  description?: string;
  featureStatus?: ChallengeFeatureStatus;
  featuredAt?: string;
  // People who help the owner run the challenge and answer questions. Joined automatically and can invite.
  coFacilitators?: { id: string; name: string }[];
  // Can be a future date: people can join early, but only activities from startDate on count.
  startDate?: string;
  endDate?: string;
  status: ChallengeStatus;
  createdAt: string;
}
export interface ChallengeParticipant {
  challengeId: string;
  memberId: string;
  memberName: string;
  status: ChallengeInviteStatus;
  invitedBy: string;
  invitedByName: string;
  invitedAt: string;
  respondedAt?: string;
}
export interface ChallengeLeaderboardEntry { memberId: string; memberName: string; progressKm: number; percentage: number; rank: number; points: number; activityCount: number; groupActivityCount: number; }
export interface ChallengeMemberStats { km: number; points: number; activityCount: number; groupActivityCount: number; }
export interface ChallengePace { percentage: number; expectedKm: number; onPace: boolean; daysElapsed: number; daysRemaining: number; periodDays: number; }

export const CHALLENGE_CATEGORY_ACTIVITY_TYPES: Record<ChallengeCategory, ActivityType[]> = {
  run_walk: ['run', 'walk', 'hike'],
  cycling: ['cycling'],
};
export const CHALLENGE_CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  run_walk: '🏃 Run / Walk / Hike',
  cycling: '🚴 Cycling',
};
export const CHALLENGE_PERIOD_LABELS: Record<ChallengePeriod, string> = { weekly: 'Weekly', monthly: 'Monthly', custom: 'Custom dates' };
export const CHALLENGE_PERIOD_DAYS: Record<Exclude<ChallengePeriod, 'custom'>, number> = { weekly: 7, monthly: 30 };
export const MAX_CHALLENGE_DAYS = 366;

// Inclusive length of a challenge in days, from its actual dates (works for every period).
export function challengeLengthDays(startDate: string, endDate: string): number {
  return Math.round((new Date(endDate + 'T12:00:00Z').getTime() - new Date(startDate + 'T12:00:00Z').getTime()) / 86400000) + 1;
}

export function computeChallengeEndDate(startDate: string, period: Exclude<ChallengePeriod, 'custom'>): string {
  const d = new Date(startDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + CHALLENGE_PERIOD_DAYS[period] - 1);
  return d.toISOString().slice(0, 10);
}
// Distance-goal challenges only (kind !== 'trivia') — trivia challenges compute their own status from game phase.
export function getChallengeDisplayStatus(c: Challenge): 'active' | 'ended' | 'cancelled' {
  if (c.status === 'cancelled') return 'cancelled';
  const today = new Date().toISOString().slice(0, 10);
  return today > c.endDate! ? 'ended' : 'active';
}
// An active challenge whose start date is still in the future. Joinable, but nothing can be tagged to it yet.
export function isChallengeUpcoming(c: Challenge): boolean {
  return getChallengeDisplayStatus(c) === 'active' && new Date().toISOString().slice(0, 10) < c.startDate!;
}
export const CHALLENGE_DESCRIPTION_MAX = 500;
export const MAX_CO_FACILITATORS = 5;
export function isChallengeFacilitator(c: Challenge, memberId: string): boolean {
  return c.ownerId === memberId || (c.coFacilitators ?? []).some(f => f.id === memberId);
}
// "Jane", "Jane & John", "Jane, John & Amy" — the owner first.
export function facilitatorNames(c: Challenge): string {
  const names = [c.ownerName, ...(c.coFacilitators ?? []).map(f => f.name)];
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
// Who members contact when they're unsure which account is theirs (shown on sign-up conflicts).
export const ADMIN_CONTACT = { name: 'Nemwel Rhino', phone: '+254727475518', whatsapp: 'https://wa.me/254727475518' };

// "j***@edencare.com": enough for someone to recognise their own address without exposing it.
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return domain ? `${user.slice(0, 1)}***@${domain}` : '***';
}

// Ready-to-paste Slack/WhatsApp text for inviting people to a distance challenge (*bold* works in both).
export function challengeInviteMessage(c: {
  id: string; title: string; description?: string; goalKm: number; category: ChallengeCategory;
  startDate: string; endDate: string; facilitators: string; inviteOnly?: boolean;
}, origin: string): string {
  const fmt = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const moves = c.category === 'cycling' ? 'ride' : 'run, walk or hike';
  return [
    `🏁 Join me in *${c.title}*!`,
    ...(c.description ? ['', c.description] : []),
    '',
    `🎯 Goal: ${c.goalKm} km (${c.category === 'cycling' ? 'cycling' : 'runs, walks and hikes'})`,
    `📆 ${fmt(c.startDate)} – ${fmt(c.endDate)}`,
    `🤝 Facilitated by ${c.facilitators}`,
    '',
    '*How to join*',
    `1. Log in (or create an account) here: ${origin}/authenticate?next=/member/challenges/${c.id}`,
    c.inviteOnly ? '2. Accept the invite waiting on your Challenges page' : '2. Tap *Join*',
    `3. Each time you log a ${moves}, add the distance and pick *${c.title}* under "Is this for a challenge?"`,
    '',
    'See you out there! 🦏',
  ].join('\n');
}
export const DEFAULT_MAX_FEATURED_CHALLENGES = 3;

export interface AppSettings {
  marathonBannerEnabled: boolean;
  marathonCountries: string[]; // empty = all countries; specific names = only those
  // Soft cap on live featured challenges. Admins can still override it per challenge.
  maxFeaturedChallenges: number;
}
export const DEFAULT_APP_SETTINGS: AppSettings = { marathonBannerEnabled: true, marathonCountries: [], maxFeaturedChallenges: DEFAULT_MAX_FEATURED_CHALLENGES };
export const DEFAULT_COUNTRIES: CountryConfig[] = [
  { name: 'Kenya', flag: '🇰🇪', isActive: true },
  { name: 'Rwanda', flag: '🇷🇼', isActive: true },
  { name: 'South Africa', flag: '🇿🇦', isActive: true },
  { name: 'India', flag: '🇮🇳', isActive: true },
  { name: 'Uganda', flag: '🇺🇬', isActive: false },
  { name: 'Tanzania', flag: '🇹🇿', isActive: false },
  { name: 'Ethiopia', flag: '🇪🇹', isActive: false },
  { name: 'Ghana', flag: '🇬🇭', isActive: false },
  { name: 'Nigeria', flag: '🇳🇬', isActive: false },
  { name: 'Egypt', flag: '🇪🇬', isActive: false },
  { name: 'Morocco', flag: '🇲🇦', isActive: false },
  { name: 'Senegal', flag: '🇸🇳', isActive: false },
  { name: 'Cameroon', flag: '🇨🇲', isActive: false },
  { name: 'Zimbabwe', flag: '🇿🇼', isActive: false },
  { name: 'Zambia', flag: '🇿🇲', isActive: false },
  { name: 'Mozambique', flag: '🇲🇿', isActive: false },
  { name: 'Botswana', flag: '🇧🇼', isActive: false },
  { name: 'Namibia', flag: '🇳🇦', isActive: false },
  { name: 'Malawi', flag: '🇲🇼', isActive: false },
  { name: 'Madagascar', flag: '🇲🇬', isActive: false },
  { name: 'Mauritius', flag: '🇲🇺', isActive: false },
  { name: 'Tunisia', flag: '🇹🇳', isActive: false },
  { name: 'Algeria', flag: '🇩🇿', isActive: false },
  { name: 'Angola', flag: '🇦🇴', isActive: false },
  { name: 'DRC', flag: '🇨🇩', isActive: false },
  { name: 'Ivory Coast', flag: '🇨🇮', isActive: false },
  { name: 'Togo', flag: '🇹🇬', isActive: false },
  { name: 'Burundi', flag: '🇧🇮', isActive: false },
  { name: 'Lesotho', flag: '🇱🇸', isActive: false },
  { name: 'Eswatini', flag: '🇸🇿', isActive: false },
  { name: 'Djibouti', flag: '🇩🇯', isActive: false },
  { name: 'Eritrea', flag: '🇪🇷', isActive: false },
  { name: 'Somalia', flag: '🇸🇴', isActive: false },
  { name: 'Sudan', flag: '🇸🇩', isActive: false },
  { name: 'Seychelles', flag: '🇸🇨', isActive: false },
];

// ─── YEF 2026 (Year-End Function): Secret Santa + Awards ─────────────────────
export const YEF_GIFT_BUDGET_KES = 1000;
export const YEF_LIKES_MAX = 300;
export const YEF_AWARD_TITLE_MAX = 60;
export const YEF_AWARD_DESC_MAX = 200;
// Everyone on the Year-End list: the Secret Santa pool and the award nominees. `claimedBy` links the
// PaceTracker member who said "this is me", so only they can edit their likes or vote as this person.
export interface YefPerson { id: string; name: string; department: string; likes?: string; claimedBy?: string; claimedByName?: string; addedAt: string; }
// Groups of person ids: a pair gifts each other; a trio (only when the count is odd) gifts in a ring, A→B→C→A.
export interface YefSantaState { published: boolean; groups: string[][]; generatedAt?: string; }
export type YefAwardStatus = 'suggested' | 'approved' | 'rejected';
export interface YefAward { id: string; title: string; description?: string; status: YefAwardStatus; noSameDepartment?: boolean; suggestedByName?: string; createdAt: string; }
export interface YefSettings { votingOpen: boolean; resultsRevealed: boolean; }
export const DEFAULT_YEF_SETTINGS: YefSettings = { votingOpen: false, resultsRevealed: false };

// Who each member of a group buys for. In a pair that's the other person; in a trio it's the next one round.
export function yefGiftTarget(group: string[], personId: string): string | null {
  const i = group.indexOf(personId);
  if (i === -1 || group.length < 2) return null;
  return group[(i + 1) % group.length];
}
export function yefGiftFrom(group: string[], personId: string): string | null {
  const i = group.indexOf(personId);
  if (i === -1 || group.length < 2) return null;
  return group[(i - 1 + group.length) % group.length];
}
export function sameDepartment(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

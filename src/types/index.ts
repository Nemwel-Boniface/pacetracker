export type Country = string;
export type ActivityType = 'run' | 'walk' | 'hike' | 'cycling' | 'yoga' | 'swimming' | 'cardio' | 'gym_leg_day' | 'gym_upper_body' | 'gym_full_body' | 'compound_workout' | 'lunch_walk' | 'lunch_stretch' | 'lunch_mobility' | 'other';
export type ActivityCategory = 'run_session' | 'lunch_time_activity' | 'race_signup' | 'race_complete';
export type PointTier = 'getting_started' | 'building_momentum' | 'consistency_crew' | 'move_together_champions';

export interface CountryConfig { name: string; flag: string; isActive: boolean; }
export interface Member { id: string; name: string; email: string; country: Country; isActive: boolean; joinedAt: string; avatarInitials: string; passwordHash?: string; selfRegistered?: boolean; isAdminMember?: boolean; }
export interface ActivityLog { id: string; memberId: string; memberName: string; activityType: ActivityType; category: ActivityCategory; date: string; notes?: string; points: number; loggedAt: string; distance?: number; duration?: number; }
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
export const ACTIVITY_CATEGORY_MAP: Record<ActivityType, ActivityCategory> = { run: 'run_session', walk: 'run_session', hike: 'run_session', cycling: 'run_session', swimming: 'run_session', cardio: 'run_session', gym_leg_day: 'run_session', gym_upper_body: 'run_session', gym_full_body: 'run_session', compound_workout: 'run_session', yoga: 'run_session', lunch_walk: 'lunch_time_activity', lunch_stretch: 'lunch_time_activity', lunch_mobility: 'lunch_time_activity', other: 'run_session' };
export const ACTIVITY_LABELS: Record<ActivityType, string> = { run: '🏃 Run', walk: '🚶 Walk', hike: '🥾 Hike', cycling: '🚴 Cycling', swimming: '🏊 Swimming', cardio: '💪 Cardio', gym_leg_day: '🦵 Gym – Leg Day', gym_upper_body: '💪 Gym – Upper Body', gym_full_body: '🏋️ Gym – Full Body', compound_workout: '⚡ Compound Workout', yoga: '🧘 Yoga', lunch_walk: '🍃 Lunch Walk', lunch_stretch: '🤸 Lunch Stretch', lunch_mobility: '🔄 Lunch Mobility', other: '✨ Other' };
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

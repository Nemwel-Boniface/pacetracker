export type Country = 'Kenya' | 'Rwanda' | 'India' | 'South Africa';
export type ActivityType = 'run' | 'walk' | 'hike' | 'cycling' | 'yoga' | 'swimming' | 'cardio' | 'gym_leg_day' | 'gym_upper_body' | 'gym_full_body' | 'compound_workout' | 'lunch_walk' | 'lunch_stretch' | 'lunch_mobility' | 'other';
export type ActivityCategory = 'run_session' | 'lunch_time_activity' | 'race_signup' | 'race_complete';
export type PointTier = 'getting_started' | 'building_momentum' | 'consistency_crew' | 'move_together_champions';

export interface Member { id: string; name: string; email: string; country: Country; isActive: boolean; joinedAt: string; avatarInitials: string; }
export interface ActivityLog { id: string; memberId: string; memberName: string; activityType: ActivityType; category: ActivityCategory; date: string; notes?: string; points: number; loggedAt: string; }
export interface MemberStats { memberId: string; memberName: string; country: Country; totalPoints: number; tier: PointTier; runSessions: number; lunchActivities: number; raceSignups: number; racesCompleted: number; activeDays: number; lastActive?: string; isActive: boolean; }
export interface PrizeCategory { id: string; name: string; amount: number; description: string; criteria: string; isVisible: boolean; createdAt: string; }
export interface Winner { id: string; prizeCategoryId: string; prizeCategoryName: string; memberId: string; memberName: string; country: Country; isVisible: boolean; announcedAt: string; }

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
export const COUNTRIES: Country[] = ['Kenya', 'Rwanda', 'India', 'South Africa'];
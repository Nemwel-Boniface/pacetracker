import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getMemberActivities, ADMIN_MEMBER_ID } from '@/lib/data';

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

function shiftDay(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeCurrentStreak(dateSet: Set<string>): number {
  const today = todayStr();
  const start = dateSet.has(today) ? today : shiftDay(today, -1);
  if (!dateSet.has(start)) return 0;
  let streak = 0, check = start;
  while (dateSet.has(check)) { streak++; check = shiftDay(check, -1); }
  return streak;
}

function computeLongestStreak(sortedDates: string[]): number {
  if (!sortedDates.length) return 0;
  let longest = 1, current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = Math.round((new Date(sortedDates[i] + 'T12:00:00').getTime() - new Date(sortedDates[i - 1] + 'T12:00:00').getTime()) / 86400000);
    if (diff === 1) { current++; longest = Math.max(longest, current); } else { current = 1; }
  }
  return longest;
}

const MILESTONES = [
  { days: 3,  label: 'Getting Warm',      emoji: '🌱' },
  { days: 7,  label: 'One Week Warrior',   emoji: '⚡' },
  { days: 14, label: 'Fortnight Fighter',  emoji: '💪' },
  { days: 21, label: 'Three Week Thunder', emoji: '🏅' },
  { days: 30, label: 'Monthly Master',     emoji: '🔥' },
  { days: 50, label: 'Iron Streak',        emoji: '🚀' },
  { days: 56, label: 'Challenge Legend',   emoji: '👑' },
];

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const activities = await getMemberActivities(ADMIN_MEMBER_ID);
    const dateSet = new Set<string>(activities.map(a => a.date));
    const sortedDates = [...dateSet].sort();
    const today = todayStr();
    const currentStreak = computeCurrentStreak(dateSet);
    const longestStreak = computeLongestStreak(sortedDates);

    const recentDays = Array.from({ length: 30 }, (_, i) => {
      const date = shiftDay(today, -(29 - i));
      return { date, hasActivity: dateSet.has(date), isToday: date === today };
    });

    const milestones = MILESTONES.map(m => ({
      ...m, achieved: currentStreak >= m.days || longestStreak >= m.days,
    }));

    return NextResponse.json({
      currentStreak,
      longestStreak,
      isActiveToday: dateSet.has(today),
      totalActiveDays: dateSet.size,
      recentDays,
      milestones,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to compute streak' }, { status: 500 });
  }
}

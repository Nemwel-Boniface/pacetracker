import { NextResponse } from 'next/server';
import { getMemberSession } from '@/lib/auth';
import { getMemberActivities } from '@/lib/data';

interface StreakDay { date: string; hasActivity: boolean; isToday: boolean; }
interface Milestone { days: number; label: string; emoji: string; achieved: boolean; }

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
  let streak = 0;
  let check = start;
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

const MILESTONES: Omit<Milestone, 'achieved'>[] = [
  { days: 3,  label: 'Getting Warm',       emoji: '🌱' },
  { days: 7,  label: 'One Week Warrior',    emoji: '⚡' },
  { days: 14, label: 'Fortnight Fighter',   emoji: '💪' },
  { days: 21, label: 'Three Week Thunder',  emoji: '🏅' },
  { days: 30, label: 'Monthly Master',      emoji: '🔥' },
  { days: 50, label: 'Iron Streak',         emoji: '🚀' },
  { days: 56, label: 'Challenge Legend',    emoji: '👑' },
];

export async function GET() {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const activities = await getMemberActivities(session.memberId);
    const dateSet = new Set<string>(activities.map(a => a.date));
    const sortedDates = [...dateSet].sort();

    const today = todayStr();
    const currentStreak = computeCurrentStreak(dateSet);
    const longestStreak = computeLongestStreak(sortedDates);

    const recentDays: StreakDay[] = Array.from({ length: 30 }, (_, i) => {
      const date = shiftDay(today, -(29 - i));
      return { date, hasActivity: dateSet.has(date), isToday: date === today };
    });

    const milestones: Milestone[] = MILESTONES.map(m => ({ ...m, achieved: longestStreak >= m.days || currentStreak >= m.days }));

    return NextResponse.json({
      currentStreak,
      longestStreak,
      isActiveToday: dateSet.has(today),
      lastLogDate: sortedDates[sortedDates.length - 1] ?? null,
      totalActiveDays: dateSet.size,
      recentDays,
      milestones,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to compute streak' }, { status: 500 });
  }
}

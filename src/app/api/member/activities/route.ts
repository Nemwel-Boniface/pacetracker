import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMemberSession } from '@/lib/auth';
import { getMember, getMemberActivitiesForDate, logActivity, getMemberActivities } from '@/lib/data';
import { ActivityLog, ActivityType, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS } from '@/types';

const MAX_PER_DAY = 2;
const MAX_DAYS_BACK = 2;

function todayUTC(): string { return new Date().toISOString().slice(0, 10); }
function shiftDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function allowedDates(): string[] {
  const today = todayUTC();
  return Array.from({ length: MAX_DAYS_BACK + 1 }, (_, i) => shiftDays(today, -i));
}

export async function GET() {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const activities = await getMemberActivities(session.memberId);
    const today = todayUTC();
    const todayActivities = activities.filter(a => a.date === today);
    return NextResponse.json({ activities, todayActivities, todayCount: todayActivities.length, remaining: Math.max(0, MAX_PER_DAY - todayActivities.length) });
  } catch { return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const member = await getMember(session.memberId);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (!member.isActive) return NextResponse.json({ error: 'Your account is inactive' }, { status: 403 });

    const { activityType, notes, distance, duration, date } = await req.json();
    if (!activityType) return NextResponse.json({ error: 'activityType required' }, { status: 400 });

    const allowed = allowedDates();
    const targetDate = allowed.includes(date) ? date : allowed[0];

    const dateActivities = await getMemberActivitiesForDate(session.memberId, targetDate);
    if (dateActivities.length >= MAX_PER_DAY) {
      return NextResponse.json({ error: `Daily limit reached — you can log up to ${MAX_PER_DAY} activities per day` }, { status: 429 });
    }

    const category = ACTIVITY_CATEGORY_MAP[activityType as ActivityType] || 'run_session';
    const activity: ActivityLog = {
      id: uuidv4(), memberId: member.id, memberName: member.name,
      activityType, category, date: targetDate,
      notes: notes?.trim() || undefined,
      distance: distance != null && Number(distance) > 0 ? Math.round(Number(distance) * 10) / 10 : undefined,
      duration: duration != null && Number(duration) > 0 ? Math.round(Number(duration)) : undefined,
      points: ACTIVITY_POINTS[category],
      loggedAt: new Date().toISOString(),
    };
    await logActivity(activity);
    return NextResponse.json({ activity, remaining: MAX_PER_DAY - dateActivities.length - 1, date: targetDate }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 }); }
}

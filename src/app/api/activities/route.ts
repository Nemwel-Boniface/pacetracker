import { NextRequest, NextResponse } from 'next/server';
import { logActivity, deleteActivity, getActivitiesForDate, getMemberActivities, getAllActivities } from '@/lib/data';
import { getAdminSession } from '@/lib/auth';
import { ActivityLog, ACTIVITY_POINTS, ACTIVITY_CATEGORY_MAP } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const date = sp.get('date'); const memberId = sp.get('memberId');
  try {
    if (date) { const activities = await getActivitiesForDate(date); return NextResponse.json({ activities }); }
    if (memberId) { const activities = await getMemberActivities(memberId); return NextResponse.json({ activities }); }
    const activities = await getAllActivities(); return NextResponse.json({ activities });
  } catch { return NextResponse.json({ activities: [] }); }
}
export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { memberId, memberName, activityType, date, notes, distance, duration } = await req.json();
    if (!memberId || !activityType || !date) return NextResponse.json({ error: 'memberId, activityType, and date required' }, { status: 400 });
    const category = ACTIVITY_CATEGORY_MAP[activityType as keyof typeof ACTIVITY_CATEGORY_MAP] || 'run_session';
    const activity: ActivityLog = { id: uuidv4(), memberId, memberName, activityType, category, date, notes: notes?.trim() || undefined, distance: distance != null && Number(distance) > 0 ? Math.round(Number(distance) * 10) / 10 : undefined, duration: duration != null && Number(duration) > 0 ? Math.round(Number(duration)) : undefined, points: ACTIVITY_POINTS[category], loggedAt: new Date().toISOString() };
    await logActivity(activity); return NextResponse.json({ activity }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 }); }
}
export async function DELETE(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try { await deleteActivity(id); return NextResponse.json({ success: true }); }
  catch { return NextResponse.json({ error: 'Failed to delete' }, { status: 500 }); }
}
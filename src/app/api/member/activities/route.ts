import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMemberSession } from '@/lib/auth';
import { getMember, getMemberActivitiesForDate, logActivity, getMemberActivities, getActivitiesForDate } from '@/lib/data';
import { ActivityLog, ActivityType, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS, TeamMember } from '@/types';

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

    const { activityType, notes, distance, duration, date, teamMemberIds } = await req.json();
    if (!activityType) return NextResponse.json({ error: 'activityType required' }, { status: 400 });

    const allowed = allowedDates();
    const targetDate = allowed.includes(date) ? date : allowed[0];

    const dateActivities = await getMemberActivitiesForDate(session.memberId, targetDate);
    if (dateActivities.length >= MAX_PER_DAY) {
      return NextResponse.json({ error: `Daily limit reached — you can log up to ${MAX_PER_DAY} activities per day` }, { status: 429 });
    }

    const category = ACTIVITY_CATEGORY_MAP[activityType as ActivityType] || 'run_session';
    const basePoints = ACTIVITY_POINTS[category];

    // Resolve valid team members (active, not self)
    const rawIds: string[] = Array.isArray(teamMemberIds) ? teamMemberIds : [];
    const teamPeers: TeamMember[] = [];
    for (const peerId of rawIds) {
      if (peerId === member.id) continue;
      const peer = await getMember(peerId);
      if (peer?.isActive) teamPeers.push({ id: peer.id, name: peer.name });
    }

    const hasTeam = teamPeers.length > 0;

    // Duplicate group activity guard
    if (hasTeam) {
      const dayActivities = await getActivitiesForDate(targetDate);
      const existingGroupActivities = dayActivities.filter(a =>
        !a.isTeamActivity && a.teamMembers && a.teamMembers.length > 0
      );
      const newSet = new Set([member.id, ...teamPeers.map(p => p.id)]);
      for (const existing of existingGroupActivities) {
        const existingSet = new Set([existing.memberId, ...(existing.teamMembers || []).map(m => m.id)]);
        let overlap = 0;
        for (const pid of newSet) { if (existingSet.has(pid)) overlap++; }
        const smallerSize = Math.min(newSet.size, existingSet.size);
        if (overlap >= 2 && overlap >= smallerSize * 0.5) {
          return NextResponse.json({
            error: `Duplicate group activity — ${existing.memberName} already logged a similar activity with the same participants on this date.`,
            duplicate: true,
            existingOwner: existing.memberName,
          }, { status: 409 });
        }
      }
    }

    const points = hasTeam ? basePoints + 1 : basePoints;
    const loggedAt = new Date().toISOString();
    const activityId = uuidv4();

    const activity: ActivityLog = {
      id: activityId, memberId: member.id, memberName: member.name,
      activityType, category, date: targetDate,
      notes: notes?.trim() || undefined,
      distance: distance != null && Number(distance) > 0 ? Math.round(Number(distance) * 10) / 10 : undefined,
      duration: duration != null && Number(duration) > 0 ? Math.round(Number(duration)) : undefined,
      points,
      loggedAt,
      ...(hasTeam && { teamMembers: teamPeers }),
    };
    await logActivity(activity);

    // Auto-log for each teammate (bypasses their daily cap — team activities are bonus)
    if (hasTeam) {
      const teamActivity = {
        activityType, category, date: targetDate,
        notes: notes?.trim() || undefined,
        distance: activity.distance,
        duration: activity.duration,
        points,
        loggedAt,
      };
      const owner: TeamMember = { id: member.id, name: member.name };
      await Promise.all(teamPeers.map(peer =>
        logActivity({
          ...teamActivity,
          id: uuidv4(),
          memberId: peer.id,
          memberName: peer.name,
          isTeamActivity: true,
          teamActivityId: activityId,
          teamActivityOwner: owner,
        } as ActivityLog)
      ));
    }

    return NextResponse.json({ activity, remaining: MAX_PER_DAY - dateActivities.length - 1, date: targetDate }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 }); }
}

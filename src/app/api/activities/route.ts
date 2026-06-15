import { NextRequest, NextResponse } from 'next/server';
import { logActivity, deleteActivity, getActivitiesForDate, getMemberActivities, getAllActivities, getMember } from '@/lib/data';
import { getAdminSession } from '@/lib/auth';
import { ActivityLog, ACTIVITY_POINTS, ACTIVITY_CATEGORY_MAP, TeamMember } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const { memberId, memberName, activityType, date, notes, distance, duration, teamMemberIds } = await req.json();
    if (!memberId || !activityType || !date) return NextResponse.json({ error: 'memberId, activityType, and date required' }, { status: 400 });

    const category = ACTIVITY_CATEGORY_MAP[activityType as keyof typeof ACTIVITY_CATEGORY_MAP] || 'run_session';
    const basePoints = ACTIVITY_POINTS[category];
    const loggedAt = new Date().toISOString();
    const activityId = uuidv4();

    // Resolve team members if provided
    const rawIds: string[] = Array.isArray(teamMemberIds) ? teamMemberIds : [];
    const teamPeers: TeamMember[] = [];
    for (const peerId of rawIds) {
      if (peerId === memberId) continue;
      const peer = await getMember(peerId);
      if (peer?.isActive && !peer.isShadowUser) teamPeers.push({ id: peer.id, name: peer.name });
    }

    const hasTeam = teamPeers.length > 0;
    const points = hasTeam ? basePoints + 1 : basePoints;

    const dist = distance != null && Number(distance) > 0 ? Math.round(Number(distance) * 10) / 10 : undefined;
    const dur = duration != null && Number(duration) > 0 ? Math.round(Number(duration)) : undefined;

    const activity: ActivityLog = {
      id: activityId, memberId, memberName, activityType, category, date,
      notes: notes?.trim() || undefined,
      distance: dist, duration: dur,
      points, loggedAt,
      ...(hasTeam && { teamMembers: teamPeers }),
    };
    await logActivity(activity);

    if (hasTeam) {
      const owner: TeamMember = { id: memberId, name: memberName };
      await Promise.all(teamPeers.map(peer =>
        logActivity({
          id: uuidv4(), memberId: peer.id, memberName: peer.name,
          activityType, category, date,
          notes: notes?.trim() || undefined,
          distance: dist, duration: dur,
          points, loggedAt,
          isTeamActivity: true,
          teamActivityId: activityId,
          teamActivityOwner: owner,
        } as ActivityLog)
      ));
    }

    return NextResponse.json({ activity }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try { await deleteActivity(id); return NextResponse.json({ success: true }); }
  catch { return NextResponse.json({ error: 'Failed to delete' }, { status: 500 }); }
}

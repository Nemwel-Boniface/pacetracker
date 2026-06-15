import { NextRequest, NextResponse } from 'next/server';
import { getActivity, updateActivity, logActivity, getMember } from '@/lib/data';
import { getAdminSession } from '@/lib/auth';
import { ActivityLog, ACTIVITY_POINTS, TeamMember } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const activity = await getActivity(id);
    if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ activity });
  } catch { return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const activity = await getActivity(id);
    if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (activity.isTeamActivity) return NextResponse.json({ error: 'Cannot edit a group auto-log' }, { status: 400 });

    const { teamMemberIds } = await req.json();
    const rawIds: string[] = Array.isArray(teamMemberIds) ? teamMemberIds : [];

    const existingIds = new Set((activity.teamMembers ?? []).map((m: TeamMember) => m.id));

    const newPeers: TeamMember[] = [];
    for (const pid of rawIds) {
      if (pid === activity.memberId || existingIds.has(pid)) continue;
      const peer = await getMember(pid);
      if (peer?.isActive && !peer.isShadowUser) newPeers.push({ id: peer.id, name: peer.name });
    }

    if (!newPeers.length) return NextResponse.json({ error: 'No new valid teammates provided' }, { status: 400 });

    const updatedTeam: TeamMember[] = [...(activity.teamMembers ?? []), ...newPeers];
    const basePoints = ACTIVITY_POINTS[activity.category];
    const updatedActivity: ActivityLog = { ...activity, teamMembers: updatedTeam, points: basePoints + 1 };
    await updateActivity(updatedActivity);

    const owner: TeamMember = { id: activity.memberId, name: activity.memberName };
    const loggedAt = new Date().toISOString();
    await Promise.all(newPeers.map(peer =>
      logActivity({
        id: uuidv4(), memberId: peer.id, memberName: peer.name,
        activityType: activity.activityType, category: activity.category,
        date: activity.date, notes: activity.notes,
        distance: activity.distance, duration: activity.duration,
        points: basePoints + 1, loggedAt,
        isTeamActivity: true, teamActivityId: activity.id, teamActivityOwner: owner,
      } as ActivityLog)
    ));

    return NextResponse.json({ activity: updatedActivity });
  } catch { return NextResponse.json({ error: 'Failed to update' }, { status: 500 }); }
}

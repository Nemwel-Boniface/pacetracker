import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMemberSession } from '@/lib/auth';
import { getMember, logActivity, updateActivity } from '@/lib/data';
import { getRedis, KEYS } from '@/lib/redis';
import { ActivityLog, ACTIVITY_POINTS, TeamMember } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

// Fetch a single activity — accessible to the owner or any tagged teammate
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const activity = await getRedis().get<ActivityLog>(KEYS.activity(id));
    if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = activity.memberId === session.memberId;
    const isTagged = (activity.teamMembers ?? []).some(m => m.id === session.memberId);
    if (!isOwner && !isTagged) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ activity });
  } catch { return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 }); }
}

// Add teammates to an existing activity
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const r = getRedis();
    const activity = await r.get<ActivityLog>(KEYS.activity(id));
    if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    if (activity.memberId !== session.memberId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { addMemberIds } = await req.json();
    if (!Array.isArray(addMemberIds) || addMemberIds.length === 0) {
      return NextResponse.json({ error: 'addMemberIds required' }, { status: 400 });
    }

    const existingIds = new Set((activity.teamMembers ?? []).map(m => m.id));

    const newPeers: TeamMember[] = [];
    for (const peerId of addMemberIds) {
      if (peerId === session.memberId || existingIds.has(peerId)) continue;
      const peer = await getMember(peerId);
      if (peer?.isActive) newPeers.push({ id: peer.id, name: peer.name });
    }

    if (newPeers.length === 0) {
      return NextResponse.json({ error: 'No new valid teammates to add' }, { status: 400 });
    }

    const updatedPoints = ACTIVITY_POINTS[activity.category] + 1;
    const loggedAt = new Date().toISOString();

    const updatedActivity: ActivityLog = {
      ...activity,
      teamMembers: [...(activity.teamMembers ?? []), ...newPeers],
      points: updatedPoints,
    };
    await updateActivity(updatedActivity);

    const owner: TeamMember = { id: activity.memberId, name: activity.memberName };
    await Promise.all(newPeers.map(peer =>
      logActivity({
        id: uuidv4(),
        memberId: peer.id,
        memberName: peer.name,
        activityType: activity.activityType,
        category: activity.category,
        date: activity.date,
        notes: activity.notes,
        distance: activity.distance,
        duration: activity.duration,
        points: updatedPoints,
        loggedAt,
        isTeamActivity: true,
        teamActivityId: activity.id,
        teamActivityOwner: owner,
      } as ActivityLog)
    ));

    return NextResponse.json({ activity: updatedActivity, addedCount: newPeers.length, addedNames: newPeers.map(p => p.name) });
  } catch { return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 }); }
}

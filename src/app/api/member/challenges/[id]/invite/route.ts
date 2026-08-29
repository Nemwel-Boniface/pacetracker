import { NextRequest, NextResponse } from 'next/server';
import { getMemberSession } from '@/lib/auth';
import { getChallenge, getChallengeParticipant, saveChallengeParticipant, getMember } from '@/lib/data';
import { ChallengeParticipant, getChallengeDisplayStatus } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.kind === 'trivia') return NextResponse.json({ error: 'Trivia challenges assign teams directly — see the trivia control panel' }, { status: 400 });
    if (challenge.ownerId !== session.memberId) return NextResponse.json({ error: 'Only the owner can invite members' }, { status: 403 });
    if (getChallengeDisplayStatus(challenge) !== 'active') return NextResponse.json({ error: 'This challenge is no longer active' }, { status: 400 });

    const owner = await getMember(session.memberId);
    if (!owner) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const { memberIds } = await req.json();
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: 'memberIds required' }, { status: 400 });
    }

    const invited: string[] = [];
    const skipped: { memberId: string; reason: string }[] = [];
    const now = new Date().toISOString();

    for (const memberId of memberIds) {
      if (memberId === session.memberId) { skipped.push({ memberId, reason: 'is the owner' }); continue; }
      const member = await getMember(memberId);
      if (!member || !member.isActive || member.isShadowUser) { skipped.push({ memberId, reason: 'not eligible' }); continue; }

      const existing = await getChallengeParticipant(id, memberId);
      if (existing?.status === 'pending') { skipped.push({ memberId, reason: 'already invited' }); continue; }
      if (existing?.status === 'accepted') { skipped.push({ memberId, reason: 'already joined' }); continue; }

      const participant: ChallengeParticipant = {
        challengeId: id, memberId: member.id, memberName: member.name,
        status: 'pending', invitedBy: owner.id, invitedByName: owner.name,
        invitedAt: now,
      };
      await saveChallengeParticipant(participant);
      invited.push(memberId);
    }

    return NextResponse.json({ invited, skipped });
  } catch { return NextResponse.json({ error: 'Failed to send invites' }, { status: 500 }); }
}

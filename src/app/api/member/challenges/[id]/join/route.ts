import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getChallenge, getChallengeParticipant, saveChallengeParticipant, getMember } from '@/lib/data';
import { ChallengeParticipant, getChallengeDisplayStatus } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

// Self-join an open challenge (also accepts a pending invite, or rejoins after leaving/declining).
export async function POST(_req: NextRequest, { params }: RouteCtx) {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.kind === 'trivia') return NextResponse.json({ error: 'Trivia challenges have no participant list to join' }, { status: 400 });
    if (getChallengeDisplayStatus(challenge) !== 'active') return NextResponse.json({ error: 'This challenge is no longer active' }, { status: 400 });

    const existing = await getChallengeParticipant(id, session.memberId);
    if (existing?.status === 'accepted') return NextResponse.json({ error: 'You have already joined this challenge' }, { status: 409 });
    if (challenge.visibility !== 'open' && existing?.status !== 'pending') return NextResponse.json({ error: 'This challenge is invite-only' }, { status: 403 });

    const member = await getMember(session.memberId);
    if (!member || !member.isActive) return NextResponse.json({ error: 'Account inactive' }, { status: 403 });

    const now = new Date().toISOString();
    const participant: ChallengeParticipant = existing
      ? { ...existing, status: 'accepted', respondedAt: now }
      : { challengeId: id, memberId: member.id, memberName: member.name, status: 'accepted', invitedBy: member.id, invitedByName: member.name, invitedAt: now, respondedAt: now };
    await saveChallengeParticipant(participant);
    return NextResponse.json({ participant });
  } catch { return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 }); }
}

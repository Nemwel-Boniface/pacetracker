import { NextRequest, NextResponse } from 'next/server';
import { getMemberSession } from '@/lib/auth';
import { getChallenge, getChallengeParticipant, getChallengeParticipants, getChallengeLeaderboard, computeChallengeProgress, computeChallengePace, saveChallenge } from '@/lib/data';
import { getChallengeDisplayStatus } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

    const myParticipant = await getChallengeParticipant(id, session.memberId);
    if (!myParticipant) return NextResponse.json({ error: 'You are not part of this challenge' }, { status: 403 });

    const isOwner = challenge.ownerId === session.memberId;
    const leaderboard = await getChallengeLeaderboard(challenge);
    const myProgressKm = await computeChallengeProgress(challenge, session.memberId);
    const pace = computeChallengePace(challenge, myProgressKm);
    const participants = isOwner ? await getChallengeParticipants(id) : undefined;

    return NextResponse.json({
      challenge, leaderboard, myParticipant, myProgressKm, pace, isOwner, participants,
      displayStatus: getChallengeDisplayStatus(challenge),
    });
  } catch { return NextResponse.json({ error: 'Failed to fetch challenge' }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.ownerId !== session.memberId) return NextResponse.json({ error: 'Only the owner can cancel this challenge' }, { status: 403 });

    if (challenge.status !== 'cancelled') {
      await saveChallenge({ ...challenge, status: 'cancelled' });
    }
    return NextResponse.json({ challenge: { ...challenge, status: 'cancelled' } });
  } catch { return NextResponse.json({ error: 'Failed to cancel challenge' }, { status: 500 }); }
}

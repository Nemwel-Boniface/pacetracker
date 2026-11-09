import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getChallenge, getChallengeParticipant, getChallengeParticipants, getChallengeLeaderboard, computeChallengeStats, computeChallengePace, saveChallenge } from '@/lib/data';
import { getChallengeDisplayStatus, isChallengeUpcoming, isChallengeFacilitator } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    // Trivia challenges have no participant/leaderboard flow — the page dispatches on `kind` and
    // fetches trivia state from /api/challenges/[id]/trivia (permission-checked there) instead.
    if (challenge.kind === 'trivia') return NextResponse.json({ kind: 'trivia', challenge });

    const myParticipant = await getChallengeParticipant(id, session.memberId);
    const isOpen = challenge.visibility === 'open';
    // Open challenges can be previewed by anyone (so they can decide to join); admins see everything.
    if (!myParticipant && !isOpen && !session.isAdmin) return NextResponse.json({ error: 'You are not part of this challenge' }, { status: 403 });

    const displayStatus = getChallengeDisplayStatus(challenge);
    const isOwner = challenge.ownerId === session.memberId;
    const isMember = myParticipant?.status === 'accepted';
    const isFacilitator = isChallengeFacilitator(challenge, session.memberId);
    const canInvite = displayStatus === 'active' && (isFacilitator || session.isAdmin || (isOpen && isMember));
    const canJoin = displayStatus === 'active' && isOpen && (!myParticipant || myParticipant.status === 'declined' || myParticipant.status === 'left');

    const leaderboard = await getChallengeLeaderboard(challenge);
    const myStats = await computeChallengeStats(challenge, session.memberId);
    const pace = computeChallengePace(challenge, myStats.km);
    const participants = canInvite || session.isAdmin ? await getChallengeParticipants(id) : undefined;

    return NextResponse.json({
      challenge, leaderboard, myParticipant, myMemberId: session.memberId, myProgressKm: myStats.km, myStats, pace,
      isOwner, canInvite, canJoin, canCancel: isOwner || session.isAdmin, participants, displayStatus,
      upcoming: isChallengeUpcoming(challenge), isAdmin: session.isAdmin, isFacilitator,
      canRequestFeature: isOwner && !session.isAdmin && displayStatus === 'active' && challenge.featureStatus !== 'featured' && challenge.featureStatus !== 'requested',
    });
  } catch { return NextResponse.json({ error: 'Failed to fetch challenge' }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.ownerId !== session.memberId && !session.isAdmin) return NextResponse.json({ error: 'Only the owner can cancel this challenge' }, { status: 403 });

    if (challenge.status !== 'cancelled') {
      await saveChallenge({ ...challenge, status: 'cancelled' });
    }
    return NextResponse.json({ challenge: { ...challenge, status: 'cancelled' } });
  } catch { return NextResponse.json({ error: 'Failed to cancel challenge' }, { status: 500 }); }
}

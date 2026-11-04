import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getChallenge, getChallengeParticipant, saveChallengeParticipant } from '@/lib/data';

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteCtx) {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.kind === 'trivia') return NextResponse.json({ error: 'Trivia challenges have no participant list to leave' }, { status: 400 });
    if (challenge.ownerId === session.memberId) return NextResponse.json({ error: 'Owners must cancel the challenge instead of leaving' }, { status: 403 });

    const participant = await getChallengeParticipant(id, session.memberId);
    if (!participant) return NextResponse.json({ error: 'You are not part of this challenge' }, { status: 404 });
    if (participant.status !== 'accepted') return NextResponse.json({ error: 'You have not joined this challenge' }, { status: 400 });

    await saveChallengeParticipant({ ...participant, status: 'left', respondedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Failed to leave challenge' }, { status: 500 }); }
}

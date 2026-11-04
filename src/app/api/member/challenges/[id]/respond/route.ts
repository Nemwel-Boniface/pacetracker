import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getChallenge, getChallengeParticipant, saveChallengeParticipant } from '@/lib/data';
import { getChallengeDisplayStatus } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const { action } = await req.json();
    if (action !== 'accept' && action !== 'decline') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const existingChallenge = await getChallenge(id);
    if (existingChallenge?.kind === 'trivia') return NextResponse.json({ error: 'Trivia challenges have no invites to respond to' }, { status: 400 });

    const participant = await getChallengeParticipant(id, session.memberId);
    if (!participant) return NextResponse.json({ error: 'You were not invited to this challenge' }, { status: 404 });
    if (participant.status !== 'pending') return NextResponse.json({ error: 'You have already responded to this invite' }, { status: 409 });

    if (action === 'accept') {
      if (!existingChallenge || getChallengeDisplayStatus(existingChallenge) !== 'active') {
        return NextResponse.json({ error: 'This challenge has already ended' }, { status: 400 });
      }
    }

    const updated = { ...participant, status: action === 'accept' ? 'accepted' as const : 'declined' as const, respondedAt: new Date().toISOString() };
    await saveChallengeParticipant(updated);
    return NextResponse.json({ participant: updated });
  } catch { return NextResponse.json({ error: 'Failed to respond to invite' }, { status: 500 }); }
}

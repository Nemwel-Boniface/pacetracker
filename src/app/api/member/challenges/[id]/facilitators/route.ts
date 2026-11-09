import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getChallenge, saveChallenge, resolveCoFacilitators, joinCoFacilitators } from '@/lib/data';
import { Challenge, getChallengeDisplayStatus } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

// Owner (or admin) replaces the co-facilitator list. New ones are joined automatically; anyone removed
// stays a participant, they just lose the facilitator label and invite rights.
export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.kind === 'trivia') return NextResponse.json({ error: 'Trivia challenges have no co-facilitators' }, { status: 400 });
    if (challenge.ownerId !== session.memberId && !session.isAdmin) return NextResponse.json({ error: 'Only the owner can change co-facilitators' }, { status: 403 });
    if (getChallengeDisplayStatus(challenge) !== 'active') return NextResponse.json({ error: 'This challenge is no longer active' }, { status: 400 });

    const { memberIds } = await req.json();
    const resolved = await resolveCoFacilitators(challenge.ownerId, memberIds);
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });

    const updated: Challenge = { ...challenge, coFacilitators: resolved.coFacilitators };
    if (resolved.coFacilitators.length === 0) delete updated.coFacilitators;
    await saveChallenge(updated);
    await joinCoFacilitators(updated);
    return NextResponse.json({ challenge: updated });
  } catch { return NextResponse.json({ error: 'Failed to update co-facilitators' }, { status: 500 }); }
}

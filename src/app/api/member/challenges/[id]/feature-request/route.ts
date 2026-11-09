import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getChallenge, saveChallenge } from '@/lib/data';
import { getChallengeDisplayStatus, CHALLENGE_DESCRIPTION_MAX } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

// The owner asks an admin to put their challenge on the main page. Only an admin can actually feature it.
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.kind === 'trivia') return NextResponse.json({ error: 'Only distance challenges can be featured' }, { status: 400 });
    if (challenge.ownerId !== session.memberId) return NextResponse.json({ error: 'Only the owner can request this' }, { status: 403 });
    if (getChallengeDisplayStatus(challenge) !== 'active') return NextResponse.json({ error: 'This challenge is no longer active' }, { status: 400 });
    if (challenge.featureStatus === 'featured') return NextResponse.json({ error: 'This challenge is already featured' }, { status: 409 });

    const { description } = await req.json();
    const trimmed = typeof description === 'string' ? description.trim() : '';
    if (!trimmed) return NextResponse.json({ error: 'Add a description so people know what the challenge is about' }, { status: 400 });
    if (trimmed.length > CHALLENGE_DESCRIPTION_MAX) return NextResponse.json({ error: `Description is too long (max ${CHALLENGE_DESCRIPTION_MAX} characters)` }, { status: 400 });

    const updated = { ...challenge, description: trimmed, featureStatus: 'requested' as const };
    await saveChallenge(updated);
    return NextResponse.json({ challenge: updated });
  } catch { return NextResponse.json({ error: 'Failed to request feature' }, { status: 500 }); }
}

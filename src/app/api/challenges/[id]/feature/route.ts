import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getChallenge, saveChallenge, getFeatureCapacity } from '@/lib/data';
import { Challenge, getChallengeDisplayStatus, CHALLENGE_DESCRIPTION_MAX } from '@/types';

type RouteCtx = { params: Promise<{ id: string }> };

// Admin-only: feature a challenge on the main page, take it off, or decline a member's request.
// Featuring past the limit returns 409 `cap_reached` until the admin confirms with `override: true`.
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const challenge = await getChallenge(id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.kind === 'trivia') return NextResponse.json({ error: 'Only distance challenges can be featured' }, { status: 400 });

    const { action, override, description } = await req.json();
    let updated: Challenge;

    if (action === 'feature') {
      if (getChallengeDisplayStatus(challenge) !== 'active') return NextResponse.json({ error: 'Only active challenges can be featured' }, { status: 400 });
      const desc = typeof description === 'string' && description.trim() ? description.trim() : challenge.description?.trim();
      if (!desc) return NextResponse.json({ error: 'Add a description before featuring this challenge' }, { status: 400 });
      if (desc.length > CHALLENGE_DESCRIPTION_MAX) return NextResponse.json({ error: `Description is too long (max ${CHALLENGE_DESCRIPTION_MAX} characters)` }, { status: 400 });
      if (override !== true) {
        const cap = await getFeatureCapacity(id);
        if (cap.full) return NextResponse.json({ error: `${cap.current} challenges are already featured (limit ${cap.max})`, code: 'cap_reached', ...cap }, { status: 409 });
      }
      // Featured challenges must be joinable by anyone who sees them.
      updated = { ...challenge, description: desc, visibility: 'open', featureStatus: 'featured', featuredAt: new Date().toISOString() };
    } else if (action === 'unfeature' || action === 'decline') {
      updated = { ...challenge, featureStatus: 'declined' };
      delete updated.featuredAt;
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    await saveChallenge(updated);
    return NextResponse.json({ challenge: updated });
  } catch { return NextResponse.json({ error: 'Failed to update challenge' }, { status: 500 }); }
}

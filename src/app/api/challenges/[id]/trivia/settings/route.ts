import { NextRequest, NextResponse } from 'next/server';
import { getChallenge } from '@/lib/data';
import { getTriviaGame, saveTriviaGame, publishTriviaUpdate, canManageTrivia, updateSettings, assertSameChallenge, TriviaVisibility } from '@/lib/trivia';

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia challenge not found' }, { status: 404 });
  if (!await canManageTrivia(challenge)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { posterImageUrl?: string; visibility?: TriviaVisibility; scheduledAt?: string | null };
  if (body.visibility !== undefined && body.visibility !== 'public' && body.visibility !== 'private') {
    return NextResponse.json({ error: 'Visibility must be public or private' }, { status: 400 });
  }
  if (body.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid scheduled date' }, { status: 400 });
    body.scheduledAt = d.toISOString();
  }
  const existing = await getTriviaGame(id);
  if (!existing) return NextResponse.json({ error: 'Trivia game not found' }, { status: 404 });
  const game = updateSettings(existing, body);
  assertSameChallenge(id, game);
  await saveTriviaGame(game);
  await publishTriviaUpdate(game);
  return NextResponse.json({ game });
}

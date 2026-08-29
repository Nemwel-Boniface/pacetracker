import { NextRequest, NextResponse } from 'next/server';
import { getChallenge } from '@/lib/data';
import { getTriviaGame, saveTriviaGame, publishTriviaUpdate, canManageTrivia, setTimerSeconds, assertSameChallenge } from '@/lib/trivia';

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia challenge not found' }, { status: 404 });
  if (!await canManageTrivia(challenge)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { seconds } = await req.json() as { seconds: number };
  const existing = await getTriviaGame(id);
  if (!existing) return NextResponse.json({ error: 'Trivia game not found' }, { status: 404 });
  try {
    const game = setTimerSeconds(existing, seconds);
    assertSameChallenge(id, game);
    await saveTriviaGame(game);
    await publishTriviaUpdate(game);
    return NextResponse.json({ game });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

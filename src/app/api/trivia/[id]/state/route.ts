import { NextRequest, NextResponse } from 'next/server';
import { getMemberSession } from '@/lib/auth';
import { getChallenge } from '@/lib/data';
import { getTriviaGame, publicTriviaView } from '@/lib/trivia';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia not found' }, { status: 404 });
  const game = await getTriviaGame(id);
  if (!game) return NextResponse.json({ error: 'Trivia not found' }, { status: 404 });
  if (game.visibility === 'private' && !await getMemberSession()) {
    return NextResponse.json({ error: 'Sign in to watch this trivia', locked: true }, { status: 403 });
  }
  return NextResponse.json(publicTriviaView(game));
}

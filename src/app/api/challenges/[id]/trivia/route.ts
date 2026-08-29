import { NextRequest, NextResponse } from 'next/server';
import { getChallenge } from '@/lib/data';
import { getTriviaGame, canManageTrivia, nextUpPreview } from '@/lib/trivia';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia challenge not found' }, { status: 404 });
  const manager = await canManageTrivia(challenge);
  if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const game = await getTriviaGame(id);
  if (!game) return NextResponse.json({ error: 'Trivia game not found' }, { status: 404 });
  return NextResponse.json({ game, nextUp: nextUpPreview(game), role: manager.role });
}

import { NextRequest, NextResponse } from 'next/server';
import { getChallenge } from '@/lib/data';
import { getTriviaGame, saveTriviaGame, publishTriviaUpdate, canManageTrivia, addTeam, removeTeam, assertSameChallenge } from '@/lib/trivia';

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia challenge not found' }, { status: 404 });
  if (!await canManageTrivia(challenge)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json() as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
  const existing = await getTriviaGame(id);
  if (!existing) return NextResponse.json({ error: 'Trivia game not found' }, { status: 404 });
  try {
    const game = addTeam(existing, name.trim());
    assertSameChallenge(id, game);
    await saveTriviaGame(game);
    await publishTriviaUpdate(game);
    return NextResponse.json({ game });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia challenge not found' }, { status: 404 });
  if (!await canManageTrivia(challenge)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { teamId } = await req.json() as { teamId: string };
  if (!teamId) return NextResponse.json({ error: 'Team is required' }, { status: 400 });
  const existing = await getTriviaGame(id);
  if (!existing) return NextResponse.json({ error: 'Trivia game not found' }, { status: 404 });
  try {
    const game = removeTeam(existing, teamId);
    assertSameChallenge(id, game);
    await saveTriviaGame(game);
    await publishTriviaUpdate(game);
    return NextResponse.json({ game });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

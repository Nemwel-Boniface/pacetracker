import { NextRequest, NextResponse } from 'next/server';
import { getChallenge, getMember } from '@/lib/data';
import { getTriviaGame, saveTriviaGame, publishTriviaUpdate, canManageTrivia, addTeamMember, removeTeamMember, assertSameChallenge } from '@/lib/trivia';

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia challenge not found' }, { status: 404 });
  if (!await canManageTrivia(challenge)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { teamId, name, memberId } = await req.json() as { teamId: string; name?: string; memberId?: string };
  if (!teamId) return NextResponse.json({ error: 'Team is required' }, { status: 400 });

  let memberName = name?.trim();
  if (memberId) {
    const found = await getMember(memberId);
    if (!found || !found.isActive || found.isShadowUser) return NextResponse.json({ error: 'Selected member is not eligible' }, { status: 400 });
    memberName = found.name;
  }
  if (!memberName) return NextResponse.json({ error: 'A name or member is required' }, { status: 400 });

  const existing = await getTriviaGame(id);
  if (!existing) return NextResponse.json({ error: 'Trivia game not found' }, { status: 404 });
  const game = addTeamMember(existing, teamId, memberName, memberId);
  assertSameChallenge(id, game);
  await saveTriviaGame(game);
  await publishTriviaUpdate(game);
  return NextResponse.json({ game });
}

export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia challenge not found' }, { status: 404 });
  if (!await canManageTrivia(challenge)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { teamId, memberId } = await req.json() as { teamId: string; memberId: string };
  if (!teamId || !memberId) return NextResponse.json({ error: 'Team and member are required' }, { status: 400 });
  const existing = await getTriviaGame(id);
  if (!existing) return NextResponse.json({ error: 'Trivia game not found' }, { status: 404 });
  const game = removeTeamMember(existing, teamId, memberId);
  assertSameChallenge(id, game);
  await saveTriviaGame(game);
  await publishTriviaUpdate(game);
  return NextResponse.json({ game });
}

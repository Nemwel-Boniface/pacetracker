import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getMethaliGame, saveMethaliGame, publishMethaliUpdate, addMember, removeMember, MethaliTeamId } from '@/lib/methali';

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { teamId, name } = await req.json() as { teamId: MethaliTeamId; name: string };
  if (!teamId || !name?.trim()) return NextResponse.json({ error: 'Team and name are required' }, { status: 400 });
  const game = addMember(await getMethaliGame(), teamId, name.trim());
  await saveMethaliGame(game);
  await publishMethaliUpdate(game);
  return NextResponse.json({ game });
}

export async function DELETE(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { teamId, memberId } = await req.json() as { teamId: MethaliTeamId; memberId: string };
  if (!teamId || !memberId) return NextResponse.json({ error: 'Team and member are required' }, { status: 400 });
  const game = removeMember(await getMethaliGame(), teamId, memberId);
  await saveMethaliGame(game);
  await publishMethaliUpdate(game);
  return NextResponse.json({ game });
}

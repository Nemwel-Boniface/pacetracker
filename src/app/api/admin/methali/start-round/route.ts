import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getMethaliGame, saveMethaliGame, publishMethaliUpdate, startRound, nextUpPreview, MethaliTeamId } from '@/lib/methali';

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { teamId } = await req.json().catch(() => ({})) as { teamId?: MethaliTeamId };
  try {
    const game = startRound(await getMethaliGame(), { teamId });
    await saveMethaliGame(game);
    await publishMethaliUpdate(game);
    return NextResponse.json({ game, nextUp: nextUpPreview(game) });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

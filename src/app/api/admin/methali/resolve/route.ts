import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getMethaliGame, saveMethaliGame, publishMethaliUpdate, resolveRound, nextUpPreview, MethaliOutcome } from '@/lib/methali';

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { outcome } = await req.json() as { outcome: MethaliOutcome };
  try {
    const game = resolveRound(await getMethaliGame(), outcome);
    await saveMethaliGame(game);
    await publishMethaliUpdate(game);
    return NextResponse.json({ game, nextUp: nextUpPreview(game) });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

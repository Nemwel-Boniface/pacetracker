import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getMethaliGame, saveMethaliGame, publishMethaliUpdate, setPhase, nextUpPreview, MethaliPhase } from '@/lib/methali';

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { phase } = await req.json() as { phase: MethaliPhase };
  try {
    const game = setPhase(await getMethaliGame(), phase);
    await saveMethaliGame(game);
    await publishMethaliUpdate(game);
    return NextResponse.json({ game, nextUp: nextUpPreview(game) });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

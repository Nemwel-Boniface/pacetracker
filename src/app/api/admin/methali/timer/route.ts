import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getMethaliGame, saveMethaliGame, publishMethaliUpdate, setTimerSeconds } from '@/lib/methali';

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { seconds } = await req.json() as { seconds: number };
  try {
    const game = setTimerSeconds(await getMethaliGame(), seconds);
    await saveMethaliGame(game);
    await publishMethaliUpdate(game);
    return NextResponse.json({ game });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

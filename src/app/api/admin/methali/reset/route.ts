import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getMethaliGame, saveMethaliGame, publishMethaliUpdate, resetGame, nextUpPreview } from '@/lib/methali';

export async function POST() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const game = resetGame(await getMethaliGame());
  await saveMethaliGame(game);
  await publishMethaliUpdate(game);
  return NextResponse.json({ game, nextUp: nextUpPreview(game) });
}

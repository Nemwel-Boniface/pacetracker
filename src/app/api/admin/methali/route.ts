import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getMethaliGame, nextUpPreview } from '@/lib/methali';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const game = await getMethaliGame();
  return NextResponse.json({ game, nextUp: nextUpPreview(game) });
}

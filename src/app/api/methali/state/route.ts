import { NextResponse } from 'next/server';
import { getMethaliGame, publicMethaliView } from '@/lib/methali';

export async function GET() {
  const game = await getMethaliGame();
  return NextResponse.json(publicMethaliView(game));
}

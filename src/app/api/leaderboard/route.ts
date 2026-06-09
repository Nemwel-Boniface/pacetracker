import { NextResponse } from 'next/server';
import { getAllMemberStats, getVisibleWinners, getVisiblePrizes } from '@/lib/data';
export async function GET() {
  try {
    const [stats, winners, prizes] = await Promise.all([getAllMemberStats(), getVisibleWinners(), getVisiblePrizes()]);
    return NextResponse.json({ stats, winners, prizes });
  } catch { return NextResponse.json({ stats: [], winners: [], prizes: [] }); }
}
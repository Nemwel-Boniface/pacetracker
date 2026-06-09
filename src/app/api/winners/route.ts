import { NextRequest, NextResponse } from 'next/server';
import { getAllWinners, saveWinner, deleteWinner } from '@/lib/data';
import { getAdminSession } from '@/lib/auth';
import { Winner } from '@/types';
import { v4 as uuidv4 } from 'uuid';
export async function GET() {
  try { return NextResponse.json({ winners: await getAllWinners() }); } catch { return NextResponse.json({ winners: [] }); }
}
export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { prizeCategoryId, prizeCategoryName, memberId, memberName, country, isVisible } = await req.json();
  if (!memberId || !prizeCategoryId) return NextResponse.json({ error: 'memberId and prizeCategoryId required' }, { status: 400 });
  const winner: Winner = { id: uuidv4(), prizeCategoryId, prizeCategoryName, memberId, memberName, country, isVisible: isVisible ?? false, announcedAt: new Date().toISOString() };
  await saveWinner(winner); return NextResponse.json({ winner }, { status: 201 });
}
export async function PATCH(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ...updates } = await req.json();
  const winners = await getAllWinners(); const existing = winners.find(w => w.id === id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updated = { ...existing, ...updates, id: existing.id };
  await saveWinner(updated); return NextResponse.json({ winner: updated });
}
export async function DELETE(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  await deleteWinner(id); return NextResponse.json({ success: true });
}
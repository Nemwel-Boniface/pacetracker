import { NextRequest, NextResponse } from 'next/server';
import { getAllPrizes, savePrize, deletePrize } from '@/lib/data';
import { getAdminSession } from '@/lib/auth';
import { PrizeCategory } from '@/types';
import { v4 as uuidv4 } from 'uuid';
export async function GET() {
  try { return NextResponse.json({ prizes: await getAllPrizes() }); } catch { return NextResponse.json({ prizes: [] }); }
}
export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, amount, description, criteria, isVisible } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const prize: PrizeCategory = { id: uuidv4(), name: name.trim(), amount: Number(amount) || 0, description: description?.trim() || '', criteria: criteria?.trim() || '', isVisible: isVisible ?? false, createdAt: new Date().toISOString() };
  await savePrize(prize); return NextResponse.json({ prize }, { status: 201 });
}
export async function PATCH(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ...updates } = await req.json();
  const prizes = await getAllPrizes(); const existing = prizes.find(p => p.id === id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updated = { ...existing, ...updates, id: existing.id, createdAt: existing.createdAt };
  await savePrize(updated); return NextResponse.json({ prize: updated });
}
export async function DELETE(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  await deletePrize(id); return NextResponse.json({ success: true });
}
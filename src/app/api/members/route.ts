import { NextRequest, NextResponse } from 'next/server';
import { getAllMembers, saveMember, deleteMember, toggleMemberActive, getMember, getActiveCountries, sanitizeMember } from '@/lib/data';
import { getAdminSession } from '@/lib/auth';
import { Member } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const members = await getAllMembers(); return NextResponse.json({ members: members.map(sanitizeMember) }); }
  catch { return NextResponse.json({ members: [] }); }
}
export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { name, email, country } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const activeCountries = await getActiveCountries();
    if (!activeCountries.some(c => c.name === country)) return NextResponse.json({ error: 'Invalid country' }, { status: 400 });
    const member: Member = { id: uuidv4(), name: name.trim(), email: email?.trim() || '', country, isActive: true, joinedAt: new Date().toISOString(), avatarInitials: name.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) };
    await saveMember(member);
    return NextResponse.json({ member: sanitizeMember(member) }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to create member' }, { status: 500 }); }
}
export async function PATCH(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, action, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    if (action === 'toggle') { const m = await toggleMemberActive(id); return NextResponse.json({ member: m ? sanitizeMember(m) : null }); }
    const existing = await getMember(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = { ...existing, ...updates, id: existing.id, joinedAt: existing.joinedAt, passwordHash: existing.passwordHash };
    await saveMember(updated); return NextResponse.json({ member: sanitizeMember(updated) });
  } catch { return NextResponse.json({ error: 'Failed to update' }, { status: 500 }); }
}
export async function DELETE(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try { await deleteMember(id); return NextResponse.json({ success: true }); }
  catch { return NextResponse.json({ error: 'Failed to delete' }, { status: 500 }); }
}

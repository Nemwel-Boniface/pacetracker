import { NextResponse } from 'next/server';
import { getMemberSession } from '@/lib/auth';
import { getAllMembers } from '@/lib/data';

export async function GET() {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const members = await getAllMembers();
    const peers = members
      .filter(m => m.isActive && !m.isShadowUser && m.id !== session.memberId)
      .map(m => ({ id: m.id, name: m.name, avatarInitials: m.avatarInitials }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ peers });
  } catch { return NextResponse.json({ error: 'Failed to fetch peers' }, { status: 500 }); }
}

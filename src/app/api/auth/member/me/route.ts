import { NextResponse } from 'next/server';
import { getMemberSession } from '@/lib/auth';
import { getMember, sanitizeMember } from '@/lib/data';

export async function GET() {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const member = await getMember(session.memberId);
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  return NextResponse.json({ member: sanitizeMember(member) });
}

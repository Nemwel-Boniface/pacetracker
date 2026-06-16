import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getMemberSession, createMemberToken, getMemberCookieOptions } from '@/lib/auth';
import { getMember, saveMember } from '@/lib/data';

export async function POST(req: NextRequest) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { newPassword } = await req.json();
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    const member = await getMember(session.memberId);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (!member.isInvited || member.inviteAccepted) {
      return NextResponse.json({ error: 'Password change not required for this account' }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await saveMember({ ...member, passwordHash, inviteAccepted: true });
    // Issue a new token without the pch (requires password change) flag
    const token = await createMemberToken(member.id, member.email, false);
    const opts = getMemberCookieOptions();
    const res = NextResponse.json({ success: true });
    res.cookies.set({ name: opts.name, value: token, httpOnly: opts.httpOnly, secure: opts.secure, sameSite: opts.sameSite, maxAge: opts.maxAge, path: opts.path });
    return res;
  } catch { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}

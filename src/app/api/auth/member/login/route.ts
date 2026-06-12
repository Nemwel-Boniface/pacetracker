import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getMemberIdByEmail, getMember } from '@/lib/data';
import { createMemberToken, getMemberCookieOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

    const memberId = await getMemberIdByEmail(email.trim());
    if (!memberId) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    const member = await getMember(memberId);
    if (!member || !member.passwordHash) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    if (!member.isActive) return NextResponse.json({ error: 'Your account has been deactivated. Contact the admin.' }, { status: 403 });

    const valid = await bcrypt.compare(password, member.passwordHash);
    if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    const token = await createMemberToken(member.id, member.email);
    const opts = getMemberCookieOptions();
    const res = NextResponse.json({ success: true });
    res.cookies.set({ name: opts.name, value: token, httpOnly: opts.httpOnly, secure: opts.secure, sameSite: opts.sameSite, maxAge: opts.maxAge, path: opts.path });
    return res;
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getMember, saveMember } from '@/lib/data';
import { getRedis, KEYS } from '@/lib/redis';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const r = getRedis();
    const memberId = await r.get<string>(KEYS.resetToken(token));
    if (!memberId) return NextResponse.json({ error: 'Reset link is invalid or has expired' }, { status: 400 });

    const member = await getMember(memberId);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const passwordHash = await bcrypt.hash(password, 12);
    await saveMember({ ...member, passwordHash });
    // Invalidate the token immediately after use
    await r.del(KEYS.resetToken(token));

    return NextResponse.json({ success: true });
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}

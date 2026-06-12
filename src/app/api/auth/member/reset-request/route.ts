import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMemberIdByEmail, getMember } from '@/lib/data';
import { getRedis, KEYS } from '@/lib/redis';

const TOKEN_TTL = 3600; // 1 hour in seconds

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const memberId = await getMemberIdByEmail(email.trim());
    // Always return success to avoid email enumeration
    if (!memberId) return NextResponse.json({ success: true, hasToken: false });

    const member = await getMember(memberId);
    if (!member?.passwordHash) return NextResponse.json({ success: true, hasToken: false });

    const token = uuidv4();
    await getRedis().set(KEYS.resetToken(token), memberId, { ex: TOKEN_TTL });

    return NextResponse.json({ success: true, hasToken: true, token, expiresInMinutes: 60 });
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}

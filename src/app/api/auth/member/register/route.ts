import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getMemberIdByEmail, setEmailIndex, saveMember, getActiveCountries } from '@/lib/data';
import { createMemberToken, getMemberCookieOptions } from '@/lib/auth';
import { Member } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, country } = await req.json();
    if (!name?.trim() || !email?.trim() || !password || !country) return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const activeCountries = await getActiveCountries();
    if (!activeCountries.some(c => c.name === country)) return NextResponse.json({ error: 'Invalid country' }, { status: 400 });

    const existing = await getMemberIdByEmail(email.trim());
    if (existing) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const member: Member = {
      id, name: name.trim(), email: email.trim().toLowerCase(), country, isActive: true,
      joinedAt: new Date().toISOString(),
      avatarInitials: name.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      passwordHash, selfRegistered: true,
    };
    await saveMember(member);
    await setEmailIndex(email.trim(), id);

    const token = await createMemberToken(id, email.trim().toLowerCase());
    const opts = getMemberCookieOptions();
    const res = NextResponse.json({ success: true, memberId: id }, { status: 201 });
    res.cookies.set({ name: opts.name, value: token, httpOnly: opts.httpOnly, secure: opts.secure, sameSite: opts.sameSite, maxAge: opts.maxAge, path: opts.path });
    return res;
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}

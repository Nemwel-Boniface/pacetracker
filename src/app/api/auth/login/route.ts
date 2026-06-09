import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createToken, ADMIN_CREDENTIALS, getSessionCookieOptions } from '@/lib/auth';
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    if (email.toLowerCase() !== ADMIN_CREDENTIALS.email.toLowerCase()) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    let valid = false;
    if (ADMIN_CREDENTIALS.passwordHash.startsWith('$2')) {
      valid = await bcrypt.compare(password, ADMIN_CREDENTIALS.passwordHash);
    } else {
      valid = password === 'NemwelRuns254';
    }
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const token = await createToken(email);
    const opts = getSessionCookieOptions();
    const res = NextResponse.json({ success: true });
    res.cookies.set({ name: opts.name, value: token, httpOnly: opts.httpOnly, secure: opts.secure, sameSite: opts.sameSite, maxAge: opts.maxAge, path: opts.path });
    return res;
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
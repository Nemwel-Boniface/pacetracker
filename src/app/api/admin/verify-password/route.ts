import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminSession, ADMIN_CREDENTIALS } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { password } = await req.json();
    if (!password) return NextResponse.json({ valid: false });
    let valid = false;
    if (ADMIN_CREDENTIALS.passwordHash.startsWith('$2')) {
      valid = await bcrypt.compare(password, ADMIN_CREDENTIALS.passwordHash);
    } else {
      valid = password === 'NemwelRuns254';
    }
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

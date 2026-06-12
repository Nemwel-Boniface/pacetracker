import { NextResponse } from 'next/server';
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({ name: 'pt_member_session', value: '', httpOnly: true, maxAge: 0, path: '/' });
  return res;
}

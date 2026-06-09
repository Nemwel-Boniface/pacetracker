import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'pacetracker-fallback-secret-32-chars!!');
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin-move2026') && pathname !== '/admin-move2026/login') {
    const token = request.cookies.get('pt_admin_session')?.value;
    if (!token) return NextResponse.redirect(new URL('/admin-move2026/login', request.url));
    try { await jwtVerify(token, SECRET); return NextResponse.next(); }
    catch { const r = NextResponse.redirect(new URL('/admin-move2026/login', request.url)); r.cookies.delete('pt_admin_session'); return r; }
  }
  return NextResponse.next();
}
export const config = { matcher: ['/admin-move2026/:path*'] };
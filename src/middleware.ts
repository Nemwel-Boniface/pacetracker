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

  if (pathname.startsWith('/member')) {
    const token = request.cookies.get('pt_member_session')?.value;
    if (!token) return NextResponse.redirect(new URL('/authenticate', request.url));
    try {
      const { payload } = await jwtVerify(token, SECRET);
      if (payload.role !== 'member') throw new Error('not a member token');
      if (payload.pch && pathname !== '/member/change-password') {
        return NextResponse.redirect(new URL('/member/change-password', request.url));
      }
      return NextResponse.next();
    } catch { const r = NextResponse.redirect(new URL('/authenticate', request.url)); r.cookies.delete('pt_member_session'); return r; }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin-move2026/:path*', '/member/:path*'] };

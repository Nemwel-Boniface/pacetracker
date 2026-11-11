import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'pacetracker-fallback-secret-32-chars!!');
// Keep in sync with MEMBER_SESSION_DAYS in lib/auth.ts.
const MEMBER_SESSION_DAYS = 30;
// Renew the member token at most once a day while they keep using the app.
const MEMBER_REFRESH_AFTER_SECONDS = 86400;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin-move2026') && pathname !== '/admin-move2026/login') {
    const token = request.cookies.get('pt_admin_session')?.value;
    if (!token) return NextResponse.redirect(new URL('/admin-move2026/login', request.url));
    try { await jwtVerify(token, SECRET); return NextResponse.next(); }
    catch { const r = NextResponse.redirect(new URL('/admin-move2026/login', request.url)); r.cookies.delete('pt_admin_session'); return r; }
  }

  if (pathname.startsWith('/member')) {
    // After signing in again, send them back to the page they were trying to open.
    const loginUrl = new URL(`/authenticate?next=${encodeURIComponent(pathname)}`, request.url);
    const token = request.cookies.get('pt_member_session')?.value;
    if (!token) return NextResponse.redirect(loginUrl);
    try {
      const { payload } = await jwtVerify(token, SECRET);
      if (payload.role !== 'member') throw new Error('not a member token');
      if (payload.pch && pathname !== '/member/change-password') {
        return NextResponse.redirect(new URL('/member/change-password', request.url));
      }
      const res = NextResponse.next();
      const age = Math.floor(Date.now() / 1000) - (payload.iat ?? 0);
      if (age > MEMBER_REFRESH_AFTER_SECONDS) {
        const claims: Record<string, unknown> = { sub: payload.sub, email: payload.email, role: 'member' };
        if (payload.pch) claims.pch = true;
        const fresh = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${MEMBER_SESSION_DAYS}d`).sign(SECRET);
        res.cookies.set({ name: 'pt_member_session', value: fresh, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: MEMBER_SESSION_DAYS * 86400, path: '/' });
      }
      return res;
    } catch { const r = NextResponse.redirect(loginUrl); r.cookies.delete('pt_member_session'); return r; }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin-move2026/:path*', '/member/:path*'] };

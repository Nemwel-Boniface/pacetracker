import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'pacetracker-fallback-secret-32-chars!!');
const ADMIN_COOKIE = 'pt_admin_session';
const MEMBER_COOKIE = 'pt_member_session';

export const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'n.nyandoro@edencaremedical.com',
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
};

// ─── Admin auth ──────────────────────────────────────────────────────────────
export async function createToken(email: string): Promise<string> {
  return await new SignJWT({ email, role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(SECRET);
}
export async function verifyToken(token: string): Promise<{ email: string; role: string } | null> {
  try { const { payload } = await jwtVerify(token, SECRET); return payload as { email: string; role: string }; } catch { return null; }
}
export async function getAdminSession(): Promise<{ email: string; role: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
export function getSessionCookieOptions() {
  return { name: ADMIN_COOKIE, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 86400, path: '/' };
}

// ─── Member auth ─────────────────────────────────────────────────────────────
export async function createMemberToken(memberId: string, email: string): Promise<string> {
  return await new SignJWT({ sub: memberId, email, role: 'member' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(SECRET);
}
export async function verifyMemberToken(token: string): Promise<{ sub: string; email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.role !== 'member') return null;
    return payload as { sub: string; email: string; role: string };
  } catch { return null; }
}
export async function getMemberSession(): Promise<{ memberId: string; email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyMemberToken(token);
  if (!payload) return null;
  return { memberId: payload.sub, email: payload.email };
}
export function getMemberCookieOptions() {
  return { name: MEMBER_COOKIE, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 86400, path: '/' };
}

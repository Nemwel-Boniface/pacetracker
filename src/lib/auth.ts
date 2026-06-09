import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'pacetracker-fallback-secret-32-chars!!');
const COOKIE_NAME = 'pt_admin_session';
export const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'n.nyandoro@edencaremedical.com',
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
};
export async function createToken(email: string): Promise<string> {
  return await new SignJWT({ email, role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(SECRET);
}
export async function verifyToken(token: string): Promise<{ email: string; role: string } | null> {
  try { const { payload } = await jwtVerify(token, SECRET); return payload as { email: string; role: string }; } catch { return null; }
}
export async function getAdminSession(): Promise<{ email: string; role: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
export function getSessionCookieOptions() {
  return { name: COOKIE_NAME, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 86400, path: '/' };
}
import { NextResponse } from 'next/server';
export async function POST() { const r = NextResponse.json({ success: true }); r.cookies.delete('pt_admin_session'); return r; }
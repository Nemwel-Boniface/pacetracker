import { NextRequest, NextResponse } from 'next/server';
import { toggleCountry, deleteCountry } from '@/lib/data';
import { getAdminSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  const name = decodeURIComponent(slug).replace(/_/g, ' ');
  try {
    const country = await toggleCountry(name);
    if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 });
    return NextResponse.json({ country });
  } catch { return NextResponse.json({ error: 'Failed to toggle country' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  const name = decodeURIComponent(slug).replace(/_/g, ' ');
  try { await deleteCountry(name); return NextResponse.json({ success: true }); }
  catch { return NextResponse.json({ error: 'Failed to delete country' }, { status: 500 }); }
}

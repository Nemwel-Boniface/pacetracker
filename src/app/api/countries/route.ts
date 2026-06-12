import { NextRequest, NextResponse } from 'next/server';
import { getAllCountries, saveCountry } from '@/lib/data';
import { getAdminSession } from '@/lib/auth';
import { CountryConfig } from '@/types';

export async function GET() {
  try { const countries = await getAllCountries(); return NextResponse.json({ countries }); }
  catch { return NextResponse.json({ countries: [] }); }
}

export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { name, flag } = await req.json();
    if (!name?.trim() || !flag?.trim()) return NextResponse.json({ error: 'Name and flag required' }, { status: 400 });
    const existing = await getAllCountries();
    if (existing.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) return NextResponse.json({ error: 'Country already exists' }, { status: 409 });
    const country: CountryConfig = { name: name.trim(), flag: flag.trim(), isActive: true };
    await saveCountry(country);
    return NextResponse.json({ country }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to add country' }, { status: 500 }); }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getRedis, KEYS } from '@/lib/redis';

export interface AppSettings {
  marathonBannerEnabled: boolean;
  marathonCountries: string[]; // empty = all countries; specific names = only those
}

const DEFAULTS: AppSettings = { marathonBannerEnabled: true, marathonCountries: [] };

async function readSettings(): Promise<AppSettings> {
  try {
    const s = await getRedis().get<AppSettings>(KEYS.settings);
    return s ? { ...DEFAULTS, ...s } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: DEFAULTS });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const updates = await req.json();
    const current = await readSettings();
    const updated = { ...current, ...updates };
    await getRedis().set(KEYS.settings, updated);
    return NextResponse.json({ settings: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

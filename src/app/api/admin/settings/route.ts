import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getRedis, KEYS } from '@/lib/redis';
import { getAppSettings } from '@/lib/data';
import { DEFAULT_APP_SETTINGS } from '@/types';

export async function GET() {
  try {
    const settings = await getAppSettings();
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: DEFAULT_APP_SETTINGS });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const updates = await req.json();
    if ('maxFeaturedChallenges' in updates) {
      const max = Number(updates.maxFeaturedChallenges);
      if (!Number.isInteger(max) || max < 1 || max > 20) return NextResponse.json({ error: 'Featured limit must be a whole number from 1 to 20' }, { status: 400 });
      updates.maxFeaturedChallenges = max;
    }
    const current = await getAppSettings();
    const updated = { ...current, ...updates };
    await getRedis().set(KEYS.settings, updated);
    return NextResponse.json({ settings: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

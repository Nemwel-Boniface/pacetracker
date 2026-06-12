import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getRedis } from '@/lib/redis';

export async function DELETE() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await getRedis().flushdb();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to purge data' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getRedis } from '@/lib/redis';

export async function DELETE() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const r = getRedis();
    let cursor = 0;
    let deleted = 0;
    do {
      const [next, keys] = await r.scan(cursor, { match: 'pt:*', count: 100 });
      cursor = Number(next);
      if (keys.length > 0) {
        await r.del(...(keys as [string, ...string[]]));
        deleted += keys.length;
      }
    } while (cursor !== 0);
    return NextResponse.json({ success: true, deleted });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to purge data' }, { status: 500 });
  }
}

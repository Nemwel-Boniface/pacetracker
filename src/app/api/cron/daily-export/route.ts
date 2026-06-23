import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { generateExportBuffer } from '@/lib/export';

const META_KEY = 'pt:export:meta';
const DATA_KEY = 'pt:export:latest';
const TTL_SECONDS = 72 * 3600; // keep last 3 days

export async function GET(req: NextRequest) {
  // Vercel cron passes Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected && auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const buf = await generateExportBuffer();
    const base64 = buf.toString('base64');
    const r = getRedis();
    await Promise.all([
      r.set(DATA_KEY, base64, { ex: TTL_SECONDS }),
      r.set(META_KEY, { generatedAt: new Date().toISOString(), sizeBytes: buf.length }, { ex: TTL_SECONDS }),
    ]);
    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), sizeBytes: buf.length });
  } catch (err) {
    return NextResponse.json({ error: 'Export failed', detail: String(err) }, { status: 500 });
  }
}

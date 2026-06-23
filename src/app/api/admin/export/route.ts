import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getRedis } from '@/lib/redis';
import { generateExportBuffer } from '@/lib/export';

const META_KEY = 'pt:export:meta';
const DATA_KEY = 'pt:export:latest';

// GET /api/admin/export         → generate fresh export and download
// GET /api/admin/export?cached  → download last scheduled export from Redis
// GET /api/admin/export?meta    → return metadata about last scheduled export (JSON)

export async function GET(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  if (searchParams.has('meta')) {
    const meta = await getRedis().get<{ generatedAt: string; sizeBytes: number }>(META_KEY);
    return NextResponse.json({ meta: meta || null });
  }

  if (searchParams.has('cached')) {
    const base64 = await getRedis().get<string>(DATA_KEY);
    if (!base64) return NextResponse.json({ error: 'No scheduled export available yet — generate a fresh one or wait for the daily cron' }, { status: 404 });
    const buf = Buffer.from(base64, 'base64');
    const meta = await getRedis().get<{ generatedAt: string }>(META_KEY);
    const date = meta?.generatedAt ? meta.generatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="pacetracker-backup-${date}.xlsx"`,
      },
    });
  }

  try {
    const buf = await generateExportBuffer();
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="pacetracker-backup-${date}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

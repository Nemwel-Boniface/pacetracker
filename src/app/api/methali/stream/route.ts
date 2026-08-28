import { getRedis } from '@/lib/redis';
import { getMethaliGame, publicMethaliView, METHALI_CHANNEL } from '@/lib/methali';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Push-based live feed: the browser opens one long-lived connection and gets
// pushed a fresh snapshot only when an admin action actually changes the game
// (via Redis pub/sub) — no client-side polling loop.
export async function GET() {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let sub: ReturnType<ReturnType<typeof getRedis>['subscribe']> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch { /* connection closed */ }
      };

      try { send(publicMethaliView(await getMethaliGame())); } catch { /* first snapshot best-effort */ }

      const redis = getRedis();
      sub = redis.subscribe([METHALI_CHANNEL]);
      sub.on('message', (evt: { message: unknown }) => send(evt.message));
      sub.on('error', () => {});

      // Keep intermediary proxies from timing out an idle connection.
      heartbeat = setInterval(() => { try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* closed */ } }, 20000);
    },
    cancel() {
      if (sub) sub.unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

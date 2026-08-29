import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getMemberSession } from '@/lib/auth';
import { getChallenge } from '@/lib/data';
import { getTriviaGame, publicTriviaView, TRIVIA_CHANNEL } from '@/lib/trivia';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ id: string }> };

// Push-based live feed, same pattern as /api/methali/stream: one long-lived SSE connection per
// viewer, updated only when an owner/admin action publishes a new snapshot via Redis pub/sub —
// no client-side polling loop.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge || challenge.kind !== 'trivia') return NextResponse.json({ error: 'Trivia not found' }, { status: 404 });
  const initialGame = await getTriviaGame(id);
  if (!initialGame) return NextResponse.json({ error: 'Trivia not found' }, { status: 404 });
  if (initialGame.visibility === 'private' && !await getMemberSession()) {
    return NextResponse.json({ error: 'Sign in to watch this trivia', locked: true }, { status: 403 });
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let sub: ReturnType<ReturnType<typeof getRedis>['subscribe']> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch { /* connection closed */ }
      };

      send(publicTriviaView(initialGame));

      const redis = getRedis();
      sub = redis.subscribe([TRIVIA_CHANNEL(id)]);
      sub.on('message', (evt: { message: unknown }) => send(evt.message));
      sub.on('error', () => {});

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

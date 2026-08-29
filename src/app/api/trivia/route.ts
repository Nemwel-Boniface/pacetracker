import { NextResponse } from 'next/server';
import { getAllChallenges } from '@/lib/data';
import { getTriviaGame, isScheduledInFuture } from '@/lib/trivia';

// Public gallery listing — never exposes question content, just enough to browse and pick one.
export async function GET() {
  try {
    const all = (await getAllChallenges()).filter(c => c.kind === 'trivia' && c.status !== 'cancelled');
    const trivias = (await Promise.all(all.map(async challenge => {
      const game = await getTriviaGame(challenge.id);
      if (!game) return null;
      return {
        id: challenge.id, title: game.title, ownerName: game.ownerName,
        posterImageUrl: game.posterImageUrl, visibility: game.visibility,
        scheduledAt: game.scheduledAt, isScheduledInFuture: isScheduledInFuture(game),
        phase: game.phase, teamCount: game.teams.length, createdAt: challenge.createdAt,
        isLegacyMethali: challenge.isLegacyMethali ?? false,
      };
    }))).filter(Boolean);
    trivias.sort((a, b) => (b!.createdAt).localeCompare(a!.createdAt));
    return NextResponse.json({ trivias });
  } catch { return NextResponse.json({ error: 'Failed to fetch trivias' }, { status: 500 }); }
}

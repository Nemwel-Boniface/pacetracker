import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllChallenges, getChallengeParticipants } from '@/lib/data';
import { getChallengeDisplayStatus } from '@/types';
import { getTriviaGame, isScheduledInFuture } from '@/lib/trivia';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const all = await getAllChallenges();
    const challenges = await Promise.all(all.map(async challenge => {
      if (challenge.kind === 'trivia') {
        const game = await getTriviaGame(challenge.id);
        return {
          challenge, kind: 'trivia' as const,
          phase: game?.phase ?? 'idle',
          isScheduledInFuture: game ? isScheduledInFuture(game) : false,
          teamCount: game?.teams.length ?? 0,
          visibility: game?.visibility ?? 'public',
        };
      }
      const participants = await getChallengeParticipants(challenge.id);
      return {
        challenge, kind: 'distance' as const,
        displayStatus: getChallengeDisplayStatus(challenge),
        acceptedCount: participants.filter(p => p.status === 'accepted').length,
        pendingCount: participants.filter(p => p.status === 'pending').length,
      };
    }));
    return NextResponse.json({ challenges });
  } catch { return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 }); }
}

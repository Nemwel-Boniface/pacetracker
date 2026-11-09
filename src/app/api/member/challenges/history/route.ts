import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getEndedChallenges, getChallengeParticipant, getChallengeLeaderboard } from '@/lib/data';

const HISTORY_LIMIT = 30;

// Finished distance challenges with their winners. Members see open ones plus any they were part of;
// admins see everything.
export async function GET() {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const visible = [];
    for (const c of await getEndedChallenges()) {
      if (visible.length >= HISTORY_LIMIT) break;
      if (session.isAdmin || c.visibility === 'open') { visible.push(c); continue; }
      const p = await getChallengeParticipant(c.id, session.memberId);
      if (p?.status === 'accepted' || p?.status === 'left') visible.push(c);
    }
    const history = await Promise.all(visible.map(async challenge => {
      const leaderboard = await getChallengeLeaderboard(challenge);
      const mine = leaderboard.find(e => e.memberId === session.memberId);
      return {
        challenge, participantCount: leaderboard.length,
        podium: leaderboard.filter(e => e.progressKm > 0).slice(0, 3),
        myRank: mine?.rank ?? null, myKm: mine?.progressKm ?? null,
      };
    }));
    return NextResponse.json({ history });
  } catch { return NextResponse.json({ error: 'Failed to fetch challenge history' }, { status: 500 }); }
}

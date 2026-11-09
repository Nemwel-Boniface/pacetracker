import { NextRequest, NextResponse } from 'next/server';
import { getViewer } from '@/lib/actor';
import { getFeaturedChallenges, getEndedChallenges, getChallengeParticipant, getAcceptedParticipantCount, getChallengeLeaderboard, computeChallengePace } from '@/lib/data';
import { Challenge, isChallengeUpcoming, isChallengeFacilitator } from '@/types';

const PAST_LIMIT = 10;

function daysFromToday(date: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(date + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000);
}

// Only what the public card needs — never the participant list.
function publicFields(c: Challenge) {
  return { id: c.id, title: c.title, description: c.description ?? '', category: c.category!, period: c.period!, goalKm: c.goalKm!, startDate: c.startDate!, endDate: c.endDate!, ownerName: c.ownerName, coFacilitators: (c.coFacilitators ?? []).map(f => f.name) };
}

// Public: featured challenges for the main page and the chatbot. Signed-in viewers also get their own
// standing and what they're allowed to do. `?past=1` returns finished featured challenges with their podium.
export async function GET(req: NextRequest) {
  try {
    const viewer = await getViewer();

    if (req.nextUrl.searchParams.get('past') === '1') {
      const ended = (await getEndedChallenges()).filter(c => c.featureStatus === 'featured').slice(0, PAST_LIMIT);
      const past = await Promise.all(ended.map(async c => {
        const leaderboard = await getChallengeLeaderboard(c);
        return {
          ...publicFields(c), participantCount: leaderboard.length,
          podium: leaderboard.filter(e => e.progressKm > 0).slice(0, 3).map(e => ({ rank: e.rank, memberName: e.memberName, progressKm: e.progressKm, percentage: e.percentage })),
        };
      }));
      return NextResponse.json({ past });
    }

    const featured = await Promise.all((await getFeaturedChallenges()).map(async c => {
      const upcoming = isChallengeUpcoming(c);
      const participant = viewer ? await getChallengeParticipant(c.id, viewer.memberId) : null;
      const joined = participant?.status === 'accepted';
      let me = null;
      let participantCount: number;
      if (joined) {
        const leaderboard = await getChallengeLeaderboard(c);
        const mine = leaderboard.find(e => e.memberId === viewer!.memberId)!;
        const pace = computeChallengePace(c, mine.progressKm);
        participantCount = leaderboard.length;
        me = {
          km: mine.progressKm, percentage: mine.percentage, remainingKm: Math.max(0, Math.round((c.goalKm! - mine.progressKm) * 10) / 10),
          onPace: pace.onPace, expectedKm: pace.expectedKm, rank: mine.rank,
        };
      } else {
        participantCount = await getAcceptedParticipantCount(c.id);
      }
      return {
        ...publicFields(c), participantCount, upcoming,
        daysUntilStart: upcoming ? daysFromToday(c.startDate!) : 0,
        daysRemaining: Math.max(0, daysFromToday(c.endDate!) + 1),
        joined, invited: participant?.status === 'pending', me,
        canJoin: !!viewer && !joined,
        // Inviting others from the chatbot / main page is for the owner, co-facilitators and admins only.
        canInvite: !!viewer && (isChallengeFacilitator(c, viewer.memberId) || viewer.isAdmin),
      };
    }));

    return NextResponse.json({ viewer: viewer ? { isAdmin: viewer.isAdmin } : null, featured });
  } catch { return NextResponse.json({ error: 'Failed to fetch featured challenges' }, { status: 500 }); }
}

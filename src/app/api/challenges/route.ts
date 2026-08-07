import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllChallenges, getChallengeParticipants } from '@/lib/data';
import { getChallengeDisplayStatus } from '@/types';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const all = await getAllChallenges();
    const challenges = await Promise.all(all.map(async challenge => {
      const participants = await getChallengeParticipants(challenge.id);
      return {
        challenge,
        displayStatus: getChallengeDisplayStatus(challenge),
        acceptedCount: participants.filter(p => p.status === 'accepted').length,
        pendingCount: participants.filter(p => p.status === 'pending').length,
      };
    }));
    return NextResponse.json({ challenges });
  } catch { return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 }); }
}

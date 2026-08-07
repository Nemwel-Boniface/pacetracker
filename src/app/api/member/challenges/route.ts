import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMemberSession } from '@/lib/auth';
import { getMember, getMemberChallenges, saveChallenge, saveChallengeParticipant, getChallengeParticipant, getChallengeParticipants, computeChallengeProgress, computeChallengePace } from '@/lib/data';
import { Challenge, ChallengeParticipant, ChallengeCategory, ChallengePeriod, computeChallengeEndDate, getChallengeDisplayStatus } from '@/types';

const VALID_CATEGORIES: ChallengeCategory[] = ['run_walk', 'cycling'];
const VALID_PERIODS: ChallengePeriod[] = ['weekly', 'monthly'];

export async function GET() {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const challenges = await getMemberChallenges(session.memberId);
    const owned: Record<string, unknown>[] = [];
    const joined: Record<string, unknown>[] = [];
    const invites: Record<string, unknown>[] = [];

    for (const challenge of challenges) {
      const participant = await getChallengeParticipant(challenge.id, session.memberId);
      if (!participant || participant.status === 'declined' || participant.status === 'left') continue;

      if (participant.status === 'pending') {
        invites.push({ challenge, invitedByName: participant.invitedByName, invitedAt: participant.invitedAt });
        continue;
      }

      const progressKm = await computeChallengeProgress(challenge, session.memberId);
      const pace = computeChallengePace(challenge, progressKm);
      const participants = await getChallengeParticipants(challenge.id);
      const participantCount = participants.filter(p => p.status === 'accepted').length;
      const entry = { challenge, progressKm, ...pace, participantCount, displayStatus: getChallengeDisplayStatus(challenge) };

      if (challenge.ownerId === session.memberId) owned.push(entry);
      else joined.push(entry);
    }

    return NextResponse.json({ owned, joined, invites });
  } catch { return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const member = await getMember(session.memberId);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (!member.isActive) return NextResponse.json({ error: 'Account inactive' }, { status: 403 });

    const { title, category, period, goalKm } = await req.json();
    const trimmedTitle = title?.trim();
    if (!trimmedTitle || trimmedTitle.length > 60) return NextResponse.json({ error: 'Title is required (max 60 characters)' }, { status: 400 });
    if (!VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    if (!VALID_PERIODS.includes(period)) return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    const goal = Number(goalKm);
    if (!Number.isFinite(goal) || goal <= 0 || goal > 2000) return NextResponse.json({ error: 'Goal must be between 0 and 2000km' }, { status: 400 });

    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = computeChallengeEndDate(startDate, period);
    const now = new Date().toISOString();

    const challenge: Challenge = {
      id: uuidv4(), ownerId: member.id, ownerName: member.name,
      title: trimmedTitle, category, period, goalKm: Math.round(goal * 10) / 10,
      startDate, endDate, status: 'active', createdAt: now,
    };
    const ownerParticipant: ChallengeParticipant = {
      challengeId: challenge.id, memberId: member.id, memberName: member.name,
      status: 'accepted', invitedBy: member.id, invitedByName: member.name,
      invitedAt: now, respondedAt: now,
    };

    await Promise.all([saveChallenge(challenge), saveChallengeParticipant(ownerParticipant)]);
    return NextResponse.json({ challenge }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 }); }
}

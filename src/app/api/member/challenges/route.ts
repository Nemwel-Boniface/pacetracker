import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMemberSession } from '@/lib/auth';
import { getMember, getMemberChallenges, saveChallenge, saveChallengeParticipant, getChallengeParticipant, getChallengeParticipants, computeChallengeProgress, computeChallengePace } from '@/lib/data';
import { Challenge, ChallengeParticipant, ChallengeCategory, ChallengePeriod, computeChallengeEndDate, getChallengeDisplayStatus } from '@/types';
import {
  buildTriviaGame, saveTriviaGame, getTriviaGame, isScheduledInFuture,
  MIN_TEAMS, MAX_TEAMS, MIN_TIMER_SECONDS, MAX_TIMER_SECONDS, DEFAULT_TIMER_SECONDS,
  TriviaVisibility, TriviaQuestionPhase,
} from '@/lib/trivia';

const VALID_CATEGORIES: ChallengeCategory[] = ['run_walk', 'cycling'];
const VALID_PERIODS: ChallengePeriod[] = ['weekly', 'monthly'];
const VALID_PHASES = new Set<TriviaQuestionPhase>(['test', 'main', 'tiebreak']);

export async function GET() {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const challenges = await getMemberChallenges(session.memberId);
    const owned: Record<string, unknown>[] = [];
    const joined: Record<string, unknown>[] = [];
    const invites: Record<string, unknown>[] = [];

    for (const challenge of challenges) {
      if (challenge.kind === 'trivia') {
        if (challenge.ownerId !== session.memberId) continue; // trivia has no join/invite flow — owner-only listing
        const game = await getTriviaGame(challenge.id);
        if (!game) continue;
        owned.push({
          challenge, kind: 'trivia',
          teamCount: game.teams.length, memberCount: game.teams.reduce((s, t) => s + t.members.length, 0),
          phase: game.phase, scheduledAt: game.scheduledAt, isScheduledInFuture: isScheduledInFuture(game),
          posterImageUrl: game.posterImageUrl, visibility: game.visibility,
        });
        continue;
      }

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
      const entry = { challenge, kind: 'distance', progressKm, ...pace, participantCount, displayStatus: getChallengeDisplayStatus(challenge) };

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

    const body = await req.json();

    if (body.kind === 'trivia') return createTriviaChallenge(member.id, member.name, body);

    const { title, category, period, goalKm } = body;
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
      id: uuidv4(), ownerId: member.id, ownerName: member.name, kind: 'distance',
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

interface TriviaCreateBody {
  title: string;
  posterImageUrl?: string;
  visibility: TriviaVisibility;
  scheduledAt?: string;
  timerSeconds?: number;
  teams: { name: string; members: { name: string; memberId?: string }[] }[];
  questions: { phase: string; prompt: string; text: string; meaning: string }[];
}

async function createTriviaChallenge(ownerId: string, ownerName: string, body: TriviaCreateBody) {
  const title = body.title?.trim();
  if (!title || title.length > 60) return NextResponse.json({ error: 'Title is required (max 60 characters)' }, { status: 400 });

  if (body.visibility !== 'public' && body.visibility !== 'private') return NextResponse.json({ error: 'Visibility must be public or private' }, { status: 400 });

  let scheduledAt: string | undefined;
  if (body.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid scheduled date' }, { status: 400 });
    scheduledAt = d.toISOString();
  }

  const timerSeconds = body.timerSeconds ? Number(body.timerSeconds) : DEFAULT_TIMER_SECONDS;
  if (!Number.isFinite(timerSeconds) || timerSeconds < MIN_TIMER_SECONDS || timerSeconds > MAX_TIMER_SECONDS) {
    return NextResponse.json({ error: `Timer must be between ${MIN_TIMER_SECONDS} and ${MAX_TIMER_SECONDS} seconds` }, { status: 400 });
  }

  if (!Array.isArray(body.teams) || body.teams.length < MIN_TEAMS || body.teams.length > MAX_TEAMS) {
    return NextResponse.json({ error: `A trivia needs between ${MIN_TEAMS} and ${MAX_TEAMS} teams` }, { status: 400 });
  }
  const teams: { name: string; members: { name: string; memberId?: string }[] }[] = [];
  for (const t of body.teams) {
    const teamName = t.name?.trim();
    if (!teamName) return NextResponse.json({ error: 'Every team needs a name' }, { status: 400 });
    if (!Array.isArray(t.members) || t.members.length === 0) return NextResponse.json({ error: `Team "${teamName}" needs at least one member` }, { status: 400 });
    const members: { name: string; memberId?: string }[] = [];
    for (const m of t.members) {
      if (m.memberId) {
        const found = await getMember(m.memberId);
        if (!found || !found.isActive || found.isShadowUser) return NextResponse.json({ error: `Selected member is not eligible` }, { status: 400 });
        members.push({ name: found.name, memberId: found.id });
      } else {
        const guestName = m.name?.trim();
        if (!guestName) return NextResponse.json({ error: 'Every team member needs a name' }, { status: 400 });
        members.push({ name: guestName.slice(0, 40) });
      }
    }
    teams.push({ name: teamName.slice(0, 40), members });
  }

  if (!Array.isArray(body.questions) || body.questions.length === 0) return NextResponse.json({ error: 'Add at least one question' }, { status: 400 });
  const questions: { phase: TriviaQuestionPhase; prompt: string; text: string; meaning: string }[] = [];
  for (const q of body.questions) {
    if (!VALID_PHASES.has(q.phase as TriviaQuestionPhase)) return NextResponse.json({ error: 'Every question needs a valid phase' }, { status: 400 });
    if (!q.prompt?.trim() || !q.text?.trim() || !q.meaning?.trim()) return NextResponse.json({ error: 'Every question needs a prompt, full answer, and meaning' }, { status: 400 });
    questions.push({ phase: q.phase as TriviaQuestionPhase, prompt: q.prompt.trim(), text: q.text.trim(), meaning: q.meaning.trim() });
  }
  const mainCount = questions.filter(q => q.phase === 'main').length;
  if (mainCount === 0) return NextResponse.json({ error: 'Add at least one "main" question' }, { status: 400 });
  if (mainCount < teams.length) return NextResponse.json({ error: `Add at least ${teams.length} "main" questions so every team gets a turn` }, { status: 400 });

  const now = new Date().toISOString();
  const challenge: Challenge = {
    id: uuidv4(), ownerId, ownerName, title, kind: 'trivia', status: 'active', createdAt: now,
  };
  const game = buildTriviaGame({
    challengeId: challenge.id, ownerId, ownerName, title,
    posterImageUrl: body.posterImageUrl?.trim() || undefined,
    visibility: body.visibility, scheduledAt, timerSeconds, teams, questions,
  });

  await Promise.all([saveChallenge(challenge), saveTriviaGame(game)]);
  return NextResponse.json({ challenge }, { status: 201 });
}

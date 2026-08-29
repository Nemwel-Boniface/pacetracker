import * as XLSX from 'xlsx';
import { getRedis, KEYS } from './redis';
import { getAdminSession, getMemberSession } from './auth';
import { Challenge } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Generalized version of `methali.ts` — same live-game mechanic (host reads a half-revealed
// prompt, room shouts the answer, host scores Full/Half/None), but parameterized per Challenge
// instead of one hardcoded global game with 3 fixed teams.

export type TriviaVisibility = 'public' | 'private';
export type TriviaPhase = 'idle' | 'test' | 'main' | 'tiebreak' | 'finished';
export type TriviaQuestionPhase = 'test' | 'main' | 'tiebreak';
export type TriviaOutcome = 'full' | 'half' | 'none';

export interface TriviaQuestion { id: string; phase: TriviaQuestionPhase; prompt: string; text: string; meaning: string; }
export interface TriviaTeamMember { id: string; name: string; memberId?: string; }
export interface TriviaTeam { id: string; name: string; members: TriviaTeamMember[]; score: number; }
export interface TriviaCurrentRound { phase: TriviaPhase; questionId: string; teamId: string | null; startedAt: string; durationSeconds: number; }
export interface TriviaRoundLog {
  id: string; phase: TriviaPhase; questionId: string; methaliText: string; meaning: string;
  teamId: string | null; teamName: string; outcome: TriviaOutcome; points: number; loggedAt: string;
}
export interface TriviaGame {
  challengeId: string;
  ownerId: string;
  ownerName: string;
  title: string;
  posterImageUrl?: string;
  visibility: TriviaVisibility;
  scheduledAt?: string;
  timerSeconds: number;
  teams: TriviaTeam[];
  testQuestions: TriviaQuestion[];
  mainQueue: { teamId: string; questionId: string }[];
  tiebreakQuestions: TriviaQuestion[];
  questionsById: Record<string, TriviaQuestion>;
  phase: TriviaPhase;
  mainIndex: number;
  testIndex: number;
  tiebreakIndex: number;
  current: TriviaCurrentRound | null;
  log: TriviaRoundLog[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TIMER_SECONDS = 30;
export const MIN_TIMER_SECONDS = 5;
export const MAX_TIMER_SECONDS = 300;
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 8;
export const OUTCOME_POINTS: Record<TriviaOutcome, number> = { full: 20, half: 10, none: 0 };
export const OUTCOME_LABELS: Record<TriviaOutcome, string> = { full: '✅ Full answer + explanation', half: '🟡 Partial answer only', none: '❌ No one got it' };
export const TRIVIA_CHANNEL = (challengeId: string) => `pt:triviagame:events:${challengeId}`;

// ─── Permissions ──────────────────────────────────────────────────────────────
// Either the site admin, or the member who owns this trivia challenge, may run it.
export async function canManageTrivia(challenge: Pick<Challenge, 'ownerId'>): Promise<{ role: 'admin' | 'owner' } | null> {
  if (await getAdminSession()) return { role: 'admin' };
  const session = await getMemberSession();
  if (session && session.memberId === challenge.ownerId) return { role: 'owner' };
  return null;
}

// ─── Build / persist ──────────────────────────────────────────────────────────
export interface BuildTriviaInput {
  challengeId: string;
  ownerId: string;
  ownerName: string;
  title: string;
  posterImageUrl?: string;
  visibility: TriviaVisibility;
  scheduledAt?: string;
  timerSeconds: number;
  teams: { name: string; members: { name: string; memberId?: string }[] }[];
  questions: { phase: TriviaQuestionPhase; prompt: string; text: string; meaning: string }[];
}

export function buildTriviaGame(input: BuildTriviaInput): TriviaGame {
  const teams: TriviaTeam[] = input.teams.map(t => ({
    id: uuidv4(), name: t.name, score: 0,
    members: t.members.map(m => ({ id: uuidv4(), name: m.name, memberId: m.memberId })),
  }));

  const questions: TriviaQuestion[] = input.questions.map(q => ({ id: uuidv4(), ...q }));
  const testQuestions = questions.filter(q => q.phase === 'test');
  const mainQuestions = questions.filter(q => q.phase === 'main');
  const tiebreakQuestions = questions.filter(q => q.phase === 'tiebreak');

  const mainQueue: { teamId: string; questionId: string }[] = mainQuestions.map((q, i) => ({
    teamId: teams[i % teams.length].id, questionId: q.id,
  }));

  const questionsById: Record<string, TriviaQuestion> = {};
  questions.forEach(q => { questionsById[q.id] = q; });

  const now = new Date().toISOString();
  return {
    challengeId: input.challengeId, ownerId: input.ownerId, ownerName: input.ownerName, title: input.title,
    posterImageUrl: input.posterImageUrl, visibility: input.visibility, scheduledAt: input.scheduledAt,
    timerSeconds: input.timerSeconds, teams, testQuestions, mainQueue, tiebreakQuestions, questionsById,
    phase: 'idle', mainIndex: 0, testIndex: 0, tiebreakIndex: 0, current: null, log: [],
    createdAt: now, updatedAt: now,
  };
}

export async function getTriviaGame(challengeId: string): Promise<TriviaGame | null> {
  return getRedis().get<TriviaGame>(KEYS.triviaGame(challengeId));
}
export async function saveTriviaGame(g: TriviaGame): Promise<void> {
  g.updatedAt = new Date().toISOString();
  await getRedis().set(KEYS.triviaGame(g.challengeId), g);
}
export async function deleteTriviaGame(challengeId: string): Promise<void> {
  await getRedis().del(KEYS.triviaGame(challengeId));
}
export async function publishTriviaUpdate(g: TriviaGame): Promise<void> {
  await getRedis().publish(TRIVIA_CHANNEL(g.challengeId), JSON.stringify(publicTriviaView(g)));
}

// Every mutation route fetches a game by the URL's `id`, mutates it in memory, then must save it
// back — call this right before saving as a hard guard that the object being persisted really is
// the one keyed to that same id. `saveTriviaGame` derives its Redis key from `g.challengeId`, so a
// game object with a mismatched id would silently overwrite a *different* trivia's data; this makes
// that class of bug fail loudly instead. Every write here touches exactly one key
// (`pt:triviagame:{challengeId}`) — no other trivia, challenge, member, or activity data is ever
// read or written by a reset (or any other mutation) in this file.
export function assertSameChallenge(expectedId: string, g: TriviaGame): void {
  if (g.challengeId !== expectedId) throw new Error('Trivia game/challenge id mismatch — refusing to save');
}

// ─── Views ────────────────────────────────────────────────────────────────────
export function isScheduledInFuture(g: TriviaGame): boolean {
  return !!g.scheduledAt && new Date(g.scheduledAt).getTime() > Date.now();
}

export function publicTriviaView(g: TriviaGame) {
  return {
    challengeId: g.challengeId,
    title: g.title,
    ownerName: g.ownerName,
    posterImageUrl: g.posterImageUrl,
    visibility: g.visibility,
    scheduledAt: g.scheduledAt,
    isScheduledInFuture: isScheduledInFuture(g),
    phase: g.phase,
    teams: g.teams.map(t => ({ id: t.id, name: t.name, score: t.score, members: t.members })),
    current: g.current ? {
      phase: g.current.phase, teamId: g.current.teamId, startedAt: g.current.startedAt,
      durationSeconds: g.current.durationSeconds, prompt: g.questionsById[g.current.questionId]?.prompt ?? '',
    } : null,
    log: [...g.log].reverse(),
    progress: {
      mainIndex: g.mainIndex, mainTotal: g.mainQueue.length,
      testIndex: g.testIndex, testTotal: g.testQuestions.length,
      tiebreakIndex: g.tiebreakIndex, tiebreakTotal: g.tiebreakQuestions.length,
    },
  };
}

export function nextUpPreview(g: TriviaGame): { teamId: string | null; question: TriviaQuestion } | null {
  if (g.current) return null;
  if (g.phase === 'test') { if (g.testIndex >= g.testQuestions.length) return null; return { teamId: null, question: g.testQuestions[g.testIndex] }; }
  if (g.phase === 'main') { if (g.mainIndex >= g.mainQueue.length) return null; const e = g.mainQueue[g.mainIndex]; return { teamId: e.teamId, question: g.questionsById[e.questionId] }; }
  if (g.phase === 'tiebreak') { if (g.tiebreakIndex >= g.tiebreakQuestions.length) return null; return { teamId: null, question: g.tiebreakQuestions[g.tiebreakIndex] }; }
  return null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────
export function startRound(g: TriviaGame, opts: { teamId?: string }): TriviaGame {
  if (isScheduledInFuture(g)) throw new Error("This trivia isn't live yet");
  if (g.current) throw new Error('A round is already in progress');
  let questionId: string; let teamId: string | null;
  if (g.phase === 'test') {
    if (g.testIndex >= g.testQuestions.length) throw new Error('No practice questions left — switch to Main to start the real game');
    questionId = g.testQuestions[g.testIndex].id; teamId = null;
  } else if (g.phase === 'main') {
    if (g.mainIndex >= g.mainQueue.length) throw new Error('All main-round questions have been played');
    const entry = g.mainQueue[g.mainIndex]; questionId = entry.questionId; teamId = entry.teamId;
  } else if (g.phase === 'tiebreak') {
    if (!opts.teamId) throw new Error('Select which team is answering the tiebreaker');
    if (g.tiebreakIndex >= g.tiebreakQuestions.length) throw new Error('No tiebreaker questions left');
    questionId = g.tiebreakQuestions[g.tiebreakIndex].id; teamId = opts.teamId;
  } else {
    throw new Error('Set the phase to Test, Main, or Tiebreak before starting a round');
  }
  return { ...g, current: { phase: g.phase, questionId, teamId, startedAt: new Date().toISOString(), durationSeconds: g.timerSeconds } };
}

export function cancelRound(g: TriviaGame): TriviaGame { return { ...g, current: null }; }

export function resolveRound(g: TriviaGame, outcome: TriviaOutcome): TriviaGame {
  if (!g.current) throw new Error('No round in progress');
  const { phase, questionId, teamId } = g.current;
  const question = g.questionsById[questionId];
  const team = teamId ? g.teams.find(t => t.id === teamId) ?? null : null;
  const isScored = phase !== 'test';
  const points = isScored ? OUTCOME_POINTS[outcome] : 0;
  const teams = isScored ? g.teams.map(t => (t.id === teamId ? { ...t, score: t.score + points } : t)) : g.teams;
  const log: TriviaRoundLog[] = [...g.log, {
    id: uuidv4(), phase, questionId, methaliText: question.text, meaning: question.meaning,
    teamId, teamName: team?.name ?? 'Practice round', outcome, points, loggedAt: new Date().toISOString(),
  }];
  let { mainIndex, testIndex, tiebreakIndex, phase: nextPhase } = g;
  if (phase === 'test') testIndex += 1;
  if (phase === 'main') { mainIndex += 1; if (mainIndex >= g.mainQueue.length) nextPhase = 'finished'; }
  if (phase === 'tiebreak') tiebreakIndex += 1;
  return { ...g, teams, log, mainIndex, testIndex, tiebreakIndex, phase: nextPhase, current: null };
}

export function setPhase(g: TriviaGame, phase: TriviaPhase): TriviaGame {
  if (g.current) throw new Error('Resolve the round in progress before changing phase');
  return { ...g, phase };
}

export function setTimerSeconds(g: TriviaGame, seconds: number): TriviaGame {
  if (!Number.isFinite(seconds) || seconds < MIN_TIMER_SECONDS || seconds > MAX_TIMER_SECONDS) {
    throw new Error(`Timer must be between ${MIN_TIMER_SECONDS} and ${MAX_TIMER_SECONDS} seconds`);
  }
  return { ...g, timerSeconds: Math.round(seconds) };
}

export function updateSettings(g: TriviaGame, patch: { posterImageUrl?: string; visibility?: TriviaVisibility; scheduledAt?: string | null }): TriviaGame {
  const next = { ...g };
  if (patch.posterImageUrl !== undefined) next.posterImageUrl = patch.posterImageUrl || undefined;
  if (patch.visibility !== undefined) next.visibility = patch.visibility;
  if (patch.scheduledAt !== undefined) next.scheduledAt = patch.scheduledAt ?? undefined;
  return next;
}

// Pure in-memory transform of one game's own object — clears only its scores/phase/log. Rosters,
// questions, and settings (poster/visibility/schedule) are untouched. It's the caller's
// responsibility to persist the *same* game back to its *own* key (see assertSameChallenge above);
// this function never reaches into Redis and cannot affect any other trivia, challenge, or member.
export function resetGame(g: TriviaGame): TriviaGame {
  return {
    ...g,
    teams: g.teams.map(t => ({ ...t, score: 0 })),
    phase: 'idle', mainIndex: 0, testIndex: 0, tiebreakIndex: 0, current: null, log: [],
  };
}

export function addTeam(g: TriviaGame, name: string): TriviaGame {
  if (g.phase !== 'idle') throw new Error('Teams can only be added before the game starts (reset first)');
  if (g.teams.length >= MAX_TEAMS) throw new Error(`A trivia can have at most ${MAX_TEAMS} teams`);
  return { ...g, teams: [...g.teams, { id: uuidv4(), name, members: [], score: 0 }] };
}

export function removeTeam(g: TriviaGame, teamId: string): TriviaGame {
  if (g.phase !== 'idle') throw new Error('Teams can only be removed before the game starts (reset first)');
  if (g.teams.length <= MIN_TEAMS) throw new Error(`A trivia needs at least ${MIN_TEAMS} teams`);
  return { ...g, teams: g.teams.filter(t => t.id !== teamId) };
}

export function addTeamMember(g: TriviaGame, teamId: string, name: string, memberId?: string): TriviaGame {
  return { ...g, teams: g.teams.map(t => (t.id === teamId ? { ...t, members: [...t.members, { id: uuidv4(), name, memberId }] } : t)) };
}

export function removeTeamMember(g: TriviaGame, teamId: string, memberId: string): TriviaGame {
  return { ...g, teams: g.teams.map(t => (t.id === teamId ? { ...t, members: t.members.filter(m => m.id !== memberId) } : t)) };
}

// ─── Excel template + parsing ─────────────────────────────────────────────────
const TEMPLATE_HEADERS = ['phase', 'prompt', 'full_text', 'meaning'];
const TEMPLATE_EXAMPLE_ROWS = [
  ['test', 'Half of the question shown while the timer runs (practice — not scored)', 'The full question or proverb, revealed after the round', 'What it means / why the answer is correct'],
  ['main', 'e.g. "Largest country by area is..."', 'Russia', 'Russia spans roughly 17 million km², the largest of any country.'],
  ['tiebreak', 'Held in reserve for tie-breaking rounds', 'Full answer', 'Explanation shown in the recap after the round is scored'],
];

export function buildQuestionTemplateWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS]);
  XLSX.utils.book_append_sheet(wb, sheet, 'Questions');
  const instructions = XLSX.utils.aoa_to_sheet([
    ['How to fill in this template'],
    [''],
    ['phase', 'One of: test, main, tiebreak'],
    ['', '- test: practice round, shown before the real game, never scored'],
    ['', '- main: the real game — every team gets a turn, round-robin, in the order rows appear'],
    ['', '- tiebreak: held in reserve, only used if teams are tied at the end'],
    [''],
    ['prompt', 'The half/teaser shown live on screen while the clock is running — do not give away the answer'],
    ['full_text', 'The complete question/answer — only revealed after the round is scored'],
    ['meaning', 'A short explanation shown in the recap alongside full_text'],
    [''],
    ['Delete the 3 example rows before adding your own.'],
    ['Every trivia needs at least one "main" row per team — main rows are handed out to teams in the order they appear in this sheet.'],
  ]);
  XLSX.utils.book_append_sheet(wb, instructions, 'Instructions');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export interface ParsedQuestionRow { phase: TriviaQuestionPhase; prompt: string; text: string; meaning: string; }
export interface ParseQuestionsResult { questions: ParsedQuestionRow[]; errors: { row: number; message: string }[]; }

const VALID_PHASES = new Set<string>(['test', 'main', 'tiebreak']);

export function parseQuestionWorkbook(buffer: Buffer): ParseQuestionsResult {
  const questions: ParsedQuestionRow[] = [];
  const errors: { row: number; message: string }[] = [];
  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'questions') ?? wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return { questions: [], errors: [{ row: 0, message: 'No sheet found in the uploaded file' }] };
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  } catch {
    return { questions: [], errors: [{ row: 0, message: 'Could not read this file — please upload a .xlsx file' }] };
  }

  rows.forEach((row, i) => {
    const rowNum = i + 2; // header is row 1
    const phase = String(row.phase ?? '').trim().toLowerCase();
    const prompt = String(row.prompt ?? '').trim();
    const text = String(row.full_text ?? '').trim();
    const meaning = String(row.meaning ?? '').trim();
    if (!phase && !prompt && !text && !meaning) return; // skip fully blank rows
    if (!VALID_PHASES.has(phase)) { errors.push({ row: rowNum, message: `phase must be test, main, or tiebreak (got "${row.phase ?? ''}")` }); return; }
    if (!prompt) { errors.push({ row: rowNum, message: 'prompt is required' }); return; }
    if (!text) { errors.push({ row: rowNum, message: 'full_text is required' }); return; }
    if (!meaning) { errors.push({ row: rowNum, message: 'meaning is required' }); return; }
    questions.push({ phase: phase as TriviaQuestionPhase, prompt, text, meaning });
  });

  return { questions, errors };
}

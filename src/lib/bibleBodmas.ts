import { getRedis, KEYS } from './redis';
import { v4 as uuidv4 } from 'uuid';

// Bible & BODMAS: a live team trivia that mirrors Methali Trivia (one Redis doc, SSE push, host-scored),
// but each question goes to one nominated "round leader" per team, and rounds alternate Bible / Math.
// Standalone on purpose: own key, own channel, no writes to any other game.

export type BbTeamId = 'simba' | 'kifaru' | 'chui';
export type BbCategory = 'bible' | 'math';
export type BbPhase = 'idle' | 'test' | 'main' | 'tiebreak' | 'finished';
export type BbOutcome = 'correct' | 'close' | 'wrong';
export interface BbMember { id: string; name: string; }
export interface BbTeam { id: BbTeamId; name: string; emoji: string; members: BbMember[]; score: number; }
export interface BbLeader { memberId: string; name: string; }
export interface BbQuestion {
  id: string; category: BbCategory; prompt: string;
  options?: string[]; answerIndex?: number; // math only (multiple choice)
  answer: string; explanation: string;
}
export interface BbQueueEntry { teamId: BbTeamId; questionId: string; round: number; }
export interface BbCurrentRound {
  phase: BbPhase; questionId: string; teamId: BbTeamId | null; leader: BbLeader | null;
  startedAt: string; durationSeconds: number;
}
export interface BbPendingLeader extends BbLeader { teamId: BbTeamId; }
export interface BbRoundLog {
  id: string; phase: BbPhase; round: number | null; category: BbCategory; questionId: string;
  prompt: string; answer: string; explanation: string; options?: string[]; choiceIndex?: number | null;
  teamId: BbTeamId | null; teamName: string; leaderId: string | null; leaderName: string | null;
  outcome: BbOutcome; points: number; loggedAt: string;
}
export interface BbGame {
  teams: BbTeam[];
  questionsById: Record<string, BbQuestion>;
  testQueue: BbQueueEntry[];
  mainQueue: BbQueueEntry[];
  tiebreakQuestions: BbQuestion[];
  phase: BbPhase;
  testIndex: number; mainIndex: number; tiebreakIndex: number;
  current: BbCurrentRound | null;
  pendingLeader: BbPendingLeader | null;
  timers: Record<BbCategory, number>;
  log: BbRoundLog[];
}

export const BB_KEY = 'pt:biblebodmas';
export const BB_CHANNEL = 'pt:biblebodmas:events';
export const DEFAULT_TIMERS: Record<BbCategory, number> = { bible: 30, math: 45 };
export const MIN_TIMER_SECONDS = 5;
export const MAX_TIMER_SECONDS = 300;
export const OUTCOME_POINTS: Record<BbOutcome, number> = { correct: 10, close: 5, wrong: 0 };
export const TOTAL_MAIN_ROUNDS = 6;
// Odd rounds are Bible, even rounds are Math.
export const roundCategory = (round: number): BbCategory => (round % 2 === 1 ? 'bible' : 'math');

const TEAM_META: { id: BbTeamId; name: string; emoji: string }[] = [
  { id: 'simba', name: 'Team Simba', emoji: '🦁' },
  { id: 'kifaru', name: 'Team Kifaru', emoji: '🦏' },
  { id: 'chui', name: 'Team Chui', emoji: '🐆' },
];

type RawBible = { prompt: string; answer: string; explanation: string };
type RawMath = { prompt: string; options: string[]; answerIndex: number; explanation: string };

// 22 questions: 2 practice (1 Bible, 1 Math) → 18 main (3 per team per category) → 2 tiebreak reserve.
const PRACTICE_BIBLE: RawBible = { prompt: 'Whose donkey saw an angel and spoke to its rider?', answer: 'Balaam', explanation: 'Numbers 22:21–33' };
const PRACTICE_MATH: RawMath = { prompt: '10 + 2 × 6 = ?', options: ['72', '22', '18', '20'], answerIndex: 1, explanation: '2 × 6 = 12, then 10 + 12 = 22' };

// Grouped by Bible round (1, 3, 5); each inner list is Simba, Kifaru, Chui.
const MAIN_BIBLE: RawBible[][] = [
  [
    { prompt: 'Who was the father of John the Baptist?', answer: 'Zechariah (Zacharias)', explanation: 'Luke 1:5–13' },
    { prompt: 'Which of the twelve disciples was also called Didymus?', answer: 'Thomas', explanation: 'John 11:16, "Didymus" means twin' },
    { prompt: 'Which Roman centurion\'s household became the first Gentile converts after Peter visited them?', answer: 'Cornelius', explanation: 'Acts 10' },
  ],
  [
    { prompt: 'Which prophet was told by God to marry a woman named Gomer?', answer: 'Hosea', explanation: 'Hosea 1:2–3' },
    { prompt: 'Moses\' father-in-law was a priest of Midian. What was his name?', answer: 'Jethro (also called Reuel)', explanation: 'Exodus 2:18, 3:1' },
    { prompt: 'In which city were Paul and Silas singing hymns at midnight in prison when an earthquake struck?', answer: 'Philippi', explanation: 'Acts 16:12, 25–26' },
  ],
  [
    { prompt: 'Which left-handed judge killed Eglon, the king of Moab?', answer: 'Ehud', explanation: 'Judges 3:15–21' },
    { prompt: 'Who became the first king of the northern kingdom of Israel after the kingdom split?', answer: 'Jeroboam', explanation: '1 Kings 12:20' },
    { prompt: 'What is the shortest book in the Old Testament?', answer: 'Obadiah', explanation: 'One chapter, 21 verses' },
  ],
];

// Grouped by Math round (2, 4, 6); each inner list is Simba, Kifaru, Chui. All test BODMAS.
const MAIN_MATH: RawMath[][] = [
  [
    { prompt: '6 + 18 ÷ 3 × 2 = ?', options: ['9', '16', '18', '24'], answerIndex: 2, explanation: '18 ÷ 3 = 6, 6 × 2 = 12, then 6 + 12 = 18' },
    { prompt: '20 − 4 × 3 + 2 = ?', options: ['6', '10', '50', '0'], answerIndex: 1, explanation: '4 × 3 = 12, then 20 − 12 + 2 = 10' },
    { prompt: '(12 − 4) × 2² ÷ 4 = ?', options: ['64', '16', '8', '4'], answerIndex: 2, explanation: 'Brackets: 8. Order: 2² = 4. Then 8 × 4 ÷ 4 = 8' },
  ],
  [
    { prompt: '48 ÷ 6 × (3 + 1) − 5 = ?', options: ['−3', '27', '20', '37'], answerIndex: 1, explanation: 'Brackets: 4. 48 ÷ 6 = 8, 8 × 4 = 32, 32 − 5 = 27' },
    { prompt: '7 + 3 × (10 − 4)² ÷ 9 = ?', options: ['40', '43', '12', '19'], answerIndex: 3, explanation: 'Brackets: 6. 6² = 36. 3 × 36 = 108, 108 ÷ 9 = 12, 7 + 12 = 19' },
    { prompt: '100 − 64 ÷ 8 × 2 + 3² = ?', options: ['93', '105', '75', '81'], answerIndex: 0, explanation: '3² = 9. 64 ÷ 8 = 8, 8 × 2 = 16. 100 − 16 + 9 = 93' },
  ],
  [
    { prompt: '5 × (6 − 2 × 2) + 15 ÷ 3 = ?', options: ['45', '25', '15', '10'], answerIndex: 2, explanation: 'Inside brackets: 2 × 2 = 4, 6 − 4 = 2. 5 × 2 = 10, 15 ÷ 3 = 5, 10 + 5 = 15' },
    { prompt: '2³ + 4 × (9 − 3) ÷ 2 + 1 = ?', options: ['37', '33', '19', '21'], answerIndex: 3, explanation: 'Brackets: 6. 2³ = 8. 4 × 6 = 24, 24 ÷ 2 = 12. 8 + 12 + 1 = 21' },
    { prompt: '81 ÷ (3 + 6) × 3 − 2 × 5 = ?', options: ['17', '−7', '125', '3'], answerIndex: 0, explanation: 'Brackets: 9. 81 ÷ 9 = 9, 9 × 3 = 27, 2 × 5 = 10, 27 − 10 = 17' },
  ],
];

const TIEBREAK_BIBLE: RawBible = { prompt: 'Which young man fell asleep and fell from a third-storey window while Paul preached late into the night?', answer: 'Eutychus', explanation: 'Acts 20:9' };
const TIEBREAK_MATH: RawMath = { prompt: '3 + 6 × (5 + 4) ÷ 3 − 7 = ?', options: ['20', '11', '14', '2'], answerIndex: 2, explanation: 'Brackets: 9. 6 × 9 = 54, 54 ÷ 3 = 18, 3 + 18 − 7 = 14' };

function bibleQ(id: string, q: RawBible): BbQuestion { return { id, category: 'bible', ...q }; }
function mathQ(id: string, q: RawMath): BbQuestion {
  return { id, category: 'math', ...q, answer: `${String.fromCharCode(65 + q.answerIndex)}. ${q.options[q.answerIndex]}` };
}

function buildQuestions() {
  const questionsById: Record<string, BbQuestion> = {};
  const add = (q: BbQuestion) => { questionsById[q.id] = q; return q; };

  // Practice rounds go to Simba then Kifaru so the leader flow gets exercised too; they never score.
  const testQueue: BbQueueEntry[] = [
    { teamId: 'simba', questionId: add(bibleQ('bb-p1', PRACTICE_BIBLE)).id, round: 0 },
    { teamId: 'kifaru', questionId: add(mathQ('bb-p2', PRACTICE_MATH)).id, round: 0 },
  ];

  const mainQueue: BbQueueEntry[] = [];
  for (let round = 1; round <= TOTAL_MAIN_ROUNDS; round++) {
    const set = Math.floor((round - 1) / 2);
    TEAM_META.forEach((team, t) => {
      const id = `bb-r${round}-${team.id}`;
      const q = roundCategory(round) === 'bible' ? bibleQ(id, MAIN_BIBLE[set][t]) : mathQ(id, MAIN_MATH[set][t]);
      mainQueue.push({ teamId: team.id, questionId: add(q).id, round });
    });
  }

  const tiebreakQuestions = [add(bibleQ('bb-t1', TIEBREAK_BIBLE)), add(mathQ('bb-t2', TIEBREAK_MATH))];
  return { questionsById, testQueue, mainQueue, tiebreakQuestions };
}

// Teams start with the same rosters people had in Methali Trivia. Read-only: the Methali doc is never written.
async function seedTeams(): Promise<BbTeam[]> {
  const methali = await getRedis().get<{ teams?: { id: string; members?: { name: string }[] }[] }>(KEYS.methali);
  return TEAM_META.map(t => ({
    ...t, score: 0,
    members: (methali?.teams?.find(m => m.id === t.id)?.members ?? []).map(m => ({ id: uuidv4(), name: m.name })),
  }));
}

function freshGame(teams: BbTeam[], timers: Record<BbCategory, number>): BbGame {
  return {
    teams, ...buildQuestions(), phase: 'idle', testIndex: 0, mainIndex: 0, tiebreakIndex: 0,
    current: null, pendingLeader: null, timers, log: [],
  };
}

export async function getBbGame(): Promise<BbGame> {
  const r = getRedis();
  const existing = await r.get<BbGame>(BB_KEY);
  if (existing) return existing;
  const game = freshGame(await seedTeams(), { ...DEFAULT_TIMERS });
  await r.set(BB_KEY, game);
  return game;
}

export async function saveBbGame(g: BbGame): Promise<void> { await getRedis().set(BB_KEY, g); }

export async function publishBbUpdate(g: BbGame): Promise<void> {
  await getRedis().publish(BB_CHANNEL, JSON.stringify(publicBbView(g)));
}

// What everyone can see. The answer of a live or upcoming question never leaves the server;
// it only appears in the log once the host resolves the round.
export function publicBbView(g: BbGame) {
  const q = g.current ? g.questionsById[g.current.questionId] : null;
  const next = nextUpPreview(g);
  const mainRound = g.mainQueue[Math.min(g.mainIndex, g.mainQueue.length - 1)]?.round ?? TOTAL_MAIN_ROUNDS;
  return {
    phase: g.phase,
    teams: g.teams.map(t => ({ id: t.id, name: t.name, emoji: t.emoji, score: t.score, members: t.members })),
    current: g.current && q ? {
      phase: g.current.phase, teamId: g.current.teamId, leader: g.current.leader,
      startedAt: g.current.startedAt, durationSeconds: g.current.durationSeconds,
      category: q.category, prompt: q.prompt, options: q.options ?? null,
    } : null,
    upNext: !g.current && next ? { teamId: next.teamId, category: next.question.category, leader: g.pendingLeader } : null,
    log: [...g.log].reverse(),
    progress: {
      mainIndex: g.mainIndex, mainTotal: g.mainQueue.length, mainRound, totalMainRounds: TOTAL_MAIN_ROUNDS,
      mainRoundCategory: roundCategory(mainRound),
      testIndex: g.testIndex, testTotal: g.testQueue.length,
      tiebreakIndex: g.tiebreakIndex, tiebreakTotal: g.tiebreakQuestions.length,
    },
  };
}

export function nextUpPreview(g: BbGame): { teamId: BbTeamId | null; round: number | null; question: BbQuestion } | null {
  if (g.current) return null;
  if (g.phase === 'test') {
    const e = g.testQueue[g.testIndex];
    return e ? { teamId: e.teamId, round: null, question: g.questionsById[e.questionId] } : null;
  }
  if (g.phase === 'main') {
    const e = g.mainQueue[g.mainIndex];
    return e ? { teamId: e.teamId, round: e.round, question: g.questionsById[e.questionId] } : null;
  }
  if (g.phase === 'tiebreak') {
    const q = g.tiebreakQuestions[g.tiebreakIndex];
    return q ? { teamId: g.pendingLeader?.teamId ?? null, round: null, question: q } : null;
  }
  return null;
}

// Picks a random leader from the people on the team with the fewest scored turns so far,
// so everyone gets a turn before anyone leads again. Re-rolling avoids the person just picked.
function pickLeader(g: BbGame, teamId: BbTeamId, avoid?: string): BbLeader | null {
  const team = g.teams.find(t => t.id === teamId);
  if (!team || team.members.length === 0) return null;
  const turns = new Map<string, number>();
  g.log.forEach(l => { if (l.teamId === teamId && l.phase !== 'test' && l.leaderId) turns.set(l.leaderId, (turns.get(l.leaderId) ?? 0) + 1); });
  const fewest = Math.min(...team.members.map(m => turns.get(m.id) ?? 0));
  let pool = team.members.filter(m => (turns.get(m.id) ?? 0) === fewest);
  if (avoid && pool.length > 1) pool = pool.filter(m => m.id !== avoid);
  const m = pool[Math.floor(Math.random() * pool.length)];
  return { memberId: m.id, name: m.name };
}

export function nominateLeader(g: BbGame, opts: { teamId?: BbTeamId }): BbGame {
  if (g.current) throw new Error('A round is already in progress');
  const next = nextUpPreview(g);
  if (!next) throw new Error('There is no upcoming question to nominate a leader for');
  const teamId = g.phase === 'tiebreak' ? opts.teamId : next.teamId;
  if (!teamId) throw new Error('Select which team is answering the tiebreaker');
  const avoid = g.pendingLeader?.teamId === teamId ? g.pendingLeader.memberId : undefined;
  const leader = pickLeader(g, teamId, avoid);
  if (!leader) throw new Error('That team has no players yet. Add some first');
  return { ...g, pendingLeader: { ...leader, teamId } };
}

export function startRound(g: BbGame, opts: { teamId?: BbTeamId }): BbGame {
  if (g.current) throw new Error('A round is already in progress');
  const next = nextUpPreview(g);
  if (!next) {
    if (g.phase === 'idle' || g.phase === 'finished') throw new Error('Set the phase to Practice, Main, or Tiebreak before starting a round');
    throw new Error('No questions left in this phase');
  }
  const teamId = g.phase === 'tiebreak' ? (opts.teamId ?? g.pendingLeader?.teamId) : next.teamId;
  if (!teamId) throw new Error('Select which team is answering the tiebreaker');
  const leader = g.pendingLeader?.teamId === teamId
    ? { memberId: g.pendingLeader.memberId, name: g.pendingLeader.name }
    : pickLeader(g, teamId);
  return {
    ...g, pendingLeader: null,
    current: {
      phase: g.phase, questionId: next.question.id, teamId, leader,
      startedAt: new Date().toISOString(), durationSeconds: g.timers[next.question.category],
    },
  };
}

export function cancelRound(g: BbGame): BbGame { return { ...g, current: null }; }

// Bible rounds are judged by the host (correct / close / wrong). Math rounds take the option the
// leader picked (null = no answer in time) and score themselves against the answer key.
export function resolveRound(g: BbGame, input: { outcome?: BbOutcome; choiceIndex?: number | null }): BbGame {
  if (!g.current) throw new Error('No round in progress');
  const { phase, questionId, teamId, leader } = g.current;
  const q = g.questionsById[questionId];
  let outcome: BbOutcome;
  let choiceIndex: number | null | undefined;
  if (q.category === 'math') {
    if (input.choiceIndex === undefined) throw new Error('Pick the option the leader chose');
    choiceIndex = input.choiceIndex;
    if (choiceIndex !== null && (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= (q.options?.length ?? 0))) throw new Error('Unknown option');
    outcome = choiceIndex === q.answerIndex ? 'correct' : 'wrong';
  } else {
    if (!input.outcome || !(input.outcome in OUTCOME_POINTS)) throw new Error('Pick correct, close, or wrong');
    outcome = input.outcome;
  }
  const team = teamId ? g.teams.find(t => t.id === teamId) ?? null : null;
  const isScored = phase !== 'test';
  const points = isScored ? OUTCOME_POINTS[outcome] : 0;
  const teams = isScored ? g.teams.map(t => (t.id === teamId ? { ...t, score: t.score + points } : t)) : g.teams;
  const round = phase === 'main' ? g.mainQueue[g.mainIndex]?.round ?? null : null;
  const log: BbRoundLog[] = [...g.log, {
    id: uuidv4(), phase, round, category: q.category, questionId, prompt: q.prompt, answer: q.answer,
    explanation: q.explanation, options: q.options, choiceIndex,
    teamId, teamName: team?.name ?? 'Practice round', leaderId: leader?.memberId ?? null, leaderName: leader?.name ?? null,
    outcome, points, loggedAt: new Date().toISOString(),
  }];
  let { mainIndex, testIndex, tiebreakIndex, phase: nextPhase } = g;
  if (phase === 'test') testIndex += 1;
  if (phase === 'main') { mainIndex += 1; if (mainIndex >= g.mainQueue.length) nextPhase = 'finished'; }
  if (phase === 'tiebreak') tiebreakIndex += 1;
  return { ...g, teams, log, mainIndex, testIndex, tiebreakIndex, phase: nextPhase, current: null };
}

export function setPhase(g: BbGame, phase: BbPhase): BbGame {
  if (g.current) throw new Error('Resolve the round in progress before changing phase');
  if (!['idle', 'test', 'main', 'tiebreak', 'finished'].includes(phase)) throw new Error('Unknown phase');
  return { ...g, phase, pendingLeader: null };
}

export function setTimer(g: BbGame, category: BbCategory, seconds: number): BbGame {
  if (category !== 'bible' && category !== 'math') throw new Error('Unknown category');
  if (!Number.isFinite(seconds) || seconds < MIN_TIMER_SECONDS || seconds > MAX_TIMER_SECONDS) {
    throw new Error(`Timer must be between ${MIN_TIMER_SECONDS} and ${MAX_TIMER_SECONDS} seconds`);
  }
  return { ...g, timers: { ...g.timers, [category]: Math.round(seconds) } };
}

export function resetGame(g: BbGame): BbGame {
  return freshGame(g.teams.map(t => ({ ...t, score: 0 })), g.timers);
}

export function addMember(g: BbGame, teamId: BbTeamId, name: string): BbGame {
  if (!g.teams.some(t => t.id === teamId)) throw new Error('Unknown team');
  return { ...g, teams: g.teams.map(t => (t.id === teamId ? { ...t, members: [...t.members, { id: uuidv4(), name }] } : t)) };
}

export function removeMember(g: BbGame, teamId: BbTeamId, memberId: string): BbGame {
  return {
    ...g,
    teams: g.teams.map(t => (t.id === teamId ? { ...t, members: t.members.filter(m => m.id !== memberId) } : t)),
    pendingLeader: g.pendingLeader?.memberId === memberId ? null : g.pendingLeader,
  };
}

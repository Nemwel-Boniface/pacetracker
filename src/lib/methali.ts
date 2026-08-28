import { getRedis, KEYS } from './redis';
import { v4 as uuidv4 } from 'uuid';

export type MethaliTeamId = 'simba' | 'kifaru' | 'chui';
export interface MethaliMember { id: string; name: string; }
export interface MethaliTeam { id: MethaliTeamId; name: string; emoji: string; members: MethaliMember[]; score: number; }
export interface MethaliQuestion { id: string; prompt: string; text: string; meaning: string; }
export type MethaliOutcome = 'full' | 'half' | 'none';
export type MethaliPhase = 'idle' | 'test' | 'main' | 'tiebreak' | 'finished';
export interface MethaliRoundLog {
  id: string; phase: MethaliPhase; questionId: string; methaliText: string; meaning: string;
  teamId: MethaliTeamId | null; teamName: string; outcome: MethaliOutcome; points: number; loggedAt: string;
}
export interface MethaliCurrentRound { phase: MethaliPhase; questionId: string; teamId: MethaliTeamId | null; startedAt: string; durationSeconds: number; }
export interface MethaliGame {
  teams: MethaliTeam[];
  testQuestions: MethaliQuestion[];
  mainQueue: { teamId: MethaliTeamId; questionId: string }[];
  tiebreakQuestions: MethaliQuestion[];
  questionsById: Record<string, MethaliQuestion>;
  phase: MethaliPhase;
  mainIndex: number;
  testIndex: number;
  tiebreakIndex: number;
  current: MethaliCurrentRound | null;
  timerSeconds: number;
  log: MethaliRoundLog[];
}

export const DEFAULT_TIMER_SECONDS = 30;
export const MIN_TIMER_SECONDS = 5;
export const MAX_TIMER_SECONDS = 300;
export const OUTCOME_POINTS: Record<MethaliOutcome, number> = { full: 20, half: 10, none: 0 };
export const OUTCOME_LABELS: Record<MethaliOutcome, string> = { full: '✅ Full methali + meaning', half: '🟡 Methali only', none: '❌ No one got it' };
export const METHALI_CHANNEL = 'pt:methali:events';

const TEAM_META: { id: MethaliTeamId; name: string; emoji: string }[] = [
  { id: 'simba', name: 'Team Simba', emoji: '🦁' },
  { id: 'kifaru', name: 'Team Kifaru', emoji: '🦏' },
  { id: 'chui', name: 'Team Chui', emoji: '🐆' },
];

const ROSTER: [string, MethaliTeamId][] = [
  ['Moses', 'simba'], ['Fred', 'kifaru'], ['Francis', 'chui'], ['Innocent', 'simba'], ['Stella', 'kifaru'],
  ['Steffany', 'chui'], ['Johari', 'simba'], ['Anne', 'kifaru'], ['Seraphine', 'chui'], ['Newton', 'simba'],
  ['Nemwel', 'kifaru'], ['James', 'chui'], ['Wechuli', 'simba'], ['Shayan', 'kifaru'], ['Betty', 'chui'],
  ['Nicole', 'simba'], ['Mwikali', 'kifaru'], ['Cyrus', 'chui'], ['Patience', 'simba'], ['Charles', 'kifaru'],
  ['Bett', 'chui'], ['Oscar', 'simba'], ['Chris', 'kifaru'], ['Larry', 'chui'], ['Mark', 'simba'],
  ['Kevin', 'kifaru'], ['Dansol', 'chui'], ['Zidane', 'simba'],
];

// Order: 2 test → 15 main (5 per team) → 3 tiebreak reserve.
// `prompt` is the half shown to players while the clock runs; `text` (the full methali) and
// `meaning` only surface after the round is resolved, so the reveal doesn't spoil the answer.
const RAW_METHALI: { prompt: string; text: string; meaning: string }[] = [
  { prompt: 'Ada ya mja...', text: 'Ada ya mja hulipwa', meaning: "A person's actions (good or bad) eventually catch up with them — you reap what you sow." },
  { prompt: 'Akili ni...', text: 'Akili ni mali', meaning: 'Intelligence/wisdom is true wealth — more valuable than material riches.' },
  { prompt: 'Baniani mbaya...', text: 'Baniani mbaya kiatu chake dawa', meaning: "Someone you dislike might still have something useful to offer you — don't dismiss people entirely." },
  { prompt: 'Cheka mdomo...', text: 'Cheka mdomo usicheke moyo', meaning: "You may laugh outwardly at someone's misfortune, but don't mock them in your heart — it could happen to you too." },
  { prompt: 'Dunia ni chombo,...', text: 'Dunia ni chombo, hukiwacha kwa aliyekitia', meaning: "The world (life's fortune) is like a vessel — it eventually gets left to someone else; nothing is permanent." },
  { prompt: 'Fimbo ya mnyonge...', text: 'Fimbo ya mnyonge haiumi', meaning: "The weak/poor person's threats carry no weight — power determines whose words matter." },
  { prompt: 'Guu la kuku...', text: 'Guu la kuku halimuumizi mwenzake', meaning: "A chicken's leg (however clumsy) doesn't hurt its fellow chicken — familiarity softens harm between close ones." },
  { prompt: 'Heri kufa macho...', text: 'Heri kufa macho kuliko kufa moyo', meaning: 'Better to lose your sight than to lose hope/spirit — inner resolve matters more than physical loss.' },
  { prompt: 'Ini la mnyonge...', text: 'Ini la mnyonge lachukuliwa na tai', meaning: "The weak person's prized possessions are taken by the strong — the powerful exploit the powerless." },
  { prompt: 'Jitihada...', text: 'Jitihada haiondoi kudura', meaning: 'Effort alone cannot override fate/destiny — though you should still try, some outcomes are beyond your control.' },
  { prompt: 'Kizuri chajiuza,...', text: 'Kizuri chajiuza, kibaya chajitembeza', meaning: 'Good quality sells itself; something bad has to be marketed/pushed onto people.' },
  { prompt: 'Kuuliza...', text: 'Kuuliza sio ujinga', meaning: "Asking questions is not a sign of foolishness — it's wise to seek knowledge." },
  { prompt: 'Maji yakimwagika...', text: 'Maji yakimwagika hayazoleki', meaning: "Once water is spilled, it can't be scooped back up — some actions/mistakes are irreversible." },
  { prompt: 'Mchagua nazi...', text: 'Mchagua nazi hupata koroma', meaning: 'One who is overly picky (e.g., choosing coconuts) often ends up with a bad one — being too choosy can backfire.' },
  { prompt: 'Mchumia juani...', text: 'Mchumia juani hulia kivulini', meaning: 'One who works hard in the sun labors so they can relax/eat in the shade later — hard work now brings comfort later.' },
  { prompt: 'Mkosa kitu...', text: 'Mkosa kitu hakikosi jina', meaning: 'Someone who lacks something will always be labeled by that lack — people are quick to name/judge deficiencies.' },
  { prompt: 'Mvumilivu...', text: 'Mvumilivu hula mbivu', meaning: 'The patient/persevering person eventually eats ripe fruit — patience is eventually rewarded.' },
  { prompt: 'Ngoja ngoja...', text: 'Ngoja ngoja huumiza matumbo', meaning: 'Constant waiting/procrastination causes stomach pain (frustration/suffering) — excessive delay causes harm.' },
  { prompt: 'Simba mwenda pole...', text: 'Simba mwenda pole ndiye mla nyama', meaning: 'The lion that walks slowly/calmly is the one that catches the meat — calculated patience beats recklessness in achieving goals.' },
  { prompt: 'Usiache mbachao...', text: "Usiache mbachao kwa msala upitao", meaning: "Don't abandon what's reliably yours for something uncertain that's passing by — value the stable/familiar over a fleeting temptation." },
];

function buildInitialGame(): MethaliGame {
  const teams: MethaliTeam[] = TEAM_META.map(t => ({ ...t, members: [], score: 0 }));
  const teamById = new Map(teams.map(t => [t.id, t]));
  ROSTER.forEach(([name, teamId], i) => { teamById.get(teamId)!.members.push({ id: `seed-${i}`, name }); });

  const questions: MethaliQuestion[] = RAW_METHALI.map((q, i) => ({ id: `mq-${i + 1}`, ...q }));
  const testQuestions = questions.slice(0, 2);
  const mainQuestions = questions.slice(2, 17);
  const tiebreakQuestions = questions.slice(17, 20);

  const mainQueue: { teamId: MethaliTeamId; questionId: string }[] = [];
  for (let round = 0; round < 5; round++) {
    teams.forEach((team, teamIdx) => { mainQueue.push({ teamId: team.id, questionId: mainQuestions[round * 3 + teamIdx].id }); });
  }

  const questionsById: Record<string, MethaliQuestion> = {};
  questions.forEach(q => { questionsById[q.id] = q; });

  return { teams, testQuestions, mainQueue, tiebreakQuestions, questionsById, phase: 'idle', mainIndex: 0, testIndex: 0, tiebreakIndex: 0, current: null, timerSeconds: DEFAULT_TIMER_SECONDS, log: [] };
}

function migrateGame(g: MethaliGame): { game: MethaliGame; changed: boolean } {
  let changed = false;
  let timerSeconds = g.timerSeconds;
  if (!timerSeconds) { timerSeconds = DEFAULT_TIMER_SECONDS; changed = true; }
  let questionsById = g.questionsById;
  let testQuestions = g.testQuestions;
  let mainQueue = g.mainQueue;
  let tiebreakQuestions = g.tiebreakQuestions;
  if (Object.values(questionsById).some(q => q.prompt == null)) {
    const fresh = buildInitialGame();
    questionsById = fresh.questionsById;
    testQuestions = fresh.testQuestions;
    mainQueue = fresh.mainQueue;
    tiebreakQuestions = fresh.tiebreakQuestions;
    changed = true;
  }
  if (!changed) return { game: g, changed: false };
  return { game: { ...g, timerSeconds, questionsById, testQuestions, mainQueue, tiebreakQuestions }, changed: true };
}

export async function getMethaliGame(): Promise<MethaliGame> {
  const r = getRedis();
  const existing = await r.get<MethaliGame>(KEYS.methali);
  if (existing) {
    const { game, changed } = migrateGame(existing);
    if (changed) await r.set(KEYS.methali, game);
    return game;
  }
  const fresh = buildInitialGame();
  await r.set(KEYS.methali, fresh);
  return fresh;
}

export async function saveMethaliGame(g: MethaliGame): Promise<void> { await getRedis().set(KEYS.methali, g); }

export async function publishMethaliUpdate(g: MethaliGame): Promise<void> {
  await getRedis().publish(METHALI_CHANNEL, JSON.stringify(publicMethaliView(g)));
}

export function publicMethaliView(g: MethaliGame) {
  return {
    phase: g.phase,
    teams: g.teams.map(t => ({ id: t.id, name: t.name, emoji: t.emoji, score: t.score, members: t.members })),
    current: g.current ? {
      phase: g.current.phase, teamId: g.current.teamId, startedAt: g.current.startedAt,
      durationSeconds: g.current.durationSeconds, prompt: g.questionsById[g.current.questionId]?.prompt ?? '',
    } : null,
    log: [...g.log].reverse(),
    progress: {
      mainIndex: g.mainIndex, mainTotal: g.mainQueue.length, mainRoundNumber: Math.min(5, Math.floor(g.mainIndex / 3) + 1), totalMainRounds: 5,
      testIndex: g.testIndex, testTotal: g.testQuestions.length,
      tiebreakIndex: g.tiebreakIndex, tiebreakTotal: g.tiebreakQuestions.length,
    },
  };
}

export function nextUpPreview(g: MethaliGame): { teamId: MethaliTeamId | null; question: MethaliQuestion } | null {
  if (g.current) return null;
  if (g.phase === 'test') { if (g.testIndex >= g.testQuestions.length) return null; return { teamId: null, question: g.testQuestions[g.testIndex] }; }
  if (g.phase === 'main') { if (g.mainIndex >= g.mainQueue.length) return null; const e = g.mainQueue[g.mainIndex]; return { teamId: e.teamId, question: g.questionsById[e.questionId] }; }
  if (g.phase === 'tiebreak') { if (g.tiebreakIndex >= g.tiebreakQuestions.length) return null; return { teamId: null, question: g.tiebreakQuestions[g.tiebreakIndex] }; }
  return null;
}

export function startRound(g: MethaliGame, opts: { teamId?: MethaliTeamId }): MethaliGame {
  if (g.current) throw new Error('A round is already in progress');
  let questionId: string; let teamId: MethaliTeamId | null;
  if (g.phase === 'test') {
    if (g.testIndex >= g.testQuestions.length) throw new Error('No test methali left — switch to Main to start the real game');
    questionId = g.testQuestions[g.testIndex].id; teamId = null;
  } else if (g.phase === 'main') {
    if (g.mainIndex >= g.mainQueue.length) throw new Error('All main-round methali have been played');
    const entry = g.mainQueue[g.mainIndex]; questionId = entry.questionId; teamId = entry.teamId;
  } else if (g.phase === 'tiebreak') {
    if (!opts.teamId) throw new Error('Select which team is answering the tiebreaker');
    if (g.tiebreakIndex >= g.tiebreakQuestions.length) throw new Error('No tiebreaker methali left');
    questionId = g.tiebreakQuestions[g.tiebreakIndex].id; teamId = opts.teamId;
  } else {
    throw new Error('Set the phase to Test, Main, or Tiebreak before starting a round');
  }
  return { ...g, current: { phase: g.phase, questionId, teamId, startedAt: new Date().toISOString(), durationSeconds: g.timerSeconds } };
}

export function cancelRound(g: MethaliGame): MethaliGame { return { ...g, current: null }; }

export function resolveRound(g: MethaliGame, outcome: MethaliOutcome): MethaliGame {
  if (!g.current) throw new Error('No round in progress');
  const { phase, questionId, teamId } = g.current;
  const question = g.questionsById[questionId];
  const team = teamId ? g.teams.find(t => t.id === teamId) ?? null : null;
  const isScored = phase !== 'test';
  const points = isScored ? OUTCOME_POINTS[outcome] : 0;
  const teams = isScored ? g.teams.map(t => (t.id === teamId ? { ...t, score: t.score + points } : t)) : g.teams;
  const log: MethaliRoundLog[] = [...g.log, {
    id: uuidv4(), phase, questionId, methaliText: question.text, meaning: question.meaning,
    teamId, teamName: team?.name ?? 'Practice round', outcome, points, loggedAt: new Date().toISOString(),
  }];
  let { mainIndex, testIndex, tiebreakIndex, phase: nextPhase } = g;
  if (phase === 'test') testIndex += 1;
  if (phase === 'main') { mainIndex += 1; if (mainIndex >= g.mainQueue.length) nextPhase = 'finished'; }
  if (phase === 'tiebreak') tiebreakIndex += 1;
  return { ...g, teams, log, mainIndex, testIndex, tiebreakIndex, phase: nextPhase, current: null };
}

export function setPhase(g: MethaliGame, phase: MethaliPhase): MethaliGame {
  if (g.current) throw new Error('Resolve the round in progress before changing phase');
  return { ...g, phase };
}

export function setTimerSeconds(g: MethaliGame, seconds: number): MethaliGame {
  if (!Number.isFinite(seconds) || seconds < MIN_TIMER_SECONDS || seconds > MAX_TIMER_SECONDS) {
    throw new Error(`Timer must be between ${MIN_TIMER_SECONDS} and ${MAX_TIMER_SECONDS} seconds`);
  }
  return { ...g, timerSeconds: Math.round(seconds) };
}

export function resetGame(g: MethaliGame): MethaliGame {
  const base = buildInitialGame();
  return { ...base, teams: g.teams.map(t => ({ ...t, score: 0 })), timerSeconds: g.timerSeconds };
}

export function addMember(g: MethaliGame, teamId: MethaliTeamId, name: string): MethaliGame {
  return { ...g, teams: g.teams.map(t => (t.id === teamId ? { ...t, members: [...t.members, { id: uuidv4(), name }] } : t)) };
}

export function removeMember(g: MethaliGame, teamId: MethaliTeamId, memberId: string): MethaliGame {
  return { ...g, teams: g.teams.map(t => (t.id === teamId ? { ...t, members: t.members.filter(m => m.id !== memberId) } : t)) };
}

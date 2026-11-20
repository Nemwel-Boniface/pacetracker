'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type TeamId = 'simba' | 'kifaru' | 'chui';
type Phase = 'idle' | 'test' | 'main' | 'tiebreak' | 'finished';
type Category = 'bible' | 'math';
type Outcome = 'correct' | 'close' | 'wrong';
interface Member { id: string; name: string; }
interface Leader { memberId: string; name: string; }
interface Team { id: TeamId; name: string; emoji: string; score: number; members: Member[]; }
interface Question { id: string; category: Category; prompt: string; options?: string[]; answerIndex?: number; answer: string; explanation: string; }
interface CurrentRound { phase: Phase; questionId: string; teamId: TeamId | null; leader: Leader | null; startedAt: string; durationSeconds: number; }
interface LogEntry { id: string; phase: Phase; round: number | null; category: Category; prompt: string; answer: string; choiceIndex?: number | null; options?: string[]; teamName: string; leaderName: string | null; outcome: Outcome; points: number; }
interface Game {
  teams: Team[];
  questionsById: Record<string, Question>;
  phase: Phase;
  testIndex: number; testQueue: unknown[];
  mainIndex: number; mainQueue: { teamId: TeamId; questionId: string; round: number }[];
  tiebreakIndex: number; tiebreakQuestions: Question[];
  current: CurrentRound | null;
  pendingLeader: (Leader & { teamId: TeamId }) | null;
  timers: Record<Category, number>;
  log: LogEntry[];
}
interface NextUp { teamId: TeamId | null; round: number | null; question: Question; }

const PHASE_LABELS: Record<Phase, string> = { idle: 'Idle', test: '🧪 Practice', main: '🏆 Main', tiebreak: '⚡ Tiebreak', finished: '🏁 Finished' };
const CATEGORY: Record<Category, { label: string; color: string }> = {
  bible: { label: '📖 Bible', color: '#7c3aed' },
  math: { label: '🧮 BODMAS', color: '#0369a1' },
};
const OUTCOME_STYLE: Record<Outcome, { bg: string; color: string; label: string }> = {
  correct: { bg: '#dcfce7', color: '#166534', label: '✅ Correct (+10)' },
  close: { bg: '#fef9c3', color: '#854d0e', label: '🟡 Close (+5)' },
  wrong: { bg: '#fef2f2', color: '#991b1b', label: '❌ Wrong (0)' },
};
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const card: React.CSSProperties = { background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: '16px', boxSizing: 'border-box' };
const btn: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 40 };
const label: React.CSSProperties = { fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 };

function useCountdown(startedAt?: string, durationSeconds?: number) {
  const [remaining, setRemaining] = useState(durationSeconds ?? 0);
  useEffect(() => {
    if (!startedAt || !durationSeconds) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil(durationSeconds - (Date.now() - new Date(startedAt).getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startedAt, durationSeconds]);
  return remaining;
}

function QuestionBlock({ q, heading }: { q: Question; heading: string }) {
  return (
    <>
      <div style={label}>{heading}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>{q.prompt}</div>
      {q.options && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {q.options.map((o, i) => (
            <span key={i} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: i === q.answerIndex ? '#dcfce7' : '#f3f4f6', color: i === q.answerIndex ? '#166534' : '#374151' }}>
              {LETTERS[i]}. {o}
            </span>
          ))}
        </div>
      )}
      <div style={label}>Answer (your reference)</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#166534' }}>{q.answer}</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>{q.explanation}</div>
    </>
  );
}

export default function AdminBibleBodmasPage() {
  const [game, setGame] = useState<Game | null>(null);
  const [nextUp, setNextUp] = useState<NextUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tiebreakTeam, setTiebreakTeam] = useState<TeamId | ''>('');
  const [newMemberName, setNewMemberName] = useState<Record<TeamId, string>>({ simba: '', kifaru: '', chui: '' });
  const [resetConfirm, setResetConfirm] = useState(false);
  const [timerInput, setTimerInput] = useState<Record<Category, string>>({ bible: '30', math: '45' });

  const apply = useCallback((data: { game: Game; nextUp: NextUp | null }) => {
    setGame(data.game); setNextUp(data.nextUp);
    setTimerInput({ bible: String(data.game.timers.bible), math: String(data.game.timers.math) });
  }, []);

  useEffect(() => {
    fetch('/api/admin/bible-bodmas')
      .then(res => res.json())
      .then(apply)
      .catch(() => { /* keep last known state */ })
      .finally(() => setLoading(false));
  }, [apply]);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/bible-bodmas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
      apply(data);
    } catch { setError('Connection error'); } finally { setBusy(false); }
  }

  const remaining = useCountdown(game?.current?.startedAt, game?.current?.durationSeconds);

  if (loading || !game) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading Bible & BODMAS control panel…</div>;
  }

  const current = game.current;
  const currentQuestion = current ? game.questionsById[current.questionId] : null;
  const teamOf = (id: TeamId | null | undefined) => (id ? game.teams.find(t => t.id === id) ?? null : null);
  const currentTeam = teamOf(current?.teamId);
  const isTiebreak = game.phase === 'tiebreak';
  const nextTeamId = isTiebreak ? (tiebreakTeam || null) : nextUp?.teamId ?? null;
  const nextUpTeam = teamOf(nextTeamId);
  const pending = game.pendingLeader && game.pendingLeader.teamId === nextTeamId ? game.pendingLeader : null;
  const mainRound = game.mainQueue[Math.min(game.mainIndex, game.mainQueue.length - 1)]?.round ?? 6;

  return (
    <div style={{ padding: '16px 12px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'clamp(21px,5vw,26px)', fontWeight: 900, color: '#1f2937', margin: 0 }}>📖🧮 Bible & BODMAS</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
          Run the live game, nominate round leaders, score answers, manage teams. Players watch at{' '}
          <Link href="/bible-bodmas" target="_blank" style={{ color: '#1a7a4a', fontWeight: 700 }}>/bible-bodmas</Link>.
        </p>
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Phase + timers */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Phase</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937' }}>{PHASE_LABELS[game.phase]}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['test', 'main', 'tiebreak'] as Phase[]).map(p => (
              <button key={p} disabled={busy || !!current || game.phase === p} onClick={() => act('phase', { phase: p })}
                style={{ ...btn, background: game.phase === p ? '#1a7a4a' : '#f3f4f6', color: game.phase === p ? 'white' : '#374151', opacity: busy || !!current ? 0.5 : 1 }}>
                {PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', flexWrap: 'wrap', marginBottom: 12 }}>
          <span>🧪 Practice {game.testIndex}/{game.testQueue.length}</span>
          <span>🏆 Main {game.mainIndex}/{game.mainQueue.length} (round {mainRound}/6 · {CATEGORY[mainRound % 2 === 1 ? 'bible' : 'math'].label})</span>
          <span>⚡ Tiebreak {game.tiebreakIndex}/{game.tiebreakQuestions.length}</span>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          🧪 Practice is the smoke test: it runs one Bible and one Math question through the full flow (leader, timer, scoring, live page) without touching the scores.
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
          {(['bible', 'math'] as Category[]).map(c => (
            <form key={c} onSubmit={e => { e.preventDefault(); const n = Number(timerInput[c]); if (Number.isFinite(n)) act('timer', { category: c, seconds: n }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>⏱️ {CATEGORY[c].label}</label>
              <input type="number" min={5} max={300} value={timerInput[c]} onChange={e => setTimerInput(prev => ({ ...prev, [c]: e.target.value }))}
                style={{ width: 64, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>s</span>
              <button type="submit" disabled={busy || Number(timerInput[c]) === game.timers[c]} style={{ ...btn, padding: '6px 12px', minHeight: 32, background: '#f3f4f6', color: '#374151' }}>Set</button>
            </form>
          ))}
        </div>
      </div>

      {/* Current / next-up round */}
      <div style={{ ...card, marginBottom: 16 }}>
        {current && currentQuestion ? (
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              <span style={{ color: CATEGORY[currentQuestion.category].color, fontWeight: 800 }}>{CATEGORY[currentQuestion.category].label}</span> · {PHASE_LABELS[current.phase]} in progress {currentTeam ? `· ${currentTeam.emoji} ${currentTeam.name}` : ''}
            </div>
            {current.leader && <div style={{ fontSize: 15, fontWeight: 800, color: '#c2410c', marginBottom: 10 }}>👑 Round leader: {current.leader.name}</div>}
            <QuestionBlock q={currentQuestion} heading="Shown to players" />
            <div style={{ fontSize: 40, fontWeight: 900, color: remaining <= 10 ? '#dc2626' : '#1a7a4a', marginBottom: 14, fontVariantNumeric: 'tabular-nums' }}>{remaining}s</div>
            {currentQuestion.category === 'math' ? (
              <>
                <div style={label}>Which option did the leader pick?</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {currentQuestion.options!.map((o, i) => (
                    <button key={i} disabled={busy} onClick={() => act('resolve', { choiceIndex: i })} style={{ ...btn, background: '#eff6ff', color: '#1e3a8a' }}>
                      {LETTERS[i]}. {o}
                    </button>
                  ))}
                  <button disabled={busy} onClick={() => act('resolve', { choiceIndex: null })} style={{ ...btn, background: '#fef2f2', color: '#991b1b' }}>⏰ No answer</button>
                  <button disabled={busy} onClick={() => act('cancel')} style={{ ...btn, background: '#f3f4f6', color: '#6b7280' }}>Cancel round</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(['correct', 'close', 'wrong'] as Outcome[]).map(o => (
                  <button key={o} disabled={busy} onClick={() => act('resolve', { outcome: o })} style={{ ...btn, background: OUTCOME_STYLE[o].bg, color: OUTCOME_STYLE[o].color }}>
                    {OUTCOME_STYLE[o].label}
                  </button>
                ))}
                <button disabled={busy} onClick={() => act('cancel')} style={{ ...btn, background: '#f3f4f6', color: '#6b7280' }}>Cancel round</button>
              </div>
            )}
          </div>
        ) : nextUp ? (
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Next up <span style={{ color: CATEGORY[nextUp.question.category].color, fontWeight: 800 }}>· {CATEGORY[nextUp.question.category].label}</span>
              {nextUp.round ? ` · Round ${nextUp.round}` : ''} {nextUpTeam ? `· ${nextUpTeam.emoji} ${nextUpTeam.name}` : ''}
            </div>
            {isTiebreak && (
              <select value={tiebreakTeam} onChange={e => setTiebreakTeam(e.target.value as TeamId)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, marginBottom: 10 }}>
                <option value="">Select answering team…</option>
                {game.teams.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff7ed', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={label}>Round leader (shown on the live page)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: pending ? '#c2410c' : '#9ca3af' }}>{pending ? `👑 ${pending.name}` : 'Not picked yet, picks itself on start'}</div>
              </div>
              <button disabled={busy || !nextTeamId} onClick={() => act('nominate', isTiebreak ? { teamId: tiebreakTeam } : undefined)}
                style={{ ...btn, background: '#f26522', color: 'white', opacity: busy || !nextTeamId ? 0.5 : 1 }}>
                🎲 {pending ? 'Pick someone else' : 'Nominate leader'}
              </button>
            </div>
            <QuestionBlock q={nextUp.question} heading="Will show to players" />
            <button
              disabled={busy || (isTiebreak && !tiebreakTeam)}
              onClick={() => act('start', isTiebreak ? { teamId: tiebreakTeam } : undefined)}
              style={{ ...btn, background: '#1a7a4a', color: 'white', opacity: busy || (isTiebreak && !tiebreakTeam) ? 0.5 : 1 }}
            >
              ▶️ Start {game.timers[nextUp.question.category]}s Timer
            </button>
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>
            {game.phase === 'idle' && 'Switch to Practice to run the smoke test, then Main to start the real game.'}
            {game.phase === 'test' && 'Both practice questions used. Switch to Main to start the real game.'}
            {game.phase === 'main' && 'All main-round questions have been played!'}
            {game.phase === 'tiebreak' && 'No tiebreaker questions left.'}
            {game.phase === 'finished' && 'Game complete, nice work! Reset to play again.'}
          </div>
        )}
      </div>

      {/* Team scores + rosters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginBottom: 16 }}>
        {game.teams.map(team => (
          <div key={team.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{team.emoji} {team.name} <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>({team.members.length})</span></div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1a7a4a' }}>{team.score}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {team.members.map(m => (
                <span key={m.id} style={{ background: '#f0fdf4', color: '#166534', fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {m.name}
                  <button onClick={() => act('removeMember', { teamId: team.id, memberId: m.id })} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontWeight: 900, padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); const name = newMemberName[team.id].trim(); if (!name) return; act('addMember', { teamId: team.id, name }); setNewMemberName(prev => ({ ...prev, [team.id]: '' })); }} style={{ display: 'flex', gap: 6 }}>
              <input value={newMemberName[team.id]} onChange={e => setNewMemberName(prev => ({ ...prev, [team.id]: e.target.value }))} placeholder="Add player…" style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
              <button type="submit" disabled={busy} style={{ ...btn, padding: '6px 12px', background: '#f3f4f6', color: '#374151' }}>Add</button>
            </form>
          </div>
        ))}
      </div>

      {/* Reset */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>Reset Game</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Clears scores, phase, leaders and history. Teams and timers stay. Use it after the smoke test if you scored anything.</div>
        </div>
        {resetConfirm ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={() => { act('reset'); setResetConfirm(false); }} style={{ ...btn, background: '#dc2626', color: 'white' }}>Confirm reset</button>
            <button onClick={() => setResetConfirm(false)} style={{ ...btn, background: '#f3f4f6', color: '#374151' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setResetConfirm(true)} style={{ ...btn, background: '#fef2f2', color: '#991b1b' }}>🔄 Reset Game</button>
        )}
      </div>

      {/* Log */}
      {game.log.length > 0 && (
        <div>
          <div style={{ fontWeight: 800, color: '#1f2937', fontSize: 14, marginBottom: 10 }}>📜 Round Log</div>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
            {[...game.log].reverse().map(entry => {
              const s = OUTCOME_STYLE[entry.outcome];
              return (
                <div key={entry.id} style={{ padding: '12px 16px', borderBottom: '1px solid #fafafa', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>
                      {entry.teamName}{entry.leaderName ? ` · 👑 ${entry.leaderName}` : ''}{' '}
                      <span style={{ fontWeight: 400, color: '#9ca3af' }}>· {PHASE_LABELS[entry.phase]}{entry.round ? ` R${entry.round}` : ''} · {CATEGORY[entry.category].label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151' }}>{entry.prompt}</div>
                    <div style={{ fontSize: 12, color: '#166534' }}>
                      {entry.answer}
                      {entry.category === 'math' && <span style={{ color: '#9ca3af' }}> · picked {entry.choiceIndex == null ? 'nothing' : `${LETTERS[entry.choiceIndex]}. ${entry.options?.[entry.choiceIndex]}`}</span>}
                    </div>
                  </div>
                  <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, flexShrink: 0 }}>{entry.phase === 'test' ? 'Practice' : s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState, useCallback } from 'react';

type TeamId = 'simba' | 'kifaru' | 'chui';
type Phase = 'idle' | 'test' | 'main' | 'tiebreak' | 'finished';
type Outcome = 'full' | 'half' | 'none';
interface Member { id: string; name: string; }
interface Team { id: TeamId; name: string; emoji: string; score: number; members: Member[]; }
interface Question { id: string; prompt: string; text: string; meaning: string; }
interface CurrentRound { phase: Phase; questionId: string; teamId: TeamId | null; startedAt: string; durationSeconds: number; }
interface LogEntry { id: string; phase: Phase; questionId: string; methaliText: string; meaning: string; teamId: TeamId | null; teamName: string; outcome: Outcome; points: number; loggedAt: string; }
interface Game {
  teams: Team[];
  questionsById: Record<string, Question>;
  phase: Phase;
  mainIndex: number; mainQueue: { teamId: TeamId; questionId: string }[];
  testIndex: number; testQuestions: Question[];
  tiebreakIndex: number; tiebreakQuestions: Question[];
  current: CurrentRound | null;
  timerSeconds: number;
  log: LogEntry[];
}
interface NextUp { teamId: TeamId | null; question: Question; }

const PHASE_LABELS: Record<Phase, string> = { idle: 'Idle', test: '🧪 Test', main: '🏆 Main', tiebreak: '⚡ Tiebreak', finished: '🏁 Finished' };
const OUTCOME_STYLE: Record<Outcome, { bg: string; color: string; label: string }> = {
  full: { bg: '#dcfce7', color: '#166534', label: '✅ Full (+20)' },
  half: { bg: '#fef9c3', color: '#854d0e', label: '🟡 Half (+10)' },
  none: { bg: '#fef2f2', color: '#991b1b', label: '❌ None (0)' },
};

const card: React.CSSProperties = { background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: '16px', boxSizing: 'border-box' };
const btn: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 40 };

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

export default function AdminMethaliTriviaPage() {
  const [game, setGame] = useState<Game | null>(null);
  const [nextUp, setNextUp] = useState<NextUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tiebreakTeam, setTiebreakTeam] = useState<TeamId | ''>('');
  const [newMemberName, setNewMemberName] = useState<Record<TeamId, string>>({ simba: '', kifaru: '', chui: '' });
  const [resetConfirm, setResetConfirm] = useState(false);
  const [timerInput, setTimerInput] = useState('30');

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/methali');
      const data = await res.json();
      setGame(data.game); setNextUp(data.nextUp);
    } catch { /* keep last known state */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGame(); }, [fetchGame]);
  useEffect(() => { if (game) setTimerInput(String(game.timerSeconds)); }, [game?.timerSeconds]);

  async function call(url: string, body?: unknown, method: 'POST' | 'DELETE' = 'POST') {
    setBusy(true); setError('');
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
      setGame(data.game); if ('nextUp' in data) setNextUp(data.nextUp);
    } catch { setError('Connection error'); } finally { setBusy(false); }
  }

  const remaining = useCountdown(game?.current?.startedAt, game?.current?.durationSeconds);

  if (loading || !game) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading trivia control panel…</div>;
  }

  const current = game.current;
  const currentQuestion = current ? game.questionsById[current.questionId] : null;
  const currentTeam = current?.teamId ? game.teams.find(t => t.id === current.teamId) : null;
  const nextUpTeam = nextUp?.teamId ? game.teams.find(t => t.id === nextUp.teamId) : null;

  return (
    <div style={{ padding: '16px 12px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'clamp(21px,5vw,26px)', fontWeight: 900, color: '#1f2937', margin: 0 }}>🏛️ Methali Trivia</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Run the live game, log points, manage rosters.</p>
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Phase controls */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Phase</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937' }}>{PHASE_LABELS[game.phase]}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['test', 'main', 'tiebreak'] as Phase[]).map(p => (
              <button key={p} disabled={busy || !!current || game.phase === p} onClick={() => call('/api/admin/methali/phase', { phase: p })}
                style={{ ...btn, background: game.phase === p ? '#1a7a4a' : '#f3f4f6', color: game.phase === p ? 'white' : '#374151', opacity: busy || !!current ? 0.5 : 1 }}>
                {PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', flexWrap: 'wrap', marginBottom: 12 }}>
          <span>🧪 Test {game.testIndex}/{game.testQuestions.length}</span>
          <span>🏆 Main {game.mainIndex}/{game.mainQueue.length} (round {Math.min(5, Math.floor(game.mainIndex / 3) + 1)}/5)</span>
          <span>⚡ Tiebreak {game.tiebreakIndex}/{game.tiebreakQuestions.length}</span>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); const n = Number(timerInput); if (Number.isFinite(n)) call('/api/admin/methali/timer', { seconds: n }); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #f3f4f6' }}
        >
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>⏱️ Timer per round</label>
          <input
            type="number" min={5} max={300} value={timerInput} onChange={e => setTimerInput(e.target.value)}
            style={{ width: 72, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
          />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>seconds (current: {game.timerSeconds}s)</span>
          <button type="submit" disabled={busy || Number(timerInput) === game.timerSeconds} style={{ ...btn, padding: '6px 12px', background: '#f3f4f6', color: '#374151' }}>Set</button>
        </form>
      </div>

      {/* Current / next-up round */}
      <div style={{ ...card, marginBottom: 16 }}>
        {current && currentQuestion ? (
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              {PHASE_LABELS[current.phase]} round in progress {currentTeam ? `— ${currentTeam.emoji} ${currentTeam.name}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Shown to players</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', fontStyle: 'italic', marginBottom: 10 }}>&ldquo;{currentQuestion.prompt}&rdquo;</div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Full answer (your reference)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', fontStyle: 'italic', marginBottom: 4 }}>&ldquo;{currentQuestion.text}&rdquo;</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>{currentQuestion.meaning}</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: remaining <= 10 ? '#dc2626' : '#1a7a4a', marginBottom: 14, fontVariantNumeric: 'tabular-nums' }}>{remaining}s</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(['full', 'half', 'none'] as Outcome[]).map(o => (
                <button key={o} disabled={busy} onClick={() => call('/api/admin/methali/resolve', { outcome: o })} style={{ ...btn, background: OUTCOME_STYLE[o].bg, color: OUTCOME_STYLE[o].color }}>
                  {OUTCOME_STYLE[o].label}
                </button>
              ))}
              <button disabled={busy} onClick={() => call('/api/admin/methali/cancel-round')} style={{ ...btn, background: '#f3f4f6', color: '#6b7280' }}>Cancel round</button>
            </div>
          </div>
        ) : nextUp ? (
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Next up {nextUpTeam ? `— ${nextUpTeam.emoji} ${nextUpTeam.name}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Will show to players</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', fontStyle: 'italic', marginBottom: 10 }}>&ldquo;{nextUp.question.prompt}&rdquo;</div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Full answer (your reference)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', fontStyle: 'italic', marginBottom: 4 }}>&ldquo;{nextUp.question.text}&rdquo;</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>{nextUp.question.meaning}</div>
            {game.phase === 'tiebreak' && (
              <select value={tiebreakTeam} onChange={e => setTiebreakTeam(e.target.value as TeamId)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, marginBottom: 10, marginRight: 10 }}>
                <option value="">Select answering team…</option>
                {game.teams.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
              </select>
            )}
            <div>
              <button
                disabled={busy || (game.phase === 'tiebreak' && !tiebreakTeam)}
                onClick={() => call('/api/admin/methali/start-round', game.phase === 'tiebreak' ? { teamId: tiebreakTeam } : undefined)}
                style={{ ...btn, background: '#1a7a4a', color: 'white', opacity: busy || (game.phase === 'tiebreak' && !tiebreakTeam) ? 0.5 : 1 }}
              >
                ▶️ Start {game.timerSeconds}s Timer
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>
            {game.phase === 'idle' && 'Switch to Test to walk through the rules, then Main to start the real game.'}
            {game.phase === 'test' && 'All practice methali used — switch to Main to start the real game.'}
            {game.phase === 'main' && 'All main-round methali have been played!'}
            {game.phase === 'tiebreak' && 'No tiebreaker methali left.'}
            {game.phase === 'finished' && 'Game complete — nice work! Reset to play again.'}
          </div>
        )}
      </div>

      {/* Team scores + rosters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginBottom: 16 }}>
        {game.teams.map(team => (
          <div key={team.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{team.emoji} {team.name}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1a7a4a' }}>{team.score}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {team.members.map(m => (
                <span key={m.id} style={{ background: '#f0fdf4', color: '#166534', fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {m.name}
                  <button onClick={() => call('/api/admin/methali/members', { teamId: team.id, memberId: m.id }, 'DELETE')} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontWeight: 900, padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); const name = newMemberName[team.id].trim(); if (!name) return; call('/api/admin/methali/members', { teamId: team.id, name }); setNewMemberName(prev => ({ ...prev, [team.id]: '' })); }} style={{ display: 'flex', gap: 6 }}>
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
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Clears scores, phase, and history. Rosters stay intact.</div>
        </div>
        {resetConfirm ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={() => { call('/api/admin/methali/reset'); setResetConfirm(false); }} style={{ ...btn, background: '#dc2626', color: 'white' }}>Confirm reset</button>
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
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{entry.teamName} <span style={{ fontWeight: 400, color: '#9ca3af' }}>· {PHASE_LABELS[entry.phase]}</span></div>
                    <div style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>&ldquo;{entry.methaliText}&rdquo;</div>
                  </div>
                  <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, flexShrink: 0 }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

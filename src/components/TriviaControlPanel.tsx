'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type TeamId = string;
type Phase = 'idle' | 'test' | 'main' | 'tiebreak' | 'finished';
type Outcome = 'full' | 'half' | 'none';
interface Peer { id: string; name: string; avatarInitials: string; }
interface Member { id: string; name: string; memberId?: string; }
interface Team { id: TeamId; name: string; score: number; members: Member[]; }
interface Question { id: string; phase: 'test' | 'main' | 'tiebreak'; prompt: string; text: string; meaning: string; }
interface CurrentRound { phase: Phase; questionId: string; teamId: TeamId | null; startedAt: string; durationSeconds: number; }
interface LogEntry { id: string; phase: Phase; questionId: string; methaliText: string; meaning: string; teamId: TeamId | null; teamName: string; outcome: Outcome; points: number; loggedAt: string; }
interface Game {
  challengeId: string; title: string; posterImageUrl?: string; visibility: 'public' | 'private'; scheduledAt?: string;
  teams: Team[]; questionsById: Record<string, Question>;
  phase: Phase; mainIndex: number; mainQueue: { teamId: TeamId; questionId: string }[];
  testIndex: number; testQuestions: Question[];
  tiebreakIndex: number; tiebreakQuestions: Question[];
  current: CurrentRound | null; timerSeconds: number; log: LogEntry[];
}
interface NextUp { teamId: TeamId | null; question: Question; }

const PHASE_LABELS: Record<Phase, string> = { idle: 'Idle', test: '🧪 Test', main: '🏆 Main', tiebreak: '⚡ Tiebreak', finished: '🏁 Finished' };
const OUTCOME_STYLE: Record<Outcome, { bg: string; color: string; label: string }> = {
  full: { bg: '#dcfce7', color: '#166534', label: '✅ Full (+20)' },
  half: { bg: '#fef9c3', color: '#854d0e', label: '🟡 Half (+10)' },
  none: { bg: '#fef2f2', color: '#991b1b', label: '❌ None (0)' },
};

const card: React.CSSProperties = { background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 16, boxSizing: 'border-box' };
const btn: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 40 };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' };

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

export default function TriviaControlPanel({ challengeId, viewerIsAdmin }: { challengeId: string; viewerIsAdmin: boolean }) {
  const [game, setGame] = useState<Game | null>(null);
  const [nextUp, setNextUp] = useState<NextUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tiebreakTeam, setTiebreakTeam] = useState<TeamId | ''>('');
  const [newMemberInput, setNewMemberInput] = useState<Record<TeamId, string>>({});
  const [newTeamName, setNewTeamName] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [timerInput, setTimerInput] = useState('30');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [settingsForm, setSettingsForm] = useState({ posterImageUrl: '', visibility: 'public' as 'public' | 'private', scheduledAt: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/trivia`);
      if (res.status === 401) { setForbidden(true); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load trivia'); return; }
      setGame(data.game); setNextUp(data.nextUp);
    } catch { setError('Connection error'); } finally { setLoading(false); }
  }, [challengeId]);

  useEffect(() => { fetchGame(); }, [fetchGame]);
  useEffect(() => { if (game) { setTimerInput(String(game.timerSeconds)); setSettingsForm({ posterImageUrl: game.posterImageUrl || '', visibility: game.visibility, scheduledAt: game.scheduledAt ? game.scheduledAt.slice(0, 16) : '' }); } }, [game?.timerSeconds, game?.posterImageUrl, game?.visibility, game?.scheduledAt]);
  useEffect(() => { fetch('/api/member/peers').then(r => r.json()).then(d => setPeers(d.peers || [])).catch(() => {}); }, []);

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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading trivia control panel…</div>;
  if (forbidden) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 8 }}>You don&apos;t manage this trivia</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 14 }}>Only the creator or a site admin can run this game.</div>
        <Link href={`/trivias/${challengeId}`} style={{ color: '#1a7a4a', fontWeight: 700, fontSize: 13 }}>Watch it live instead →</Link>
      </div>
    );
  }
  if (!game) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Trivia not found.</div>;

  const current = game.current;
  const currentQuestion = current ? game.questionsById[current.questionId] : null;
  const currentTeam = current?.teamId ? game.teams.find(t => t.id === current.teamId) : null;
  const nextUpTeam = nextUp?.teamId ? game.teams.find(t => t.id === nextUp.teamId) : null;

  return (
    <div>
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
              <button key={p} disabled={busy || !!current || game.phase === p} onClick={() => call(`/api/challenges/${challengeId}/trivia/phase`, { phase: p })}
                style={{ ...btn, background: game.phase === p ? '#1a7a4a' : '#f3f4f6', color: game.phase === p ? 'white' : '#374151', opacity: busy || !!current ? 0.5 : 1 }}>
                {PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', flexWrap: 'wrap', marginBottom: 12 }}>
          <span>🧪 Test {game.testIndex}/{game.testQuestions.length}</span>
          <span>🏆 Main {game.mainIndex}/{game.mainQueue.length}</span>
          <span>⚡ Tiebreak {game.tiebreakIndex}/{game.tiebreakQuestions.length}</span>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); const n = Number(timerInput); if (Number.isFinite(n)) call(`/api/challenges/${challengeId}/trivia/timer`, { seconds: n }); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #f3f4f6' }}
        >
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>⏱️ Timer per round</label>
          <input type="number" min={5} max={300} value={timerInput} onChange={e => setTimerInput(e.target.value)} style={{ width: 72, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>seconds (current: {game.timerSeconds}s)</span>
          <button type="submit" disabled={busy || Number(timerInput) === game.timerSeconds} style={{ ...btn, padding: '6px 12px', background: '#f3f4f6', color: '#374151' }}>Set</button>
        </form>
      </div>

      {/* Current / next-up round */}
      <div style={{ ...card, marginBottom: 16 }}>
        {current && currentQuestion ? (
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              {PHASE_LABELS[current.phase]} round in progress {currentTeam ? `— ${currentTeam.name}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Shown to players</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', fontStyle: 'italic', marginBottom: 10 }}>&ldquo;{currentQuestion.prompt}&rdquo;</div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Full answer (your reference)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', fontStyle: 'italic', marginBottom: 4 }}>&ldquo;{currentQuestion.text}&rdquo;</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>{currentQuestion.meaning}</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: remaining <= 10 ? '#dc2626' : '#1a7a4a', marginBottom: 14, fontVariantNumeric: 'tabular-nums' }}>{remaining}s</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(['full', 'half', 'none'] as Outcome[]).map(o => (
                <button key={o} disabled={busy} onClick={() => call(`/api/challenges/${challengeId}/trivia/resolve`, { outcome: o })} style={{ ...btn, background: OUTCOME_STYLE[o].bg, color: OUTCOME_STYLE[o].color }}>
                  {OUTCOME_STYLE[o].label}
                </button>
              ))}
              <button disabled={busy} onClick={() => call(`/api/challenges/${challengeId}/trivia/cancel-round`)} style={{ ...btn, background: '#f3f4f6', color: '#6b7280' }}>Cancel round</button>
            </div>
          </div>
        ) : nextUp ? (
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Next up {nextUpTeam ? `— ${nextUpTeam.name}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Will show to players</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', fontStyle: 'italic', marginBottom: 10 }}>&ldquo;{nextUp.question.prompt}&rdquo;</div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Full answer (your reference)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', fontStyle: 'italic', marginBottom: 4 }}>&ldquo;{nextUp.question.text}&rdquo;</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>{nextUp.question.meaning}</div>
            {game.phase === 'tiebreak' && (
              <select value={tiebreakTeam} onChange={e => setTiebreakTeam(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, marginBottom: 10, marginRight: 10 }}>
                <option value="">Select answering team…</option>
                {game.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <div>
              <button
                disabled={busy || (game.phase === 'tiebreak' && !tiebreakTeam)}
                onClick={() => call(`/api/challenges/${challengeId}/trivia/start-round`, game.phase === 'tiebreak' ? { teamId: tiebreakTeam } : undefined)}
                style={{ ...btn, background: '#1a7a4a', color: 'white', opacity: busy || (game.phase === 'tiebreak' && !tiebreakTeam) ? 0.5 : 1 }}
              >
                ▶️ Start {game.timerSeconds}s Timer
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>
            {game.phase === 'idle' && 'Switch to Test (optional) or Main to get started.'}
            {game.phase === 'test' && 'All practice questions used — switch to Main to start the real game.'}
            {game.phase === 'main' && 'All main-round questions have been played!'}
            {game.phase === 'tiebreak' && 'No tiebreaker questions left.'}
            {game.phase === 'finished' && 'Game complete — nice work! Reset to play again.'}
          </div>
        )}
      </div>

      {/* Team scores + rosters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginBottom: 16 }}>
        {game.teams.map(team => (
          <div key={team.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{team.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1a7a4a' }}>{team.score}</div>
                {game.phase === 'idle' && game.teams.length > 2 && (
                  <button onClick={() => call(`/api/challenges/${challengeId}/trivia/teams`, { teamId: team.id }, 'DELETE')} disabled={busy} title="Remove team" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13 }}>🗑️</button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {team.members.map(m => (
                <span key={m.id} style={{ background: '#f0fdf4', color: '#166534', fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {m.name}
                  <button onClick={() => call(`/api/challenges/${challengeId}/trivia/members`, { teamId: team.id, memberId: m.id }, 'DELETE')} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontWeight: 900, padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <select
                value=""
                onChange={e => { if (e.target.value) { const peer = peers.find(p => p.id === e.target.value); call(`/api/challenges/${challengeId}/trivia/members`, { teamId: team.id, memberId: e.target.value, name: peer?.name }); } }}
                style={{ flex: 1, minWidth: 120, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
              >
                <option value="">+ Add from members…</option>
                {peers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <form onSubmit={e => { e.preventDefault(); const name = (newMemberInput[team.id] || '').trim(); if (!name) return; call(`/api/challenges/${challengeId}/trivia/members`, { teamId: team.id, name }); setNewMemberInput(prev => ({ ...prev, [team.id]: '' })); }} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input value={newMemberInput[team.id] || ''} onChange={e => setNewMemberInput(prev => ({ ...prev, [team.id]: e.target.value }))} placeholder="Or add a guest name…" style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
              <button type="submit" disabled={busy} style={{ ...btn, padding: '6px 12px', background: '#f3f4f6', color: '#374151' }}>Add</button>
            </form>
          </div>
        ))}
      </div>

      {game.phase === 'idle' && (
        <form onSubmit={e => { e.preventDefault(); if (!newTeamName.trim()) return; call(`/api/challenges/${challengeId}/trivia/teams`, { name: newTeamName.trim() }); setNewTeamName(''); }} style={{ ...card, marginBottom: 16, display: 'flex', gap: 8 }}>
          <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="+ Add another team…" style={{ ...inp, flex: 1 }} />
          <button type="submit" disabled={busy} style={{ ...btn, background: '#f3f4f6', color: '#374151' }}>Add Team</button>
        </form>
      )}

      {/* Settings */}
      <form
        onSubmit={e => {
          e.preventDefault(); setSavingSettings(true);
          fetch(`/api/challenges/${challengeId}/trivia/settings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posterImageUrl: settingsForm.posterImageUrl, visibility: settingsForm.visibility, scheduledAt: settingsForm.scheduledAt || null }),
          }).then(r => r.json()).then(d => { if (d.game) setGame(d.game); }).finally(() => setSavingSettings(false));
        }}
        style={{ ...card, marginBottom: 16 }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', marginBottom: 12 }}>⚙️ Trivia Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Poster image URL</label>
            <input value={settingsForm.posterImageUrl} onChange={e => setSettingsForm(f => ({ ...f, posterImageUrl: e.target.value }))} placeholder="https://…" style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Visibility</label>
            <select value={settingsForm.visibility} onChange={e => setSettingsForm(f => ({ ...f, visibility: e.target.value as 'public' | 'private' }))} style={inp}>
              <option value="public">🌍 Public — anyone can watch</option>
              <option value="private">🔒 Private — sign-in required</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Schedule for later (optional)</label>
            <input type="datetime-local" value={settingsForm.scheduledAt} onChange={e => setSettingsForm(f => ({ ...f, scheduledAt: e.target.value }))} style={inp} />
          </div>
        </div>
        <button type="submit" disabled={savingSettings} style={{ ...btn, background: '#1a7a4a', color: 'white' }}>{savingSettings ? 'Saving…' : 'Save Settings'}</button>
      </form>

      {/* Reset */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>Reset Game</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Clears scores, phase, and history. Rosters stay intact.</div>
        </div>
        {resetConfirm ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={() => { call(`/api/challenges/${challengeId}/trivia/reset`); setResetConfirm(false); }} style={{ ...btn, background: '#dc2626', color: 'white' }}>Confirm reset</button>
            <button onClick={() => setResetConfirm(false)} style={{ ...btn, background: '#f3f4f6', color: '#374151' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setResetConfirm(true)} style={{ ...btn, background: '#fef2f2', color: '#991b1b' }}>🔄 Reset Game</button>
        )}
      </div>

      {viewerIsAdmin && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>🛡️ You&apos;re managing this trivia as a site admin, on behalf of its creator.</div>}

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

'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type TeamId = 'simba' | 'kifaru' | 'chui';
type Category = 'bible' | 'math';
type Outcome = 'correct' | 'close' | 'wrong';
interface Member { id: string; name: string; }
interface Leader { memberId: string; name: string; }
interface Team { id: TeamId; name: string; emoji: string; score: number; members: Member[]; }
interface CurrentRound { phase: string; teamId: TeamId | null; leader: Leader | null; startedAt: string; durationSeconds: number; category: Category; prompt: string; options: string[] | null; }
interface UpNext { teamId: TeamId | null; category: Category; leader: (Leader & { teamId: TeamId }) | null; }
interface LogEntry { id: string; phase: string; round: number | null; category: Category; prompt: string; answer: string; explanation: string; options?: string[]; choiceIndex?: number | null; teamId: TeamId | null; teamName: string; leaderName: string | null; outcome: Outcome; points: number; }
interface State {
  phase: 'idle' | 'test' | 'main' | 'tiebreak' | 'finished';
  teams: Team[];
  current: CurrentRound | null;
  upNext: UpNext | null;
  log: LogEntry[];
  progress: { mainIndex: number; mainTotal: number; mainRound: number; totalMainRounds: number; mainRoundCategory: Category };
}

const CATEGORY: Record<Category, { label: string; color: string }> = {
  bible: { label: '📖 Bible', color: '#7c3aed' },
  math: { label: '🧮 BODMAS', color: '#0369a1' },
};
const OUTCOME_STYLE: Record<Outcome, { bg: string; color: string; label: string }> = {
  correct: { bg: '#dcfce7', color: '#166534', label: '✅ Correct (+10)' },
  close: { bg: '#fef9c3', color: '#854d0e', label: '🟡 Close (+5)' },
  wrong: { bg: '#fef2f2', color: '#991b1b', label: '❌ Missed (0)' },
};
const PHASE_BANNER: Record<State['phase'], { label: string; sub: string }> = {
  idle: { label: '⏳ Waiting to start', sub: 'The host will kick things off shortly. This page updates live, no need to refresh.' },
  test: { label: '🧪 Practice Round', sub: "Just a warm-up. These don't count for points." },
  main: { label: '🏆 Main Game', sub: 'Only the round leader answers. Teammates, no whispering! 🤫' },
  tiebreak: { label: '⚡ Tiebreaker!', sub: 'Sudden death. One more question to settle it.' },
  finished: { label: '🏁 Game Over', sub: 'Thanks for playing Bible & BODMAS!' },
};
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function Countdown({ startedAt, durationSeconds }: { startedAt: string; durationSeconds: number }) {
  const [remaining, setRemaining] = useState(durationSeconds);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil(durationSeconds - (Date.now() - new Date(startedAt).getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startedAt, durationSeconds]);
  return (
    <div style={{ fontSize: 'clamp(40px,12vw,56px)', fontWeight: 900, color: remaining <= 10 ? '#f87171' : 'white', fontVariantNumeric: 'tabular-nums' }}>
      {remaining}s
    </div>
  );
}

export default function BibleBodmasPage() {
  const [state, setState] = useState<State | null>(null);
  const [expanded, setExpanded] = useState<TeamId | null>(null);
  const [connId, setConnId] = useState(0);
  const [live, setLive] = useState(false);

  const reconnect = useCallback(() => setConnId(n => n + 1), []);

  useEffect(() => {
    const es = new EventSource('/api/bible-bodmas/stream');
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = evt => { try { setState(JSON.parse(evt.data)); setLive(true); } catch { /* ignore malformed frame */ } };
    return () => es.close();
  }, [connId]);

  if (!state) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const banner = PHASE_BANNER[state.phase];
  const teamOf = (id: TeamId | null | undefined) => (id ? state.teams.find(t => t.id === id) ?? null : null);
  const activeTeam = teamOf(state.current?.teamId);
  const upNextTeam = teamOf(state.upNext?.teamId ?? state.upNext?.leader?.teamId);
  const sortedTeams = [...state.teams].sort((a, b) => b.score - a.score);

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: 'linear-gradient(135deg,#3b0764 0%,#145c38 55%,#f26522 100%)', color: 'white' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '1.5rem 1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: 32, height: 32, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🦏</div>
              <span style={{ fontWeight: 900, fontSize: 18, whiteSpace: 'nowrap' }}>PaceTracker</span>
            </div>
            <Link href="/leaderboard" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textDecoration: 'underline', flexShrink: 0 }}>← Leaderboard</Link>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Ginja AI · #Move2026</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'clamp(26px,7vw,32px)', fontWeight: 900, margin: '0 0 4px' }}>📖🧮 Bible & BODMAS</h1>
            <span title={live ? 'Live, updates instantly' : 'Reconnecting…'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '3px 9px', borderRadius: 20, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: live ? '#4ade80' : '#fbbf24', display: 'inline-block' }} />
              {live ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: 14 }}>One leader per team, per round. Scripture and sums, back to back.</p>
        </div>
      </header>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '20px 14px 40px' }}>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: '16px 18px', marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: '#1f2937' }}>{banner.label}</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{banner.sub}</div>
          {state.phase === 'main' && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Round {state.progress.mainRound} of {state.progress.totalMainRounds} · <span style={{ color: CATEGORY[state.progress.mainRoundCategory].color, fontWeight: 700 }}>{CATEGORY[state.progress.mainRoundCategory].label}</span>
            </div>
          )}
        </div>

        {state.current && (
          <div style={{ background: 'linear-gradient(135deg,#1f2937,#111827)', borderRadius: 18, padding: '22px 18px', marginBottom: 18, textAlign: 'center' }}>
            <div style={{ display: 'inline-block', background: CATEGORY[state.current.category].color, color: 'white', fontSize: 12, fontWeight: 800, padding: '3px 12px', borderRadius: 20, marginBottom: 10 }}>
              {CATEGORY[state.current.category].label}{state.current.phase === 'test' ? ' · Practice' : ''}
            </div>
            {activeTeam && (
              <div style={{ fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 4 }}>{activeTeam.emoji} {activeTeam.name}</div>
            )}
            {state.current.leader && (
              <div style={{ fontSize: 15, color: '#fde68a', fontWeight: 700, marginBottom: 12 }}>👑 Round leader: {state.current.leader.name}</div>
            )}
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 'clamp(19px,5.2vw,25px)', fontWeight: 800, color: 'white', lineHeight: 1.35, wordBreak: 'break-word' }}>
                {state.current.prompt}
              </div>
            </div>
            {state.current.options && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 14 }}>
                {state.current.options.map((o, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: 'white', fontWeight: 800, fontSize: 18, textAlign: 'left' }}>
                    <span style={{ color: '#93c5fd', marginRight: 8 }}>{LETTERS[i]}.</span>{o}
                  </div>
                ))}
              </div>
            )}
            <Countdown startedAt={state.current.startedAt} durationSeconds={state.current.durationSeconds} />
          </div>
        )}

        {!state.current && state.upNext && upNextTeam && (
          <div style={{ background: 'white', borderRadius: 16, border: '2px dashed #f26522', padding: '14px 18px', marginBottom: 18, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Up next · {CATEGORY[state.upNext.category].label}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1f2937', marginTop: 4 }}>{upNextTeam.emoji} {upNextTeam.name}</div>
            {state.upNext.leader
              ? <div style={{ fontSize: 15, fontWeight: 800, color: '#c2410c', marginTop: 4 }}>👑 {state.upNext.leader.name}, you&apos;re leading this one. Step up!</div>
              : <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>The host is about to pick a round leader…</div>}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
          {sortedTeams.map((team, i) => (
            <div
              key={team.id}
              onClick={() => setExpanded(expanded === team.id ? null : team.id)}
              style={{
                background: 'white', borderRadius: 16, padding: '16px', cursor: 'pointer',
                border: state.current?.teamId === team.id ? '2px solid #f26522' : '1px solid #f3f4f6',
                boxShadow: i === 0 && team.score > 0 ? '0 0 0 1px #fde68a' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>{team.emoji} {team.name}</div>
                {i === 0 && team.score > 0 && <span style={{ fontSize: 16 }}>👑</span>}
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#1a7a4a', marginTop: 4 }}>{team.score}<span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}> pts</span></div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{team.members.length} members {expanded === team.id ? '▲' : '▼'}</div>
              {expanded === team.id && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {team.members.map(m => (
                    <span key={m.id} style={{ background: '#f0fdf4', color: '#166534', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{m.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {!live && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <button onClick={reconnect} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ↻ Reconnect
            </button>
          </div>
        )}

        {state.log.length > 0 && (
          <div>
            <div style={{ fontWeight: 800, color: '#1f2937', fontSize: 14, marginBottom: 10 }}>📜 Recap</div>
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
              {state.log.map(entry => {
                const s = OUTCOME_STYLE[entry.outcome];
                const picked = entry.category === 'math'
                  ? (entry.choiceIndex == null ? 'No answer' : `Picked ${LETTERS[entry.choiceIndex]}. ${entry.options?.[entry.choiceIndex] ?? ''}`)
                  : null;
                return (
                  <div key={entry.id} style={{ padding: '12px 16px', borderBottom: '1px solid #fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>
                        {entry.teamName}{entry.leaderName ? ` · 👑 ${entry.leaderName}` : ''}
                        <span style={{ fontWeight: 600, color: CATEGORY[entry.category].color, marginLeft: 6 }}>{CATEGORY[entry.category].label}</span>
                      </span>
                      <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, flexShrink: 0 }}>
                        {entry.phase === 'test' ? s.label.replace(/\s*\(.*\)/, ' (practice)') : s.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151' }}>{entry.prompt}</div>
                    <div style={{ fontSize: 13, color: '#166534', fontWeight: 700, marginTop: 2 }}>Answer: {entry.answer}{picked ? <span style={{ color: '#9ca3af', fontWeight: 500 }}> · {picked}</span> : null}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{entry.explanation}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state.log.length === 0 && state.phase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>📖🧮</div>
            <p>Three teams, six rounds, one leader at a time. Good luck!</p>
          </div>
        )}
      </main>
    </div>
  );
}

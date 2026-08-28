'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';

type TeamId = 'simba' | 'kifaru' | 'chui';
interface Member { id: string; name: string; }
interface Team { id: TeamId; name: string; emoji: string; score: number; members: Member[]; }
interface CurrentRound { phase: string; teamId: TeamId | null; startedAt: string; durationSeconds: number; prompt: string; }
interface LogEntry { id: string; phase: string; methaliText: string; meaning: string; teamId: TeamId | null; teamName: string; outcome: 'full' | 'half' | 'none'; points: number; loggedAt: string; }
interface State {
  phase: 'idle' | 'test' | 'main' | 'tiebreak' | 'finished';
  teams: Team[];
  current: CurrentRound | null;
  log: LogEntry[];
  progress: { mainIndex: number; mainTotal: number; mainRoundNumber: number; totalMainRounds: number; testIndex: number; testTotal: number; tiebreakIndex: number; tiebreakTotal: number };
}

const OUTCOME_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  full: { bg: '#dcfce7', color: '#166534', label: '✅ Full methali + meaning (+20)' },
  half: { bg: '#fef9c3', color: '#854d0e', label: '🟡 Methali only (+10)' },
  none: { bg: '#fef2f2', color: '#991b1b', label: '❌ No one got it (0)' },
};

const PHASE_BANNER: Record<State['phase'], { label: string; sub: string }> = {
  idle: { label: '⏳ Waiting to start', sub: 'The admin will kick things off shortly — this page updates live, no need to refresh.' },
  test: { label: '🧪 Practice Round', sub: "Just a warm-up — these don't count for points." },
  main: { label: '🏆 Main Round', sub: 'Complete the methali when your team is called!' },
  tiebreak: { label: '⚡ Tiebreaker!', sub: 'Sudden death — one more methali to settle the score.' },
  finished: { label: '🏁 Game Over', sub: 'Thanks for playing Methali Trivia!' },
};

function Countdown({ startedAt, durationSeconds }: { startedAt: string; durationSeconds: number }) {
  const [remaining, setRemaining] = useState(durationSeconds);
  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      setRemaining(Math.max(0, Math.ceil(durationSeconds - elapsed)));
    };
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

export default function MethaliTriviaPage() {
  const [state, setState] = useState<State | null>(null);
  const [expanded, setExpanded] = useState<TeamId | null>(null);
  const [connId, setConnId] = useState(0);
  const [live, setLive] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const reconnect = useCallback(() => setConnId(n => n + 1), []);

  useEffect(() => {
    const es = new EventSource('/api/methali/stream');
    esRef.current = es;
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
  const activeTeam = state.current?.teamId ? state.teams.find(t => t.id === state.current!.teamId) : null;
  const sortedTeams = [...state.teams].sort((a, b) => b.score - a.score);

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', color: 'white' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '1.5rem 1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: 32, height: 32, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🦏</div>
              <span style={{ fontWeight: 900, fontSize: 18, whiteSpace: 'nowrap' }}>PaceTracker</span>
            </div>
            <Link href="/leaderboard" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textDecoration: 'underline', flexShrink: 0 }}>← Leaderboard</Link>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Eden Care · #Move2026</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'clamp(26px,7vw,32px)', fontWeight: 900, margin: '0 0 4px' }}>🏛️ Methali Trivia</h1>
            <span title={live ? 'Live — updates instantly' : 'Reconnecting…'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '3px 9px', borderRadius: 20, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: live ? '#4ade80' : '#fbbf24', display: 'inline-block' }} />
              {live ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: 14 }}>Complete the Swahili proverb, win the points.</p>
        </div>
      </header>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '20px 14px 40px' }}>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: '16px 18px', marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: '#1f2937' }}>{banner.label}</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{banner.sub}</div>
          {state.phase === 'main' && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Round {state.progress.mainRoundNumber} of {state.progress.totalMainRounds}</div>
          )}
        </div>

        {state.current && (
          <div style={{ background: 'linear-gradient(135deg,#1f2937,#111827)', borderRadius: 18, padding: '22px 18px', marginBottom: 18, textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              {activeTeam ? 'Now answering' : 'Practice round in progress'}
            </div>
            {activeTeam && (
              <div style={{ fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 12 }}>
                {activeTeam.emoji} {activeTeam.name}
              </div>
            )}
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 'clamp(20px,5.5vw,26px)', fontWeight: 800, color: '#fde68a', fontStyle: 'italic', lineHeight: 1.3, wordBreak: 'break-word' }}>
                &ldquo;{state.current.prompt}&rdquo;
              </div>
            </div>
            <Countdown startedAt={state.current.startedAt} durationSeconds={state.current.durationSeconds} />
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
                return (
                  <div key={entry.id} style={{ padding: '12px 16px', borderBottom: '1px solid #fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{entry.teamName}</span>
                      <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, flexShrink: 0 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>&ldquo;{entry.methaliText}&rdquo;</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{entry.meaning}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state.log.length === 0 && state.phase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🦁🦏🐆</div>
            <p>Three teams, twenty proverbs, one champion. Good luck!</p>
          </div>
        )}
      </main>
    </div>
  );
}

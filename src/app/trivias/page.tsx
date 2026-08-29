'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TriviaPhase } from '@/lib/trivia';

interface TriviaSummary {
  id: string; title: string; ownerName: string; posterImageUrl?: string; visibility: 'public' | 'private';
  scheduledAt?: string; isScheduledInFuture: boolean; phase: TriviaPhase; teamCount: number; isLegacyMethali?: boolean;
}

const PHASE_LABEL: Record<TriviaPhase, { label: string; bg: string; color: string }> = {
  idle: { label: 'Not started', bg: '#f3f4f6', color: '#6b7280' },
  test: { label: '🧪 Practice', bg: '#fef9c3', color: '#854d0e' },
  main: { label: '🔴 Live now', bg: '#dcfce7', color: '#166534' },
  tiebreak: { label: '⚡ Tiebreak', bg: '#dcfce7', color: '#166534' },
  finished: { label: '🏁 Finished', bg: '#f3f4f6', color: '#6b7280' },
};

function fmtScheduled(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function titleInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function TriviasGalleryPage() {
  const [trivias, setTrivias] = useState<TriviaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trivia').then(r => r.json()).then(d => setTrivias(d.trivias || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', color: 'white' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧩</div>
              <span style={{ fontWeight: 900, fontSize: 18 }}>PaceTracker</span>
            </div>
            <Link href="/leaderboard" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textDecoration: 'underline' }}>← Leaderboard</Link>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Eden Care · #Move2026</p>
          <h1 style={{ fontSize: 'clamp(26px,7vw,32px)', fontWeight: 900, margin: '0 0 4px' }}>🧩 Trivia Games</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: 14 }}>Member-created live trivia — pick one and watch, or create your own from Challenges.</p>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '20px 14px 40px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : trivias.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🧩</div>
            <p>No trivias yet — members can create one from the Challenges page.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {trivias.map(t => {
              const status = t.isScheduledInFuture ? { label: '📅 Scheduled', bg: '#e0e7ff', color: '#3730a3' } : PHASE_LABEL[t.phase];
              // The historical Methali entry links to its real, still-live game page, not this
              // frozen snapshot's own detail view.
              const href = t.isLegacyMethali ? '/methali-trivia' : `/trivias/${t.id}`;
              return (
                <Link key={t.id} href={href} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: 120, background: t.posterImageUrl ? `url(${t.posterImageUrl}) center/cover` : 'linear-gradient(135deg,#1a7a4a,#f26522)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!t.posterImageUrl && <span style={{ fontSize: 34, fontWeight: 900, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em' }}>{titleInitials(t.title)}</span>}
                    </div>
                    {t.visibility === 'private' && (
                      <div title="Sign in to watch this trivia" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🔒</div>
                    )}
                    <div style={{ padding: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#1f2937', marginBottom: 3 }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>by {t.ownerName} · 👥 {t.teamCount} teams</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ background: status.bg, color: status.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{status.label}</span>
                        {t.isScheduledInFuture && t.scheduledAt && <span style={{ fontSize: 10, color: '#9ca3af' }}>{fmtScheduled(t.scheduledAt)}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

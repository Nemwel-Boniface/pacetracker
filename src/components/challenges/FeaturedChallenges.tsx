'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChallengeCategory, ChallengePeriod, CHALLENGE_CATEGORY_LABELS, CHALLENGE_PERIOD_LABELS } from '@/types';
import { actorInit } from '@/lib/actorClient';

export interface FeaturedChallenge {
  id: string; title: string; description: string; category: ChallengeCategory; period: ChallengePeriod;
  goalKm: number; startDate: string; endDate: string; ownerName: string;
  participantCount: number; upcoming: boolean; daysUntilStart: number; daysRemaining: number;
  joined: boolean; invited: boolean; canJoin: boolean; canInvite: boolean;
  me: { km: number; percentage: number; remainingKm: number; onPace: boolean; expectedKm: number; rank: number } | null;
}
export interface FeaturedViewer { isAdmin: boolean; }

function fmtDate(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function plural(n: number, word: string): string { return `${n} ${word}${n === 1 ? '' : 's'}`; }

// Where a signed-in viewer manages the challenge; logged-out visitors go through login and land there.
export function challengeHref(id: string, viewer: FeaturedViewer | null): string {
  return viewer?.isAdmin ? `/admin-move2026/challenges/${id}` : `/member/challenges/${id}`;
}

export default function FeaturedChallenges() {
  const [featured, setFeatured] = useState<FeaturedChallenge[]>([]);
  const [viewer, setViewer] = useState<FeaturedViewer | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  function load() {
    return fetch('/api/challenges/featured').then(r => r.json()).then(d => { setFeatured(d.featured || []); setViewer(d.viewer ?? null); }).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function join(id: string) {
    setJoiningId(id);
    try {
      const res = await fetch(`/api/member/challenges/${id}/join`, actorInit(viewer?.isAdmin, { method: 'POST' }));
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to join'); return; }
      toast.success("You're in! 🎯 Tag your activities to this challenge when you log them");
      await load();
    } catch { toast.error('Connection error'); } finally { setJoiningId(null); }
  }

  if (featured.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: '#1f2937', marginBottom: 10 }}>⭐ Featured Challenges</div>
      {featured.map(c => (
        <div key={c.id} style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 16, padding: 18, marginBottom: 12, boxShadow: '0 2px 10px rgba(245,158,11,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: '#1f2937' }}>{c.title}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                {CHALLENGE_CATEGORY_LABELS[c.category]} · {CHALLENGE_PERIOD_LABELS[c.period]} · by {c.ownerName}
              </div>
            </div>
            <span style={{ background: c.upcoming ? '#e0e7ff' : '#fef3c7', color: c.upcoming ? '#3730a3' : '#92400e', borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              {c.upcoming ? `📅 Starts in ${plural(c.daysUntilStart, 'day')}` : `⏳ ${plural(c.daysRemaining, 'day')} left`}
            </span>
          </div>

          {c.description && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '8px 0 12px', whiteSpace: 'pre-line' }}>{c.description}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {([['🎯', `${c.goalKm}km`, 'Goal'], ['👥', c.participantCount, c.participantCount === 1 ? 'Participant' : 'Participants'], ['📆', `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}`, 'Dates']] as const).map(([icon, value, label]) => (
              <div key={label} style={{ background: '#fafaf9', borderRadius: 10, padding: '8px 6px', textAlign: 'center', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{icon} {value}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {c.me && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              {c.upcoming ? (
                <div style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>✅ You&apos;re in! It starts on {fmtDate(c.startDate)}.</div>
              ) : (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#166534' }}>You: #{c.me.rank} of {c.participantCount}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.me.onPace ? '#166534' : '#9a3412' }}>{c.me.onPace ? '✅ On pace' : `⏳ Behind pace (${c.me.expectedKm}km expected)`}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 20, height: 8, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${c.me.percentage}%`, height: '100%', background: '#16a34a', borderRadius: 20 }} />
                </div>
                <div style={{ fontSize: 12, color: '#14532d' }}>
                  <strong>{c.me.km}km</strong> of {c.goalKm}km ({c.me.percentage}%) · {c.me.remainingKm > 0 ? `${c.me.remainingKm}km to go` : '🏁 Goal reached!'}
                </div>
              </>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!viewer ? (
              <Link href={`/authenticate?next=${encodeURIComponent(`/member/challenges/${c.id}`)}`} style={{ padding: '9px 18px', borderRadius: 10, background: '#f26522', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>🔐 Log in to join</Link>
            ) : c.canJoin ? (
              <button onClick={() => join(c.id)} disabled={joiningId === c.id} style={{ padding: '9px 18px', borderRadius: 10, background: '#f26522', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: joiningId === c.id ? 'not-allowed' : 'pointer' }}>
                {joiningId === c.id ? 'Joining…' : c.invited ? '✓ Accept invite & join' : '+ Join challenge'}
              </button>
            ) : null}
            {viewer && <Link href={challengeHref(c.id, viewer)} style={{ padding: '9px 18px', borderRadius: 10, background: 'white', color: '#374151', fontWeight: 600, fontSize: 13, border: '1px solid #e5e7eb', textDecoration: 'none' }}>{c.joined ? 'View leaderboard →' : 'Details →'}</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}

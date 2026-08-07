'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Challenge, ChallengeCategory, ChallengePeriod, CHALLENGE_CATEGORY_LABELS, CHALLENGE_PERIOD_LABELS } from '@/types';

const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };

interface ChallengeEntry {
  challenge: Challenge;
  progressKm: number;
  percentage: number;
  onPace: boolean;
  daysRemaining: number;
  participantCount: number;
  displayStatus: 'active' | 'ended' | 'cancelled';
}
interface InviteEntry { challenge: Challenge; invitedByName: string; invitedAt: string; }

function StatusPill({ entry }: { entry: ChallengeEntry }) {
  if (entry.displayStatus === 'cancelled') return <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>Cancelled</span>;
  if (entry.displayStatus === 'ended') return <span style={{ background: entry.percentage >= 100 ? '#dcfce7' : '#f3f4f6', color: entry.percentage >= 100 ? '#166534' : '#6b7280', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{entry.percentage >= 100 ? '🏁 Goal hit!' : '🏁 Ended'}</span>;
  return entry.onPace
    ? <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>✅ On pace</span>
    : <span style={{ background: '#ffedd5', color: '#9a3412', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>⏳ Behind pace</span>;
}

function ChallengeCard({ entry }: { entry: ChallengeEntry }) {
  const { challenge } = entry;
  return (
    <Link href={`/member/challenges/${challenge.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 16, marginBottom: 10, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{challenge.title}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {CHALLENGE_CATEGORY_LABELS[challenge.category]} · {CHALLENGE_PERIOD_LABELS[challenge.period]} · 👥 {entry.participantCount}
            </div>
          </div>
          <StatusPill entry={entry} />
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: 20, height: 8, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${entry.percentage}%`, height: '100%', background: entry.percentage >= 100 ? '#16a34a' : '#1a7a4a', borderRadius: 20, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
          <span><strong style={{ color: '#1f2937' }}>{entry.progressKm}km</strong> / {challenge.goalKm}km — {entry.percentage}%</span>
          {entry.displayStatus === 'active' && <span>{entry.daysRemaining}d left</span>}
        </div>
      </div>
    </Link>
  );
}

export default function ChallengesPage() {
  const [owned, setOwned] = useState<ChallengeEntry[]>([]);
  const [joined, setJoined] = useState<ChallengeEntry[]>([]);
  const [invites, setInvites] = useState<InviteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', category: 'run_walk' as ChallengeCategory, period: 'monthly' as ChallengePeriod, goalKm: '' });

  function fetchData() {
    setLoading(true);
    fetch('/api/member/challenges')
      .then(r => r.json())
      .then(d => { setOwned(d.owned || []); setJoined(d.joined || []); setInvites(d.invites || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!form.title.trim()) { setError('Give your challenge a name'); return; }
    const goal = parseFloat(form.goalKm);
    if (!goal || goal <= 0) { setError('Enter a goal distance'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/member/challenges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, goalKm: goal }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create challenge'); return; }
      toast.success('Challenge created! Invite people from the challenge page 🎯');
      setForm({ title: '', category: 'run_walk', period: 'monthly', goalKm: '' });
      setShowForm(false);
      fetchData();
    } catch { setError('Connection error'); } finally { setCreating(false); }
  }

  async function respond(challengeId: string, action: 'accept' | 'decline') {
    setRespondingId(challengeId);
    try {
      const res = await fetch(`/api/member/challenges/${challengeId}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to respond'); return; }
      toast.success(action === 'accept' ? 'Joined the challenge! 🎯' : 'Invite declined');
      fetchData();
    } catch { toast.error('Connection error'); } finally { setRespondingId(null); }
  }

  const weeklyPace = form.period === 'monthly' && form.goalKm ? Math.round((parseFloat(form.goalKm) / 30) * 7 * 10) / 10 : null;

  const segBtn = (active: boolean) => ({ flex: 1, padding: '10px 8px', borderRadius: 10, border: `1.5px solid ${active ? '#1a7a4a' : '#e5e7eb'}`, background: active ? '#1a7a4a' : 'white', color: active ? 'white' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' as const, transition: 'all 0.15s' });

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', margin: '0 0 4px' }}>🏁 Challenges</h2>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Create a distance goal, invite friends, and track who&apos;s crushing it</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 8, background: '#f26522', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ New Challenge'}
        </button>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>
        ⚠️ Only activities logged <strong>with a distance (km)</strong> count toward challenge progress — add distance when you log a run, walk, hike, or ride.
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 20, marginBottom: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Challenge Name *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Team 120km Monthly Push" style={inp} maxLength={60} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Category *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setForm({ ...form, category: 'run_walk' })} style={segBtn(form.category === 'run_walk')}>🏃 Run / Walk / Hike</button>
              <button type="button" onClick={() => setForm({ ...form, category: 'cycling' })} style={segBtn(form.category === 'cycling')}>🚴 Cycling</button>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Period *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setForm({ ...form, period: 'weekly' })} style={segBtn(form.period === 'weekly')}>Weekly (7 days)</button>
              <button type="button" onClick={() => setForm({ ...form, period: 'monthly' })} style={segBtn(form.period === 'monthly')}>Monthly (30 days)</button>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Goal Distance — km *</label>
            <input type="number" min="0" step="0.1" value={form.goalKm} onChange={e => setForm({ ...form, goalKm: e.target.value })} placeholder="e.g. 120" style={inp} />
            {weeklyPace && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>≈ {weeklyPace}km/week to stay on pace</div>}
          </div>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={creating} style={{ padding: '11px 22px', borderRadius: 10, background: creating ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: creating ? 'not-allowed' : 'pointer' }}>
            {creating ? 'Creating…' : 'Create Challenge'}
          </button>
        </form>
      )}

      {invites.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#374151', margin: '0 0 10px' }}>📩 Invitations ({invites.length})</h3>
          {invites.map(inv => (
            <div key={inv.challenge.id} style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#4c1d95' }}>{inv.challenge.title}</div>
              <div style={{ fontSize: 11, color: '#7c3aed', margin: '3px 0 10px' }}>
                {CHALLENGE_CATEGORY_LABELS[inv.challenge.category]} · {CHALLENGE_PERIOD_LABELS[inv.challenge.period]} · Goal {inv.challenge.goalKm}km · Invited by <strong>{inv.invitedByName}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => respond(inv.challenge.id, 'accept')} disabled={respondingId === inv.challenge.id} style={{ padding: '7px 16px', borderRadius: 8, background: '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>✓ Accept</button>
                <button onClick={() => respond(inv.challenge.id, 'decline')} disabled={respondingId === inv.challenge.id} style={{ padding: '7px 16px', borderRadius: 8, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 12, border: '1px solid #e5e7eb', cursor: 'pointer' }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#374151', margin: '0 0 10px' }}>🏆 Challenges I Own</h3>
        {owned.length === 0
          ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13, background: 'white', borderRadius: 14, border: '1px solid #f3f4f6' }}>You haven&apos;t created a challenge yet.</div>
          : owned.map(e => <ChallengeCard key={e.challenge.id} entry={e} />)}
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#374151', margin: '0 0 10px' }}>🤝 Challenges I&apos;ve Joined</h3>
        {joined.length === 0
          ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13, background: 'white', borderRadius: 14, border: '1px solid #f3f4f6' }}>No joined challenges yet — wait for an invite, or create your own above.</div>
          : joined.map(e => <ChallengeCard key={e.challenge.id} entry={e} />)}
      </div>
    </div>
  );
}

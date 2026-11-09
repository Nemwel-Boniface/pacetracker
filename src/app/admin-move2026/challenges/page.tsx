'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Challenge, CHALLENGE_CATEGORY_LABELS, CHALLENGE_PERIOD_LABELS, facilitatorNames } from '@/types';
import { TriviaPhase } from '@/lib/trivia';
import ChallengesHub from '@/components/challenges/ChallengesHub';

interface DistanceRow { challenge: Challenge; kind: 'distance'; displayStatus: 'active' | 'ended' | 'cancelled'; acceptedCount: number; pendingCount: number; }
interface TriviaRow { challenge: Challenge; kind: 'trivia'; phase: TriviaPhase; isScheduledInFuture: boolean; teamCount: number; visibility: 'public' | 'private'; }
type ChallengeRow = DistanceRow | TriviaRow;

function fmtDate(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#dcfce7', color: '#166534', label: 'Active' },
  ended: { bg: '#f3f4f6', color: '#6b7280', label: '🏁 Ended' },
  cancelled: { bg: '#fef2f2', color: '#991b1b', label: 'Cancelled' },
};
const TRIVIA_PHASE_STYLE: Record<TriviaPhase, { bg: string; color: string; label: string }> = {
  idle: { bg: '#f3f4f6', color: '#6b7280', label: 'Not started' },
  test: { bg: '#fef9c3', color: '#854d0e', label: '🧪 Practice' },
  main: { bg: '#dcfce7', color: '#166534', label: '🔴 Live' },
  tiebreak: { bg: '#dcfce7', color: '#166534', label: '⚡ Tiebreak' },
  finished: { bg: '#f3f4f6', color: '#6b7280', label: '🏁 Finished' },
};

function DistanceRowView({ challenge: c, displayStatus, acceptedCount, pendingCount }: DistanceRow) {
  const s = STATUS_STYLE[displayStatus];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, rowGap: 8, flexWrap: 'wrap', padding: '14px 16px', borderBottom: '1px solid #fafafa' }}>
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>
          {c.title}
          {c.featureStatus === 'featured' && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 800, marginLeft: 6 }}>⭐ Featured</span>}
          {c.featureStatus === 'requested' && <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, marginLeft: 6 }}>Feature requested</span>}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          {c.coFacilitators?.length ? `Facilitators: ${facilitatorNames(c)}` : `Owner: ${c.ownerName}`} · {CHALLENGE_CATEGORY_LABELS[c.category!]} · {CHALLENGE_PERIOD_LABELS[c.period!]} · Goal {c.goalKm}km · {c.visibility === 'open' ? '🌍 Open' : '🔒 Invite-only'}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtDate(c.startDate!)} – {fmtDate(c.endDate!)}</div>
      </div>
      <div style={{ fontSize: 12, color: '#374151', textAlign: 'right', flexShrink: 0 }}>
        <div>👥 {acceptedCount} joined</div>
        {pendingCount > 0 && <div style={{ color: '#f26522' }}>{pendingCount} pending</div>}
      </div>
      <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.label}</span>
      <Link href={`/admin-move2026/challenges/${c.id}`} style={{ flexShrink: 0, background: '#1a7a4a', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
        View →
      </Link>
    </div>
  );
}

function TriviaRowView({ challenge: c, phase, isScheduledInFuture, teamCount, visibility }: TriviaRow) {
  const s = isScheduledInFuture ? { bg: '#e0e7ff', color: '#3730a3', label: '📅 Scheduled' } : TRIVIA_PHASE_STYLE[phase];
  // The historical Methali record points back at the real, still-live Methali admin page —
  // editing it here would silently do nothing to the game people actually watch.
  const manageHref = c.isLegacyMethali ? '/admin-move2026/methali-trivia' : `/admin-move2026/challenges/${c.id}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, rowGap: 8, flexWrap: 'wrap', padding: '14px 16px', borderBottom: '1px solid #fafafa' }}>
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>🏛️ {c.title}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          Owner: {c.ownerName} · 👥 {teamCount} teams · {visibility === 'private' ? '🔒 Private' : '🌍 Public'}
          {c.isLegacyMethali && ' · 🔗 Live standalone game'}
        </div>
      </div>
      <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.label}</span>
      <Link href={manageHref} style={{ flexShrink: 0, background: '#1a7a4a', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
        Manage →
      </Link>
    </div>
  );
}

export default function AdminChallengesPage() {
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [actingId, setActingId] = useState<string | null>(null);

  function loadRows() {
    return fetch('/api/challenges').then(r => r.json()).then(d => setRows(d.challenges || [])).catch(() => {});
  }
  useEffect(() => { loadRows().finally(() => setLoading(false)); }, []);

  const activeCount = rows.filter(r => r.kind === 'distance' && r.displayStatus === 'active').length;
  const requests = rows.filter((r): r is DistanceRow => r.kind === 'distance' && r.displayStatus === 'active' && r.challenge.featureStatus === 'requested');
  const featuredCount = rows.filter(r => r.kind === 'distance' && r.displayStatus === 'active' && r.challenge.featureStatus === 'featured').length;

  // Featuring past the limit asks once, then retries with an override.
  async function review(id: string, action: 'feature' | 'decline') {
    setActingId(id);
    try {
      const send = (override: boolean) => fetch(`/api/challenges/${id}/feature`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, override }) });
      let res = await send(false);
      let d = await res.json();
      if (res.status === 409 && d.code === 'cap_reached') {
        if (!confirm(`${d.current} challenges are already featured (limit ${d.max}). Feature this one anyway?`)) return;
        res = await send(true); d = await res.json();
      }
      if (!res.ok) { toast.error(d.error || 'Failed to update'); return; }
      toast.success(action === 'feature' ? 'Featured on the main page ⭐' : 'Request declined');
      await loadRows();
    } catch { toast.error('Connection error'); } finally { setActingId(null); }
  }

  return (
    <div style={{ padding: '20px 14px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1f2937', margin: 0 }}>🏁 Challenges</h1>
          {activeCount > 0 && <span style={{ background: '#1a7a4a', color: 'white', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>{activeCount} active</span>}
        </div>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Create your own challenges, or oversee every member&apos;s distance goals and trivia games</p>
      </div>

      {requests.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#92400e' }}>⭐ Feature requests ({requests.length})</span>
            <span style={{ fontSize: 11, color: '#92400e' }}>{featuredCount} featured right now</span>
          </div>
          {requests.map(({ challenge: c, acceptedCount }) => (
            <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{c.title}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 6px' }}>
                by {facilitatorNames(c)} · Goal {c.goalKm}km · {fmtDate(c.startDate!)} – {fmtDate(c.endDate!)} · 👥 {acceptedCount}
              </div>
              {c.description && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 10, whiteSpace: 'pre-line' }}>{c.description}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => review(c.id, 'feature')} disabled={actingId === c.id} style={{ padding: '7px 14px', borderRadius: 8, background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>⭐ Feature</button>
                <button onClick={() => review(c.id, 'decline')} disabled={actingId === c.id} style={{ padding: '7px 14px', borderRadius: 8, background: 'white', color: '#dc2626', fontWeight: 600, fontSize: 12, border: '1px solid #fecaca', cursor: 'pointer' }}>Decline</button>
                <Link href={`/admin-move2026/challenges/${c.id}`} style={{ padding: '7px 14px', borderRadius: 8, background: 'white', color: '#374151', fontWeight: 600, fontSize: 12, border: '1px solid #e5e7eb', textDecoration: 'none' }}>View →</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['mine', '🎯 My Challenges'], ['all', '👀 All Challenges']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ flex: 1, maxWidth: 220, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${tab === key ? '#1a7a4a' : '#e5e7eb'}`, background: tab === key ? '#1a7a4a' : 'white', color: tab === key ? 'white' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      {tab === 'mine' ? (
        <ChallengesHub basePath="/admin-move2026/challenges" asAdmin legacyMethaliHref="/admin-move2026/methali-trivia" />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading challenges…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', background: 'white', borderRadius: 14, border: '1px solid #f3f4f6' }}>No challenges created yet.</div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
          {rows.map(row => row.kind === 'trivia' ? <TriviaRowView key={row.challenge.id} {...row} /> : <DistanceRowView key={row.challenge.id} {...row} />)}
        </div>
      )}
    </div>
  );
}

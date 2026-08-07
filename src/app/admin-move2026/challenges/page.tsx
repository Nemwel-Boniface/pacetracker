'use client';
import { useEffect, useState } from 'react';
import { Challenge, CHALLENGE_CATEGORY_LABELS, CHALLENGE_PERIOD_LABELS } from '@/types';

interface ChallengeRow { challenge: Challenge; displayStatus: 'active' | 'ended' | 'cancelled'; acceptedCount: number; pendingCount: number; }

function fmtDate(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#dcfce7', color: '#166534', label: 'Active' },
  ended: { bg: '#f3f4f6', color: '#6b7280', label: '🏁 Ended' },
  cancelled: { bg: '#fef2f2', color: '#991b1b', label: 'Cancelled' },
};

export default function AdminChallengesPage() {
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/challenges').then(r => r.json()).then(d => setRows(d.challenges || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeCount = rows.filter(r => r.displayStatus === 'active').length;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1f2937', margin: 0 }}>🏁 Challenges</h1>
          {activeCount > 0 && <span style={{ background: '#1a7a4a', color: 'white', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>{activeCount} active</span>}
        </div>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Member-created distance challenges — read-only oversight</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading challenges…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', background: 'white', borderRadius: 14, border: '1px solid #f3f4f6' }}>No challenges created yet.</div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
          {rows.map(({ challenge: c, displayStatus, acceptedCount, pendingCount }) => {
            const s = STATUS_STYLE[displayStatus];
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #fafafa' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    Owner: {c.ownerName} · {CHALLENGE_CATEGORY_LABELS[c.category]} · {CHALLENGE_PERIOD_LABELS[c.period]} · Goal {c.goalKm}km
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</div>
                </div>
                <div style={{ fontSize: 12, color: '#374151', textAlign: 'right', flexShrink: 0 }}>
                  <div>👥 {acceptedCount} joined</div>
                  {pendingCount > 0 && <div style={{ color: '#f26522' }}>{pendingCount} pending</div>}
                </div>
                <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

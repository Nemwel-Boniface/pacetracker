'use client';
import { useEffect, useState } from 'react';
import { ActivityLog, ActivityType, ACTIVITY_LABELS, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS } from '@/types';

const MAX_PER_DAY = 2;
const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };
const numInp = { ...{ width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' } };

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function activityMeta(a: ActivityLog): string {
  return [
    a.distance != null ? `${a.distance}km` : null,
    a.duration != null ? `${a.duration}min` : null,
    a.notes || null,
  ].filter(Boolean).join(' · ');
}

export default function MemberLogPage() {
  const [todayActivities, setTodayActivities] = useState<ActivityLog[]>([]);
  const [remaining, setRemaining] = useState(MAX_PER_DAY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ activityType: 'run' as ActivityType, notes: '', distance: '', duration: '' });

  async function fetchActivities() {
    try {
      const res = await fetch('/api/member/activities');
      const data = await res.json();
      setTodayActivities(data.todayActivities || []);
      setRemaining(data.remaining ?? MAX_PER_DAY);
    } catch { /* silent */ } finally { setLoading(false); }
  }

  useEffect(() => { fetchActivities(); }, []);

  async function handleLog(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSuccess(''); setSaving(true);
    try {
      const body = {
        activityType: form.activityType,
        notes: form.notes,
        ...(form.distance ? { distance: parseFloat(form.distance) } : {}),
        ...(form.duration ? { duration: parseInt(form.duration) } : {}),
      };
      const res = await fetch('/api/member/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to log activity'); return; }
      setSuccess(`Logged! +${data.activity.points} point${data.activity.points !== 1 ? 's' : ''} 🎉`);
      setForm({ activityType: 'run', notes: '', distance: '', duration: '' });
      setTodayActivities(p => [data.activity, ...p]);
      setRemaining(data.remaining ?? 0);
    } catch { setError('Connection error'); } finally { setSaving(false); }
  }

  const pts = ACTIVITY_POINTS[ACTIVITY_CATEGORY_MAP[form.activityType]];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', margin: '0 0 4px' }}>Log Today&apos;s Activity</h2>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{todayLabel()}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {Array.from({ length: MAX_PER_DAY }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: i < todayActivities.length ? '#1a7a4a' : '#f3f4f6', borderRadius: 10, padding: '12px 16px', textAlign: 'center', transition: 'all 0.3s' }}>
            <div style={{ fontSize: 22 }}>{i < todayActivities.length ? '✅' : '⬜'}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: i < todayActivities.length ? 'white' : '#9ca3af', marginTop: 4 }}>Activity {i + 1}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      ) : remaining > 0 ? (
        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: '#374151', margin: '0 0 16px' }}>
            {remaining === MAX_PER_DAY ? 'Log your first activity' : 'Log one more activity'} ({remaining} remaining today)
          </h3>
          <form onSubmit={handleLog}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Activity Type *</label>
              <select value={form.activityType} onChange={e => setForm({ ...form, activityType: e.target.value as ActivityType })} style={inp}>
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Distance — km <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input type="number" min="0" step="0.1" value={form.distance} onChange={e => setForm({ ...form, distance: e.target.value })} placeholder="e.g. 5.2" style={numInp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Duration — min <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input type="number" min="1" step="1" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 32" style={numInp} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. ran with the team, morning session…" style={inp} />
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
              This awards <strong>{pts} point{pts !== 1 ? 's' : ''}</strong> toward your total 🏅
            </div>
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{success}</div>}
            <button type="submit" disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: saving ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Logging…' : 'Log Activity'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 16, padding: 28, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <h3 style={{ fontWeight: 900, color: '#145c38', fontSize: 18, margin: '0 0 4px' }}>All done for today!</h3>
          <p style={{ color: '#166534', fontSize: 14, margin: 0 }}>You&apos;ve logged your {MAX_PER_DAY} activities for today. Come back tomorrow!</p>
        </div>
      )}

      {todayActivities.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: 14, color: '#374151' }}>
            Today&apos;s Logged Activities
          </div>
          {todayActivities.map(a => {
            const meta = activityMeta(a);
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid #fafafa' }}>
                <span style={{ fontSize: 22 }}>{ACTIVITY_LABELS[a.activityType]?.split(' ')[0] || '✨'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{ACTIVITY_LABELS[a.activityType]}</div>
                  {meta && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{meta}</div>}
                </div>
                <span style={{ fontWeight: 900, color: '#1a7a4a', fontSize: 14 }}>+{a.points} pt{a.points !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

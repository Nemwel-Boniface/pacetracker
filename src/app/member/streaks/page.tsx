'use client';
import { useEffect, useState } from 'react';

interface StreakDay { date: string; hasActivity: boolean; isToday: boolean; }
interface Milestone { days: number; label: string; emoji: string; achieved: boolean; }
interface StreakData {
  currentStreak: number;
  longestStreak: number;
  isActiveToday: boolean;
  totalActiveDays: number;
  recentDays: StreakDay[];
  milestones: Milestone[];
}

function fmtShort(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function StreaksPage() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch('/api/member/streak')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function downloadImage() {
    setDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const el = document.getElementById('streak-capture');
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const link = document.createElement('a');
      link.download = `my-streak-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error(e); }
    finally { setDownloading(false); }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '4px solid #f26522', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Failed to load streak data.</div>;

  const { currentStreak, longestStreak, isActiveToday, totalActiveDays, recentDays, milestones } = data;
  const nextMilestone = milestones.find(m => !m.achieved);
  const daysToNext = nextMilestone ? nextMilestone.days - currentStreak : 0;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1f2937', margin: 0 }}>My Streak</h1>
          <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0' }}>Consecutive days of logged activity</p>
        </div>
        <button onClick={downloadImage} disabled={downloading} style={{ padding: '9px 16px', borderRadius: 8, background: '#f26522', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', opacity: downloading ? 0.6 : 1 }}>
          {downloading ? '⏳...' : '📸 Share'}
        </button>
      </div>

      <div id="streak-capture" style={{ background: 'white', borderRadius: 20, overflow: 'hidden', border: '1px solid #f3f4f6', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#f26522 100%)', padding: '36px 24px', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 4 }}>🔥</div>
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1 }}>{currentStreak}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
            {currentStreak === 1 ? '1-day streak' : `${currentStreak}-day streak`}
          </div>
          <div style={{ marginTop: 14, display: 'inline-block', background: 'rgba(0,0,0,0.18)', padding: '6px 16px', borderRadius: 20, fontSize: 12, color: isActiveToday ? '#86efac' : '#fde68a', fontWeight: 600 }}>
            {isActiveToday ? '✅ Logged today — keep it going!' : '⚠️ Log an activity today to keep your streak!'}
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Current Streak', value: `${currentStreak}d`, emoji: '🔥' },
              { label: 'Longest Streak', value: `${longestStreak}d`, emoji: '🏆' },
              { label: 'Total Active Days', value: `${totalActiveDays}d`, emoji: '📅' },
            ].map(s => (
              <div key={s.label} style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1f2937' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* 30-day calendar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Last 30 Days</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
              {recentDays.map(day => (
                <div key={day.date} title={fmtShort(day.date)} style={{
                  aspectRatio: '1',
                  borderRadius: 8,
                  background: day.hasActivity ? '#16a34a' : '#f3f4f6',
                  border: day.isToday ? '2px solid #f26522' : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}>
                  {day.hasActivity ? '✓' : ''}
                  {!day.hasActivity && day.isToday ? '·' : ''}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', marginTop: 8, fontSize: 10, color: '#9ca3af' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: '#16a34a' }} /> Logged</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: '#f3f4f6', border: '1px solid #e5e7eb' }} /> No activity</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid #f26522' }} /> Today</div>
            </div>
          </div>

          {/* Milestones */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Streak Milestones</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {milestones.map(m => (
                <div key={m.days} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                  background: m.achieved ? '#f0fdf4' : '#f9fafb',
                  border: `1px solid ${m.achieved ? '#bbf7d0' : '#f3f4f6'}`,
                  opacity: m.achieved ? 1 : 0.55,
                  transition: 'opacity 0.2s',
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0, filter: m.achieved ? 'none' : 'grayscale(1)' }}>{m.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: m.achieved ? '#1f2937' : '#9ca3af' }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.days}-day streak</div>
                  </div>
                  {m.achieved
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 20 }}>✓ Unlocked</span>
                    : <span style={{ fontSize: 11, color: '#d1d5db' }}>🔒</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {nextMilestone && daysToNext > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#92400e' }}>
              🎯 Just <strong>{daysToNext} more day{daysToNext !== 1 ? 's' : ''}</strong> to unlock <strong>{nextMilestone.label}</strong> {nextMilestone.emoji} — log an activity every day to get there!
            </div>
          )}

          {!nextMilestone && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#78350f', textAlign: 'center' }}>
              👑 You've unlocked every milestone — absolute legend!
            </div>
          )}

          <div style={{ textAlign: 'center', fontSize: 10, color: '#d1d5db', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
            Eden Care #Move2026 · pacetracker-move2026.vercel.app
          </div>
        </div>
      </div>
    </div>
  );
}

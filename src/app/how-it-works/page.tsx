import Link from 'next/link';
import { TIER_CONFIG, ACTIVITY_POINTS, ACTIVITY_LABELS, PointTier } from '@/types';

export default function HowItWorksPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', color: 'white', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Link href="/leaderboard" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, textDecoration: 'none' }}>← Back to Leaderboard</Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>How Points Work</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Everything you need to know about #Move2026 scoring</p>
        </div>
      </header>
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 900, marginBottom: 12 }}>The Philosophy</h2>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16 }}>
            <p style={{ fontWeight: 700, color: '#145c38', fontSize: 18, margin: '0 0 8px' }}>Consistency over intensity.</p>
            <p style={{ color: '#166534', margin: 0, fontSize: 14 }}>This is NOT a ranking of the best runners. It&apos;s a recognition board for people building a healthy habit — regardless of pace, distance, or fitness level.</p>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 900, marginBottom: 16 }}>⭐ Points Breakdown</h2>
          {[
            { label: 'Complete a run/workout session', pts: ACTIVITY_POINTS.run_session, desc: 'Any movement — run, walk, hike, gym, yoga, swimming, cycling, and more', icon: '🏃' },
            { label: 'Complete a lunch-time activity', pts: ACTIVITY_POINTS.lunch_time_activity, desc: 'Lunch walks, stretches, or mobility sessions (20 min max)', icon: '🍃' },
            { label: 'Sign up for a race', pts: ACTIVITY_POINTS.race_signup, desc: 'Register for the USIU run or any race event', icon: '📋' },
            { label: 'Complete a race', pts: ACTIVITY_POINTS.race_complete, desc: 'Cross that finish line!', icon: '🏅' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, background: '#f9fafb', borderRadius: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div><div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.desc}</div></div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#1a7a4a' }}>{item.pts}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 900, marginBottom: 16 }}>Accepted Activities</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {Object.values(ACTIVITY_LABELS).map(label => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151' }}>{label}</div>
            ))}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 900, marginBottom: 8 }}>🏆 Progress Tiers</h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>You&apos;re chasing your own progress, not competing against others.</p>
          {(Object.entries(TIER_CONFIG) as [PointTier, typeof TIER_CONFIG[PointTier]][]).reverse().map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, border: '1px solid #f3f4f6', background: '#f9fafb', marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{cfg.emoji}</span>
              <div><div style={{ fontWeight: 700 }}>{cfg.label}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{cfg.min}{cfg.max ? ` – ${cfg.max}` : '+'} points</div></div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', paddingBottom: 32 }}>
          <Link href="/leaderboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 999, background: '#1a7a4a', color: 'white', fontWeight: 700, textDecoration: 'none' }}>
            👥 View the Leaderboard
          </Link>
        </div>
      </main>
    </div>
  );
}
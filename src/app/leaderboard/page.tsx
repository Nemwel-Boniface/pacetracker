'use client';
import { useEffect, useState, useCallback } from 'react';
import { MemberStats, Winner, PrizeCategory, CountryConfig, TIER_CONFIG, PointTier, getCountryFlag } from '@/types';
import { getSticker, getStickerTier, STICKER_BG, STICKER_LABELS } from '@/lib/stickers';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [prizes, setPrizes] = useState<PrizeCategory[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [lbRes, ctRes] = await Promise.all([fetch('/api/leaderboard'), fetch('/api/countries')]);
      const [lbData, ctData] = await Promise.all([lbRes.json(), ctRes.json()]);
      setStats(lbData.stats || []); setWinners(lbData.winners || []); setPrizes(lbData.prizes || []);
      setCountries((ctData.countries || []).filter((c: CountryConfig) => c.isActive));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch { setStats([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 60000); return () => clearInterval(t); }, [fetchData]);

  const allActive = stats.filter(s => s.isActive);
  const rankMap = new Map(allActive.map((m, i) => [m.memberId, i + 1]));
  const active = (filter === 'All' ? stats : stats.filter(s => s.country === filter)).filter(s => s.isActive);
  const tierGroups = (Object.entries(TIER_CONFIG) as [PointTier, typeof TIER_CONFIG[PointTier]][]).reverse()
    .map(([key, cfg]) => ({ tier: key, cfg, members: active.filter(s => s.tier === key) }));

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', color: 'white', padding: '0' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '2rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏃</div>
              <span style={{ fontWeight: 900, fontSize: 18 }}>PaceTracker</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Link href="/authenticate" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textDecoration: 'none', background: 'rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: 8, fontWeight: 600 }}>Sign In</Link>
              <Link href="/how-it-works" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'underline' }}>How points work</Link>
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Eden Care · #Move2026</p>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 4px' }}>Move Together</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 24px' }}>8-Week Couch to 10K · Leaderboard</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[['Participants', active.length, '👥'], ['Active Days', active.reduce((s,m)=>s+m.activeDays,0), '📅'], ['Points Earned', active.reduce((s,m)=>s+m.totalPoints,0), '⚡']].map(([label, val, icon]) => (
              <div key={label as string} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 20 }}>{icon}</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{val}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 768, margin: '0 auto', padding: '24px 16px' }}>
        {winners.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#fef9c3,#fde68a)', border: '1px solid #fcd34d', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 12 }}>🎉 Challenge Winners</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
              {winners.map(w => (
                <div key={w.id} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 24 }}>🏅</span>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{w.memberName}</div><div style={{ fontSize: 11, color: '#b45309' }}>{w.prizeCategoryName}</div><div style={{ fontSize: 11, color: '#666' }}>{getCountryFlag(w.country, countries)} {w.country}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {prizes.length > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#145c38', marginBottom: 12 }}>🏆 Prizes Up for Grabs</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
              {prizes.map(p => (
                <div key={p.id} style={{ background: 'white', borderRadius: 10, padding: '10px 12px', border: '1px solid #d1fae5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>{p.amount > 0 && <span style={{ fontWeight: 900, color: '#f26522', fontSize: 13 }}>${p.amount}</span>}</div>
                  {p.criteria && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{p.criteria}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          <button onClick={() => setFilter('All')} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: filter === 'All' ? 'none' : '1px solid #e5e7eb', background: filter === 'All' ? '#1a7a4a' : 'white', color: filter === 'All' ? 'white' : '#374151' }}>All</button>
          {countries.map(c => (
            <button key={c.name} onClick={() => setFilter(c.name)} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: filter === c.name ? 'none' : '1px solid #e5e7eb', background: filter === c.name ? '#1a7a4a' : 'white', color: filter === c.name ? 'white' : '#374151' }}>
              {c.flag} {c.name}
            </button>
          ))}
          {lastUpdated && <span style={{ flexShrink: 0, fontSize: 11, color: '#9ca3af', alignSelf: 'center', marginLeft: 'auto' }}>Updated {lastUpdated}</span>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ width: 40, height: 40, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: '#9ca3af' }}>Loading leaderboard...</p>
          </div>
        ) : active.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 0' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>🏁</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginBottom: 8 }}>No participants yet</h3>
            <p style={{ color: '#9ca3af' }}>The challenge is warming up — check back soon!</p>
          </div>
        ) : (
          <div>
            {tierGroups.map(({ tier, cfg, members }) => members.length === 0 ? null : (
              <div key={tier} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>{cfg.emoji}</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: '#1f2937' }}>{cfg.label}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{cfg.min}{cfg.max ? `–${cfg.max}` : '+'} pts</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map((m, i) => (
                    <div key={m.memberId} style={{ background: 'white', borderRadius: 16, padding: '14px 16px', border: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ color: '#d1d5db', fontWeight: 700, fontSize: 13, width: 20, textAlign: 'center' }}>{tier === 'move_together_champions' && i === 0 ? '👑' : i+1}</span>
                      {(() => { const rank = rankMap.get(m.memberId) ?? 0; const sticker = getSticker(rank, allActive.length, m.memberId); const { bg, border } = STICKER_BG[getStickerTier(rank, allActive.length)]; return (
                      <div title={`${m.memberName} · ${STICKER_LABELS[sticker] ?? sticker}`} style={{ width: 44, height: 44, borderRadius: '50%', background: bg, border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, cursor: 'default' }}>
                        {sticker}
                      </div>
                      ); })()}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.memberName} <span style={{ fontSize: 14 }}>{getCountryFlag(m.country, countries)}</span></div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>🎯 {m.runSessions + m.lunchActivities + m.raceSignups + m.racesCompleted} activities · 📅 {m.activeDays} days{m.racesCompleted > 0 ? ` · 🏅 ${m.racesCompleted} race${m.racesCompleted !== 1 ? 's' : ''}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#1a7a4a' }}>{m.totalPoints}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>points</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', background: 'white', borderRadius: 16, padding: 20, border: '1px solid #f3f4f6', marginTop: 32 }}>
          <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>Not a ranking — everyone is <strong>chasing their own progress</strong>.</p>
          <Link href="/how-it-works" style={{ color: '#1a7a4a', fontWeight: 700, fontSize: 13 }}>Learn how points are earned →</Link>
        </div>
        <footer style={{ textAlign: 'center', marginTop: 32, paddingBottom: 24, fontSize: 11, color: '#d1d5db' }}>
          © {new Date().getFullYear()} Eden Care · #Move2026 · Better Health, Stronger Together
        </footer>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

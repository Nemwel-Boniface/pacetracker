'use client';
import { useEffect, useState, useCallback } from 'react';
import { MemberStats, Winner, PrizeCategory, CountryConfig, TIER_CONFIG, PointTier, getCountryFlag } from '@/types';
import { getSticker, getStickerTier, STICKER_BG, STICKER_LABELS } from '@/lib/stickers';
import Link from 'next/link';

const PAGE_SIZE = 10;
const MARATHON_DATE = new Date('2026-07-26T07:00:00+03:00');

function daysUntilMarathon(): number {
  const now = new Date();
  const diff = MARATHON_DATE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function LeaderboardPage() {
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [prizes, setPrizes] = useState<PrizeCategory[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('All');
  const [lastUpdated, setLastUpdated] = useState('');
  const [page, setPage] = useState(0);
  const [marathonBannerEnabled, setMarathonBannerEnabled] = useState(false);
  const [marathonCountries, setMarathonCountries] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [lbRes, ctRes, stRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/countries'),
        fetch('/api/admin/settings'),
      ]);
      const [lbData, ctData, stData] = await Promise.all([lbRes.json(), ctRes.json(), stRes.json()]);
      setStats(lbData.stats || []); setWinners(lbData.winners || []); setPrizes(lbData.prizes || []);
      setCountries((ctData.countries || []).filter((c: CountryConfig) => c.isActive));
      setMarathonBannerEnabled(stData.settings?.marathonBannerEnabled ?? true);
      setMarathonCountries(stData.settings?.marathonCountries ?? []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch { setStats([]); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [filter]);

  const allActive = stats.filter(s => s.isActive);
  const rankMap = new Map(allActive.map((m, i) => [m.memberId, i + 1]));
  const active = (filter === 'All' ? stats : stats.filter(s => s.country === filter)).filter(s => s.isActive);

  // Build flat ordered list preserving tier ordering (champions first)
  const tierOrder: PointTier[] = ['move_together_champions', 'consistency_crew', 'building_momentum', 'getting_started'];
  type FlatMember = MemberStats & { tier: PointTier; tierIndex: number };
  const flatMembers: FlatMember[] = tierOrder.flatMap(tier =>
    active.filter(m => m.tier === tier).map((m, i) => ({ ...m, tier, tierIndex: i }))
  );

  const totalPages = Math.ceil(flatMembers.length / PAGE_SIZE);
  const pageMembers = flatMembers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const daysLeft = daysUntilMarathon();

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

        {/* Marathon notice banner */}
        {marathonBannerEnabled && (
          <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#1a4a8a)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, border: '1px solid #3b5999', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.08 }}>🏅</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ fontSize: 36, flexShrink: 0 }}>🏃‍♂️</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: 'white' }}>USIU Marathon — 26 July 2026</span>
                  {marathonCountries.length > 0 && (
                    <span style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
                      {marathonCountries.map(c => {
                        const flag = countries.find(ct => ct.name === c)?.flag ?? '';
                        return `${flag} Team ${c}`;
                      }).join(' · ')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 10, lineHeight: 1.5 }}>
                  Mark your calendar! The USIU run is coming up, with distances of <strong style={{ color: '#60a5fa' }}>5K · 10K · 21K</strong> on offer.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {daysLeft > 0 && (
                    <span style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 20 }}>
                      ⏳ {daysLeft} day{daysLeft !== 1 ? 's' : ''} to race day
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {lastUpdated && <span style={{ fontSize: 11, color: '#9ca3af' }}>Updated {lastUpdated}</span>}
            <button
              onClick={() => { setRefreshing(true); fetchData(); }}
              disabled={refreshing}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 12, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1 }}
            >
              {refreshing ? '…' : '↻ Refresh'}
            </button>
          </div>
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
            {/* Tier header labels for the current page */}
            {(() => {
              let lastTier: PointTier | null = null;
              return pageMembers.map((m, idx) => {
                const showHeader = m.tier !== lastTier;
                if (showHeader) lastTier = m.tier;
                const cfg = TIER_CONFIG[m.tier];
                const rank = rankMap.get(m.memberId) ?? 0;
                const sticker = getSticker(rank, allActive.length, m.memberId);
                const { bg, border } = STICKER_BG[getStickerTier(rank, allActive.length)];
                return (
                  <div key={m.memberId}>
                    {showHeader && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: idx === 0 ? 0 : 24 }}>
                        <span style={{ fontSize: 24 }}>{cfg.emoji}</span>
                        <span style={{ fontWeight: 900, fontSize: 18, color: '#1f2937' }}>{cfg.label}</span>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>{cfg.min}{cfg.max ? `–${cfg.max}` : '+'} pts</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
                          {active.filter(a => a.tier === m.tier).length} member{active.filter(a => a.tier === m.tier).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', border: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                      <span style={{ color: '#d1d5db', fontWeight: 700, fontSize: 13, width: 20, textAlign: 'center' }}>
                        {m.tier === 'move_together_champions' && m.tierIndex === 0 ? '👑' : m.tierIndex + 1}
                      </span>
                      <div title={`${m.memberName} · ${STICKER_LABELS[sticker] ?? sticker}`} style={{ width: 44, height: 44, borderRadius: '50%', background: bg, border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, cursor: 'default' }}>
                        {sticker}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.memberName} <span style={{ fontSize: 14 }}>{getCountryFlag(m.country, countries)}</span></div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>🎯 {m.runSessions + m.lunchActivities + m.raceSignups + m.racesCompleted} activities · 📅 {m.activeDays} days{m.racesCompleted > 0 ? ` · 🏅 ${m.racesCompleted} race${m.racesCompleted !== 1 ? 's' : ''}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#1a7a4a' }}>{m.totalPoints}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>points</div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24, marginBottom: 8 }}>
                <button
                  onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === 0}
                  style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: page === 0 ? '#f9fafb' : 'white', color: page === 0 ? '#d1d5db' : '#374151', fontWeight: 700, fontSize: 13, cursor: page === 0 ? 'not-allowed' : 'pointer' }}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>
                  Page {page + 1} of {totalPages} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({flatMembers.length} total)</span>
                </span>
                <button
                  onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page >= totalPages - 1}
                  style={{ padding: '8px 18px', borderRadius: 10, border: page >= totalPages - 1 ? '1px solid #e5e7eb' : '1px solid #1a7a4a', background: page >= totalPages - 1 ? '#f9fafb' : '#1a7a4a', color: page >= totalPages - 1 ? '#d1d5db' : 'white', fontWeight: 700, fontSize: 13, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            )}
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

'use client';
import { useEffect, useState, useCallback } from 'react';
import { MemberStats, CountryConfig, TIER_CONFIG, PointTier, getCountryFlag } from '@/types';
import { getSticker, getStickerTier, STICKER_BG, STICKER_LABELS } from '@/lib/stickers';

export default function MemberLeaderboardPage() {
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [me, setMe] = useState<{ memberId?: string } | null>(null);
  const [filter, setFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [lbRes, ctRes, meRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/countries'),
        fetch('/api/auth/member/me'),
      ]);
      const [lbData, ctData, meData] = await Promise.all([lbRes.json(), ctRes.json(), meRes.json()]);
      setStats(lbData.stats || []);
      const active = (ctData.countries || []).filter((c: CountryConfig) => c.isActive);
      setCountries(active);
      setMe(meData.member || null);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch { setStats([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 60000); return () => clearInterval(t); }, [fetchData]);

  const allActive = stats.filter(s => s.isActive);
  const rankMap = new Map(allActive.map((m, i) => [m.memberId, i + 1]));
  const displayed = (filter === 'All' ? allActive : allActive.filter(s => s.country === filter));
  const myRank = me?.memberId ? rankMap.get(me.memberId) : undefined;
  const myStats = me?.memberId ? allActive.find(s => s.memberId === me.memberId) : undefined;
  const tierGroups = (Object.entries(TIER_CONFIG) as [PointTier, typeof TIER_CONFIG[PointTier]][]).reverse()
    .map(([key, cfg]) => ({ tier: key, cfg, members: displayed.filter(s => s.tier === key) }));

  return (
    <div>
      {myStats && (
        <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: 16, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: '#1a7a4a', minWidth: 48, textAlign: 'center' }}>#{myRank || '—'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#145c38', fontSize: 15 }}>Your Standing</div>
            <div style={{ color: '#166534', fontSize: 13 }}>{myStats.totalPoints} pts · {myStats.activeDays} active day{myStats.activeDays !== 1 ? 's' : ''} · {TIER_CONFIG[myStats.tier].emoji} {TIER_CONFIG[myStats.tier].label}</div>
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
          <div style={{ width: 36, height: 36, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af' }}>Loading leaderboard…</p>
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', background: 'white', borderRadius: 16, border: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏁</div>
          <p style={{ color: '#9ca3af' }}>No participants yet for this filter</p>
        </div>
      ) : (
        <div>
          {tierGroups.map(({ tier, cfg, members }) => members.length === 0 ? null : (
            <div key={tier} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
                <span style={{ fontWeight: 900, fontSize: 17, color: '#1f2937' }}>{cfg.label}</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{cfg.min}{cfg.max ? `–${cfg.max}` : '+'} pts</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map((m, i) => {
                  const rank = rankMap.get(m.memberId) ?? 0;
                  const sticker = getSticker(rank, allActive.length, m.memberId);
                  const { bg, border } = STICKER_BG[getStickerTier(rank, allActive.length)];
                  const isMe = m.memberId === me?.memberId;
                  return (
                    <div key={m.memberId} style={{ background: isMe ? '#f0fdf4' : 'white', borderRadius: 14, padding: '12px 14px', border: isMe ? '2px solid #86efac' : '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: '#d1d5db', fontWeight: 700, fontSize: 13, width: 20, textAlign: 'center' }}>{tier === 'move_together_champions' && i === 0 ? '👑' : i + 1}</span>
                      <div title={`${m.memberName} · ${STICKER_LABELS[sticker] ?? sticker}`} style={{ width: 40, height: 40, borderRadius: '50%', background: bg, border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{sticker}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{m.memberName} {getCountryFlag(m.country, countries)} {isMe && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>(You)</span>}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>🎯 {m.runSessions + m.lunchActivities + m.raceSignups + m.racesCompleted} activities · 📅 {m.activeDays} days</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#1a7a4a' }}>{m.totalPoints}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>pts</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

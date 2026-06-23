'use client';
import { useEffect, useState, useCallback } from 'react';
import { MemberStats, CountryConfig, TIER_CONFIG, PointTier, getCountryFlag, Member } from '@/types';
import { getSticker, getStickerTier, STICKER_BG, STICKER_LABELS } from '@/lib/stickers';

const MARATHON_DATE = new Date('2026-07-26T07:00:00+03:00');
const SHOW_SYSTEM_NOTICE = true;
const DISTANCE_LABELS: Record<string, string> = { '5k': '5K', '10k': '10K', '21k': '21K Half Marathon' };

function daysUntilMarathon(): number {
  const diff = MARATHON_DATE.getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function MemberLeaderboardPage() {
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [me, setMe] = useState<Member | null>(null);
  const [filter, setFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const [marathonCountries, setMarathonCountries] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [lbRes, ctRes, meRes, stRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/countries'),
        fetch('/api/auth/member/me'),
        fetch('/api/admin/settings'),
      ]);
      const [lbData, ctData, meData, stData] = await Promise.all([lbRes.json(), ctRes.json(), meRes.json(), stRes.json()]);
      setStats(lbData.stats || []);
      const active = (ctData.countries || []).filter((c: CountryConfig) => c.isActive);
      setCountries(active);
      setMe(meData.member || null);
      setMarathonCountries(stData.settings?.marathonCountries ?? []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch { setStats([]); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allActive = stats.filter(s => s.isActive);
  const rankMap = new Map(allActive.map((m, i) => [m.memberId, i + 1]));
  const displayed = (filter === 'All' ? allActive : allActive.filter(s => s.country === filter));
  const myRank = me?.id ? rankMap.get(me.id) : undefined;
  const myStats = me?.id ? allActive.find(s => s.memberId === me.id) : undefined;
  const tierGroups = (Object.entries(TIER_CONFIG) as [PointTier, typeof TIER_CONFIG[PointTier]][]).reverse()
    .map(([key, cfg]) => ({ tier: key, cfg, members: displayed.filter(s => s.tier === key) }));

  const daysLeft = daysUntilMarathon();
  const countryAllowed = marathonCountries.length === 0 || (me?.country ? marathonCountries.includes(me.country) : false);
  const showMarathonCountdown = me?.marathonRegistered && countryAllowed;

  return (
    <div>
      {/* System notice banner */}
      {SHOW_SYSTEM_NOTICE && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>🛡️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#92400e', marginBottom: 3 }}>System notice — your data is safe</div>
            <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
              We identified an issue that briefly affected the live leaderboard refresh. <strong>All your activity data is fully intact.</strong> Our team has spotted and is actively resolving this — the leaderboard will update normally again shortly. Thank you for your patience! 🏃‍♂️
            </div>
          </div>
        </div>
      )}

      {/* Marathon countdown card — shown only to registered members in allowed countries */}
      {showMarathonCountdown && (
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#1a4a8a)', borderRadius: 16, padding: '16px 20px', marginBottom: 20, border: '1px solid #3b5999', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.08 }}>🏅</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 40, flexShrink: 0 }}>🏃‍♂️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                You&apos;re registered! · USIU Marathon
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: 'white', lineHeight: 1 }}>{daysLeft}</span>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>days to race day</span>
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: '#f26522', color: 'white', fontWeight: 800, fontSize: 12, padding: '3px 10px', borderRadius: 20 }}>
                  {me.marathonDistance ? DISTANCE_LABELS[me.marathonDistance] ?? me.marathonDistance : 'Marathon'} · 26 Jul 2026
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Keep logging — every activity counts!</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  const isMe = m.memberId === me?.id;
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

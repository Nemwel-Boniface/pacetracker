'use client';
import { useEffect, useState } from 'react';
import { CountryConfig } from '@/types';

const MARATHON_DATE = new Date('2026-07-26T07:00:00+03:00');
const SEEN_KEY = 'pt_marathon_notice_seen';

function daysUntilMarathon(): number {
  const diff = MARATHON_DATE.getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function MarathonNotice() {
  const [visible, setVisible] = useState(false);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [marathonCountries, setMarathonCountries] = useState<string[]>([]);
  const daysLeft = daysUntilMarathon();

  useEffect(() => {
    if (daysLeft <= 0) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem(SEEN_KEY)) return;

    (async () => {
      try {
        const [meRes, stRes, ctRes] = await Promise.all([
          fetch('/api/auth/member/me'),
          fetch('/api/admin/settings'),
          fetch('/api/countries'),
        ]);
        const [meData, stData, ctData] = await Promise.all([meRes.json(), stRes.json(), ctRes.json()]);
        const member = meData.member;
        if (!member) return;

        const bannerEnabled = stData.settings?.marathonBannerEnabled ?? true;
        const targetCountries: string[] = stData.settings?.marathonCountries ?? [];
        const eligible = targetCountries.length === 0 || targetCountries.includes(member.country);
        if (!bannerEnabled || !eligible) return;

        setCountries((ctData.countries || []).filter((c: CountryConfig) => c.isActive));
        setMarathonCountries(targetCountries);
        setTimeout(() => setVisible(true), 700);
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch { /* fail silently — non-critical UX */ }
    })();
  }, [daysLeft]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 16, right: 16, left: 16, maxWidth: 360, marginLeft: 'auto',
        background: 'linear-gradient(135deg,#1e3a5f,#1a4a8a)', borderRadius: 16, padding: '16px 18px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)', border: '1px solid #3b5999', zIndex: 1000,
        animation: 'slideIn 0.35s ease-out',
      }}
    >
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 4 }}
      >
        ×
      </button>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>🏃‍♂️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: 'white', marginBottom: 2 }}>USIU Marathon is coming up!</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>26 July 2026</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: marathonCountries.length ? 8 : 0 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: 'white', lineHeight: 1 }}>{daysLeft}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>day{daysLeft !== 1 ? 's' : ''} to go</span>
          </div>
          {marathonCountries.length > 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
              {marathonCountries.map(c => `${countries.find(ct => ct.name === c)?.flag ?? ''} Team ${c}`).join(' · ')}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

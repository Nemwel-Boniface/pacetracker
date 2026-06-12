'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [memberName, setMemberName] = useState('');

  useEffect(() => {
    fetch('/api/auth/member/me').then(r => r.json()).then(d => { if (d.member) setMemberName(d.member.name.split(' ')[0]); }).catch(() => {});
  }, []);

  async function logout() {
    await fetch('/api/auth/member/logout', { method: 'POST' });
    router.push('/authenticate');
  }

  const tabs = [
    { href: '/member', label: '🏆 Leaderboard', exact: true },
    { href: '/member/stats', label: '📊 My Stats' },
    { href: '/member/log', label: '➕ Log Activity' },
    { href: '/member/feedback', label: '💬 Feedback' },
    { href: '/member/how-it-works', label: '📖 How It Works' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', color: 'white' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏃</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>PaceTracker</div>
              {memberName && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Hi, {memberName}!</div>}
            </div>
          </div>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Sign Out</button>
        </div>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0 }}>
          {tabs.map(tab => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link key={tab.href} href={tab.href} style={{ flexShrink: 0, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: active ? 'white' : 'rgba(255,255,255,0.6)', textDecoration: 'none', borderBottom: active ? '2px solid white' : '2px solid transparent', whiteSpace: 'nowrap' }}>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </header>
      <main style={{ maxWidth: 768, margin: '0 auto', padding: '20px 16px' }}>
        {children}
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

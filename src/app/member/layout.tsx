'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import MarathonNotice from './MarathonNotice';

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [memberName, setMemberName] = useState('');
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    fetch('/api/auth/member/me').then(r => r.json()).then(d => { if (d.member) setMemberName(d.member.name.split(' ')[0]); }).catch(() => {});
    fetch('/api/member/challenges').then(r => r.json()).then(d => setPendingInviteCount((d.invites || []).length)).catch(() => {});
  }, []);

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollHints();
    // Keep the current tab in view whenever the route changes, so a deep-linked page always
    // shows its own tab highlighted instead of leaving it scrolled off-screen.
    activeTabRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    const id = setTimeout(updateScrollHints, 350);
    return () => clearTimeout(id);
  }, [pathname, updateScrollHints]);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    el.addEventListener('scroll', updateScrollHints, { passive: true });
    window.addEventListener('resize', updateScrollHints);
    return () => { el.removeEventListener('scroll', updateScrollHints); window.removeEventListener('resize', updateScrollHints); };
  }, [updateScrollHints]);

  async function logout() {
    await fetch('/api/auth/member/logout', { method: 'POST' });
    router.push('/authenticate');
  }

  const tabs = [
    { href: '/member', label: '🏆 Leaderboard', exact: true },
    { href: '/member/stats', label: '📊 My Stats' },
    { href: '/member/streaks', label: '🔥 My Streak' },
    { href: '/member/challenges', label: '🏁 Challenges' },
    { href: '/member/log', label: '➕ Log Activity' },
    { href: '/member/feedback', label: '💬 Feedback' },
    { href: '/member/how-it-works', label: '📖 How It Works' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <MarathonNotice />
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

        <div style={{ maxWidth: 768, margin: '0 auto', position: 'relative' }}>
          <div
            ref={scrollRef}
            style={{ padding: '0 16px', display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0, scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}
          >
            {tabs.map(tab => {
              const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href} href={tab.href} ref={active ? activeTabRef : undefined}
                  style={{ scrollSnapAlign: 'start', flexShrink: 0, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: active ? 'white' : 'rgba(255,255,255,0.6)', textDecoration: 'none', borderBottom: active ? '2px solid white' : '2px solid transparent', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {tab.label}
                  {tab.href === '/member/challenges' && pendingInviteCount > 0 && (
                    <span style={{ background: '#f26522', color: 'white', fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20 }}>{pendingInviteCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
          {/* Edge fades hint that the tab bar scrolls — only shown on the side there's more to see. */}
          {canScrollLeft && <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 28, background: 'linear-gradient(90deg,#145c38,transparent)', pointerEvents: 'none' }} />}
          {canScrollRight && (
            <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 36, background: 'linear-gradient(270deg,#1a7a4a,transparent)', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', animation: 'nudge 1.4s ease-in-out infinite' }}>›</span>
            </div>
          )}
        </div>
      </header>
      <main style={{ maxWidth: 768, margin: '0 auto', padding: '20px 16px' }}>
        {children}
      </main>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes nudge { 0%,100% { transform: translateX(0); opacity: 0.7; } 50% { transform: translateX(3px); opacity: 1; } }
      `}</style>
    </div>
  );
}

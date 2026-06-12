'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/admin-move2026/dashboard', label: '📊 Dashboard' },
  { href: '/admin-move2026/members', label: '👥 Members' },
  { href: '/admin-move2026/activities', label: '📅 Log Activities' },
  { href: '/admin-move2026/leaderboard', label: '🏆 Generate Board' },
  { href: '/admin-move2026/prizes', label: '🎁 Prizes' },
  { href: '/admin-move2026/winners', label: '🥇 Winners' },
  { href: '/admin-move2026/settings', label: '⚙️ Settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (pathname === '/admin-move2026/login') return <>{children}</>;
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/admin-move2026/login'); }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏃</div>
          <div><div style={{ color: 'white', fontWeight: 900, fontSize: 14 }}>PaceTracker</div><div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Admin</div></div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: 12 }}>
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, marginBottom: 2, fontSize: 13, fontWeight: 600, textDecoration: 'none', background: pathname === href ? 'rgba(255,255,255,0.15)' : 'transparent', color: pathname === href ? 'white' : 'rgba(255,255,255,0.6)' }}>
            {label}
          </Link>
        ))}
      </nav>
      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={logout} style={{ display: 'flex', width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>⬅️ Sign Out</button>
        <Link href="/leaderboard" target="_blank" style={{ display: 'flex', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>🌍 View Public Board</Link>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb' }}>
      <aside style={{ width: 220, flexShrink: 0, background: 'linear-gradient(180deg,#145c38 0%,#1a7a4a 100%)', display: 'none' }} className="md-sidebar">
        <SidebarContent />
      </aside>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <aside style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 220, background: 'linear-gradient(180deg,#145c38 0%,#1a7a4a 100%)', zIndex: 10 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setOpen(true)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>☰</button>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>🏃 PaceTracker Admin</span>
        </header>
        <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
      </div>
      <style>{`@media(min-width:768px){aside.md-sidebar{display:flex!important;flex-direction:column} header{display:none!important}}`}</style>
    </div>
  );
}
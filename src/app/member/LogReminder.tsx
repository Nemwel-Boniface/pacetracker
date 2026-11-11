'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const DISMISS_KEY = 'pt_log_prompt_dismissed';
// Same UTC "today" the log form and the 2-per-day cap use.
function todayUTC(): string { return new Date().toISOString().slice(0, 10); }

// Nudges members who have logged before, but not today, to log an activity. "Not today" hides it until tomorrow.
export default function LogReminder() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const checked = useRef(false);
  const [streak, setStreak] = useState(0);
  const hiddenHere = pathname === '/member/log' || pathname === '/member/change-password';

  useEffect(() => {
    // Check once when the app opens, and again while the prompt is up (e.g. after they log an activity).
    if (hiddenHere || (checked.current && !show)) return;
    checked.current = true;
    try { if (localStorage.getItem(DISMISS_KEY) === todayUTC()) return; } catch { /* storage unavailable */ }
    Promise.all([
      fetch('/api/admin/settings').then(r => r.json()),
      fetch('/api/member/activities').then(r => r.json()),
    ]).then(([s, a]) => {
      const due = s.settings?.logPromptEnabled !== false && (a.activities || []).length > 0 && a.todayCount === 0;
      setShow(due);
      if (due) fetch('/api/member/streak').then(r => r.json()).then(d => setStreak(d.currentStreak || 0)).catch(() => {});
    }).catch(() => {});
  }, [pathname, hiddenHere, show]);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, todayUTC()); } catch { /* storage unavailable */ }
    setShow(false);
  }

  if (!show || hiddenHere) return null;
  return (
    <div style={{ background: 'white', border: '1px solid #fed7aa', borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(242,101,34,0.08)' }}>
      <span style={{ fontSize: 28 }}>🦏</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#1f2937' }}>Nothing logged today yet</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
          {streak > 0 ? `Don't break your ${streak}-day streak 🔥 Log a quick activity.` : 'Keep the momentum going. Log a quick activity.'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <Link href="/member/log" style={{ background: '#f26522', color: 'white', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>Log now</Link>
        <button onClick={dismiss} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Not today</button>
      </div>
    </div>
  );
}

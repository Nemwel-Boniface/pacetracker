'use client';
import { useEffect, useState } from 'react';

interface Engagement {
  window: { weekStart: string; today: string };
  signups: { thisWeek: { id: string; name: string; date: string; pendingInvite: boolean }[]; prevWeek: number; pendingInvites: number; totalMembers: number };
  consistency: { activeMembers: number; loggedThisWeek: number; loggedPrevWeek: number; regulars: number; fourWeeks: number };
  goneQuiet: { id: string; name: string; lastDate: string; daysQuiet: number }[];
  neverLogged: { id: string; name: string; joined: string }[];
  challengeJoins: { id: string; title: string; featured: boolean; total: number; newThisWeek: number; newNames: string[] }[];
}

const card = { background: 'white', borderRadius: 16, padding: 20, border: '1px solid #f3f4f6' };
const h2 = { fontWeight: 700, color: '#374151', fontSize: 15, margin: '0 0 4px' };
const sub = { fontSize: 12, color: '#9ca3af', margin: '0 0 14px' };
const label = { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '14px 0 8px' };
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f9fafb', borderRadius: 8, marginBottom: 5, fontSize: 13 };

function fmt(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function pct(n: number, of: number) { return of > 0 ? Math.round((n / of) * 100) : 0; }

// Week-over-week change, e.g. "+3 vs last week".
function Delta({ now, before }: { now: number; before: number }) {
  const d = now - before;
  const color = d > 0 ? '#16a34a' : d < 0 ? '#dc2626' : '#9ca3af';
  return <span style={{ fontSize: 11, fontWeight: 700, color }}>{d > 0 ? '+' : ''}{d} vs last week</span>;
}

function Stat({ label: l, value, note }: { label: string; value: string | number; note?: React.ReactNode }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 12px' }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{l}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#1f2937', lineHeight: 1.1 }}>{value}</div>
      {note && <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>{note}</div>}
    </div>
  );
}

function ShowMore<T>({ items, render, empty, initial = 5 }: { items: T[]; render: (item: T) => React.ReactNode; empty: string; initial?: number }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{empty}</p>;
  return (
    <>
      {(all ? items : items.slice(0, initial)).map(render)}
      {items.length > initial && (
        <button onClick={() => setAll(a => !a)} style={{ background: 'none', border: 'none', color: '#1a7a4a', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
          {all ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </>
  );
}

export default function EngagementPanel() {
  const [data, setData] = useState<Engagement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/admin/engagement').then(r => r.json())
      .then(d => { if (d.error) setFailed(true); else setData(d); })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <div style={{ ...card, marginBottom: 20, fontSize: 13, color: '#9ca3af' }}>📊 Couldn&apos;t load engagement stats. Refresh to try again.</div>;
  if (!data) return <div style={{ ...card, marginBottom: 20, fontSize: 13, color: '#9ca3af' }}>📊 Loading engagement…</div>;

  const { signups, consistency: c, goneQuiet, neverLogged, challengeJoins } = data;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...card, marginBottom: 16 }}>
        <h2 style={h2}>📊 Engagement this week</h2>
        <p style={sub}>{fmt(data.window.weekStart)} – {fmt(data.window.today)}, compared with the 7 days before. Test accounts are left out.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
          <Stat label="New sign-ups" value={signups.thisWeek.length} note={<Delta now={signups.thisWeek.length} before={signups.prevWeek} />} />
          <Stat label="Logged this week" value={`${c.loggedThisWeek}/${c.activeMembers}`} note={<Delta now={c.loggedThisWeek} before={c.loggedPrevWeek} />} />
          <Stat label="3+ days this week" value={c.regulars} note={`${pct(c.regulars, c.activeMembers)}% of active members`} />
          <Stat label="All 4 last weeks" value={c.fourWeeks} note="Logged every week for 4 weeks" />
          <Stat label="Invites not accepted" value={signups.pendingInvites} note="Still on a temporary password" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        <div style={card}>
          <h2 style={h2}>🆕 New joiners</h2>
          <p style={sub}>Sign-ups and challenge joins in the last 7 days</p>
          <div style={label}>Signed up</div>
          <ShowMore items={signups.thisWeek} empty="No new sign-ups this week." render={m => (
            <div key={m.id} style={row}>
              <span style={{ fontWeight: 600 }}>{m.name}{m.pendingInvite && <span style={{ marginLeft: 6, fontSize: 10, color: '#f26522', fontWeight: 700 }}>INVITE PENDING</span>}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmt(m.date)}</span>
            </div>
          )} />
          <div style={label}>Joined a challenge</div>
          <ShowMore items={challengeJoins} empty="No running challenges with participants." render={ch => (
            <div key={ch.id} style={{ ...row, display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{ch.featured ? '⭐ ' : ''}{ch.title}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: ch.newThisWeek > 0 ? '#16a34a' : '#9ca3af', whiteSpace: 'nowrap' }}>+{ch.newThisWeek} · {ch.total} total</span>
              </div>
              {ch.newNames.length > 0 && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{ch.newNames.join(', ')}</div>}
            </div>
          )} />
        </div>

        <div style={card}>
          <h2 style={h2}>👋 Worth a nudge</h2>
          <p style={sub}>Active members who have gone quiet, easiest to win back first</p>
          <div style={label}>No log for 7+ days ({goneQuiet.length})</div>
          <ShowMore items={goneQuiet} empty="Everyone has logged in the last week. 🎉" render={m => (
            <div key={m.id} style={row}>
              <span style={{ fontWeight: 600 }}>{m.name}</span>
              <span style={{ fontSize: 11, color: m.daysQuiet >= 14 ? '#dc2626' : '#d97706', fontWeight: 600 }}>{m.daysQuiet} days · last {fmt(m.lastDate)}</span>
            </div>
          )} />
          <div style={label}>Signed up, never logged ({neverLogged.length})</div>
          <ShowMore items={neverLogged} empty="Everyone has logged at least once." render={m => (
            <div key={m.id} style={row}>
              <span style={{ fontWeight: 600 }}>{m.name}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>joined {fmt(m.joined)}</span>
            </div>
          )} />
        </div>
      </div>
    </div>
  );
}

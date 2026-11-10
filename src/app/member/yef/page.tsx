'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { YefPerson, YEF_GIFT_BUDGET_KES, YEF_LIKES_MAX, yefGiftTarget, yefGiftFrom, sameDepartment } from '@/types';

interface PublicPerson { id: string; name: string; department: string; likes: string; claimed: boolean; }
interface PublicAward { id: string; title: string; description: string; noSameDepartment: boolean; }
interface YefData { people: PublicPerson[]; santa: { published: boolean; groups: string[][] }; awards: PublicAward[]; settings: { votingOpen: boolean; resultsRevealed: boolean }; }

const card = { background: 'white', borderRadius: 16, padding: 22, border: '1px solid #f3f4f6', marginBottom: 16 };
const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };
const btn = (disabled = false) => ({ padding: '10px 18px', borderRadius: 10, background: disabled ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer' });

// How alike two names are, so the "which one is you?" list starts with the likeliest match.
function nameOverlap(a: string, b: string) {
  const words = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter(w => w.length > 1));
  const x = words(a), y = words(b);
  return [...x].filter(w => y.has(w)).length;
}

export default function MemberYefPage() {
  const [data, setData] = useState<YefData | null>(null);
  const [me, setMe] = useState<YefPerson | null>(null);
  const [memberName, setMemberName] = useState('');
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [likes, setLikes] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    return Promise.all([fetch('/api/yef').then(r => r.json()), fetch('/api/member/yef').then(r => r.json())])
      .then(([pub, mine]) => {
        if (!pub.error) setData(pub);
        if (!mine.error) { setMe(mine.me); setMemberName(mine.memberName); setVotes(mine.votes || {}); setLikes(mine.me?.likes ?? ''); }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function post(body: object) {
    setBusy(true);
    try {
      const res = await fetch('/api/member/yef', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Something went wrong'); return null; }
      return d;
    } catch { toast.error('Connection error'); return null; } finally { setBusy(false); }
  }

  async function claim(p: PublicPerson) {
    const d = await post({ action: 'claim', personId: p.id });
    if (d) { setMe(d.me); setLikes(d.me.likes ?? ''); toast.success(`Welcome, ${p.name}! 🎄`); load(); }
  }
  async function saveLikes() {
    const d = await post({ action: 'likes', likes });
    if (d) { setMe(d.me); toast.success('Likes saved, your partner can see them now 🎁'); }
  }
  async function vote(awardId: string, personId: string) {
    const d = await post({ action: 'vote', awardId, personId });
    if (d) { setVotes(v => ({ ...v, [awardId]: personId })); toast.success('Vote saved 🗳️'); }
  }

  const byId = useMemo(() => new Map((data?.people ?? []).map(p => [p.id, p])), [data]);
  if (loading) return <div style={{ ...card, color: '#9ca3af' }}>Loading YEF 2026…</div>;
  if (!data) return <div style={card}>Couldn&apos;t load YEF 2026. Please refresh.</div>;

  const header = (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', margin: '0 0 4px' }}>🎄 YEF 2026</h2>
      <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Secret Santa and Awards for the Year-End Function · <Link href="/yef-2026" style={{ color: '#1a7a4a', fontWeight: 700 }}>Open the public page</Link></p>
    </div>
  );

  if (!me) {
    const candidates = data.people.filter(p => !p.claimed && (!query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())))
      .sort((a, b) => nameOverlap(b.name, memberName) - nameOverlap(a.name, memberName) || a.name.localeCompare(b.name));
    return (
      <div>
        {header}
        <div style={card}>
          <h3 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 6px' }}>👋 Which one is you?</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>Pick your name from the Year-End list once. Then you can add your likes for your Secret Santa partner and vote in the awards.</p>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your name…" style={{ ...inp, marginBottom: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {candidates.slice(0, 40).map(p => (
              <button key={p.id} disabled={busy} onClick={() => { if (confirm(`Are you ${p.name} (${p.department})? You can only pick once.`)) claim(p); }}
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 14 }}>
                <strong>{p.name}</strong> <span style={{ color: '#9ca3af', fontSize: 12 }}>· {p.department}</span>
              </button>
            ))}
            {candidates.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No unclaimed name matches. If your name is missing or someone took it, contact the admin, Nemwel Rhino, at +254727475518.</p>}
          </div>
        </div>
      </div>
    );
  }

  const group = data.santa.groups.find(g => g.includes(me.id));
  const to = group ? byId.get(yefGiftTarget(group, me.id)!) : null;
  const from = group ? byId.get(yefGiftFrom(group, me.id)!) : null;
  const nominees = data.people.filter(p => p.id !== me.id);

  return (
    <div>
      {header}
      <div style={card}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>You&apos;re on the list as</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#1f2937' }}>{me.name} <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>· {me.department}</span></div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 6px' }}>🎁 Your Secret Santa</h3>
        {!data.santa.published && <p style={{ fontSize: 14, color: '#374151', margin: 0 }}>Pairs haven&apos;t been revealed yet. Add your likes below so your partner has ideas when they are! 🎅</p>}
        {data.santa.published && !to && <p style={{ fontSize: 14, color: '#374151', margin: 0 }}>You haven&apos;t been paired yet. The organisers will sort it out shortly.</p>}
        {data.santa.published && to && (
          <>
            <div style={{ fontSize: 13, color: '#6b7280' }}>You&apos;re gifting</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#145c38' }}>{to.name}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>{to.department}</div>
            {to.likes
              ? <div style={{ fontSize: 13, color: '#374151', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 12px', whiteSpace: 'pre-wrap' }}>💚 <strong>Likes:</strong> {to.likes}</div>
              : <div style={{ fontSize: 12, color: '#9ca3af' }}>{to.name} hasn&apos;t added likes yet. Have a chat and find out what they enjoy! 🕵️</div>}
            {from && from.id !== to.id && <p style={{ fontSize: 13, color: '#6b7280', margin: '10px 0 0' }}>You&apos;re in a group of three: <strong>{from.name}</strong> is gifting you.</p>}
          </>
        )}
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: '#9a3412' }}>💰 Budget: no more than KES {YEF_GIFT_BUDGET_KES.toLocaleString()}</div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 6px' }}>💚 What you like</h3>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>Hobbies, favourite snacks, colours, books, anything that gives your partner a gift idea. Everyone can see this on the YEF page.</p>
        <textarea value={likes} onChange={e => setLikes(e.target.value)} maxLength={YEF_LIKES_MAX} rows={4} placeholder="e.g. Coffee, hiking, sci-fi books, anything green 🌿" style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button onClick={saveLikes} disabled={busy || likes.trim() === (me.likes ?? '')} style={btn(busy || likes.trim() === (me.likes ?? ''))}>Save likes</button>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{likes.length}/{YEF_LIKES_MAX}</span>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 6px' }}>🏆 Awards</h3>
        {data.awards.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>The award list is still being put together. You can suggest one on the <Link href="/yef-2026" style={{ color: '#1a7a4a', fontWeight: 700 }}>YEF page</Link>.</p>}
        {data.awards.length > 0 && <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>{data.settings.votingOpen ? 'Pick one person per award. You can change your vote until voting closes.' : data.settings.resultsRevealed ? 'Voting has closed. See the winners on the YEF page!' : 'Voting opens soon.'}</p>}
        {data.awards.map(a => {
          const allowed = nominees.filter(p => !a.noSameDepartment || !sameDepartment(p.department, me.department));
          return (
            <div key={a.id} style={{ padding: 12, background: '#f9fafb', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{a.title}</div>
              {a.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.description}</div>}
              {a.noSameDepartment && <div style={{ fontSize: 11, color: '#9a3412', marginTop: 4 }}>Vote for someone outside {me.department}</div>}
              {data.settings.votingOpen && (
                <select value={votes[a.id] ?? ''} disabled={busy} onChange={e => e.target.value && vote(a.id, e.target.value)} style={{ ...inp, marginTop: 8 }}>
                  <option value="">Choose who should win…</option>
                  {allowed.map(p => <option key={p.id} value={p.id}>{p.name} ({p.department})</option>)}
                </select>
              )}
              {!data.settings.votingOpen && votes[a.id] && <div style={{ fontSize: 12, color: '#166534', marginTop: 6 }}>✅ You voted for {byId.get(votes[a.id])?.name}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

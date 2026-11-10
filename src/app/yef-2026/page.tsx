'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { YEF_GIFT_BUDGET_KES, YEF_AWARD_TITLE_MAX, YEF_AWARD_DESC_MAX, yefGiftTarget, yefGiftFrom } from '@/types';

interface PublicPerson { id: string; name: string; department: string; likes: string; claimed: boolean; }
interface PublicAward { id: string; title: string; description: string; noSameDepartment: boolean; }
interface YefData {
  people: PublicPerson[];
  santa: { published: boolean; groups: string[][] };
  awards: PublicAward[];
  settings: { votingOpen: boolean; resultsRevealed: boolean };
  results: { awardId: string; winnerIds: string[] }[] | null;
}

const MEMBER_YEF = '/authenticate?next=/member/yef';
const card = { background: 'white', borderRadius: 16, padding: 22, border: '1px solid #f3f4f6', marginBottom: 16 };
const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };
const cta = { display: 'inline-block', padding: '10px 18px', borderRadius: 10, background: '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none' };

function matches(p: PublicPerson, q: string) {
  const s = q.trim().toLowerCase();
  return !s || p.name.toLowerCase().includes(s) || p.department.toLowerCase().includes(s);
}

function Likes({ person }: { person: PublicPerson }) {
  return person.likes
    ? <div style={{ fontSize: 13, color: '#374151', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 12px', marginTop: 8, whiteSpace: 'pre-wrap' }}>💚 <strong>Likes:</strong> {person.likes}</div>
    : <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>No likes added yet. Time to do some friendly detective work! 🕵️</div>;
}

export default function Yef2026Page() {
  const [data, setData] = useState<YefData | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<'santa' | 'awards'>('santa');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState({ title: '', description: '', name: '' });
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/yef').then(r => r.json()).then(d => { if (d.error) setFailed(true); else setData(d); }).catch(() => setFailed(true));
  }, []);

  const byId = useMemo(() => new Map((data?.people ?? []).map(p => [p.id, p])), [data]);
  const groupOf = (id: string) => data?.santa.groups.find(g => g.includes(id)) ?? null;
  const results = useMemo(() => new Map((data?.results ?? []).map(r => [r.awardId, r.winnerIds])), [data]);

  async function suggest(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setNotice(null);
    try {
      const res = await fetch('/api/yef', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(suggestion) });
      const d = await res.json();
      if (!res.ok) { setNotice({ ok: false, text: d.error || 'Could not send it' }); return; }
      setNotice({ ok: true, text: 'Thanks! Your award idea is with the organisers. 🎉' });
      setSuggestion({ title: '', description: '', name: '' });
    } catch { setNotice({ ok: false, text: 'Connection error' }); } finally { setSending(false); }
  }

  const people = data?.people ?? [];
  const found = query.trim() ? people.filter(p => matches(p, query)).slice(0, 8) : [];
  const chosen = selected ? byId.get(selected) : null;
  const chosenGroup = chosen ? groupOf(chosen.id) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', color: 'white', padding: '2rem 1rem 1.5rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <Link href="/leaderboard" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecoration: 'none' }}>← PaceTracker</Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: '16px 0 4px' }}>🎄 YEF 2026</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0 }}>Eden Care Year-End Function: Secret Santa and Awards</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            {(['santa', 'awards'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: tab === t ? 'white' : 'rgba(255,255,255,0.15)', color: tab === t ? '#145c38' : 'white' }}>
                {t === 'santa' ? '🎁 Secret Santa' : '🏆 Awards'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 40px' }}>
        {failed && <div style={card}>Couldn&apos;t load YEF 2026 right now. Please refresh to try again.</div>}
        {!data && !failed && <div style={{ ...card, color: '#9ca3af' }}>Loading…</div>}

        {data && tab === 'santa' && (
          <>
            <div style={card}>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 8px' }}>🎁 Secret Santa: get to know someone new</h2>
              <p style={{ fontSize: 14, color: '#374151', margin: '0 0 12px', lineHeight: 1.6 }}>
                This year&apos;s gift exchange is about bringing us closer together. You&apos;re paired with a colleague, usually from another team, and you gift each other. The fun part is finding out what they love before you shop!
              </p>
              <ol style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                <li>Search your name below to find your partner.</li>
                <li>Learn what they like: check their likes here, or have a chat and find out their hobbies.</li>
                <li>Get them a thoughtful gift and bring it to the Year-End Function.</li>
                <li>Add your own likes so your partner has some ideas too.</li>
              </ol>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#9a3412', fontWeight: 700 }}>
                💰 Gift budget: no more than KES {YEF_GIFT_BUDGET_KES.toLocaleString()}. It&apos;s the thought that counts!
              </div>
              <div style={{ marginTop: 14 }}><a href={MEMBER_YEF} style={cta}>✍️ Add your likes</a></div>
            </div>

            <div style={card}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>🔎 Find your partner</h3>
              <input value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }} placeholder="Type your name…" style={inp} />
              {found.length > 0 && !selected && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {found.map(p => (
                    <button key={p.id} onClick={() => setSelected(p.id)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 14 }}>
                      <strong>{p.name}</strong> <span style={{ color: '#9ca3af', fontSize: 12 }}>· {p.department}</span>
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && found.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: '10px 0 0' }}>No one by that name. Not on the list? Let the organisers know.</p>}
              {chosen && (
                <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                  {!data.santa.published && <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>Hi <strong>{chosen.name}</strong>! 🎅 Pairs haven&apos;t been revealed yet. Check back soon, and add your likes in the meantime.</p>}
                  {data.santa.published && !chosenGroup && <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>Hi <strong>{chosen.name}</strong>! You haven&apos;t been paired yet. The organisers will sort it out shortly.</p>}
                  {data.santa.published && chosenGroup && (() => {
                    const to = byId.get(yefGiftTarget(chosenGroup, chosen.id)!);
                    const from = byId.get(yefGiftFrom(chosenGroup, chosen.id)!);
                    return (
                      <>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>Hi {chosen.name}, you&apos;re gifting</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#145c38', margin: '2px 0' }}>🎁 {to?.name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{to?.department}</div>
                        {to && <Likes person={to} />}
                        {from && from.id !== to?.id && <p style={{ fontSize: 13, color: '#6b7280', margin: '10px 0 0' }}>You&apos;re in a group of three: <strong>{from.name}</strong> is gifting you.</p>}
                        {from && from.id === to?.id && <p style={{ fontSize: 13, color: '#6b7280', margin: '10px 0 0' }}>And {to?.name} is gifting you. 🤝</p>}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div style={card}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>{data.santa.published ? '🤝 All pairs' : `👥 Who's taking part (${people.length})`}</h3>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>{data.santa.published ? 'Each pair gifts each other. A group of three gifts round in a circle.' : 'Pairs will appear here once they are revealed.'}</p>
              {data.santa.published
                ? data.santa.groups.filter(g => g.some(id => matches(byId.get(id)!, query))).map(g => (
                    <div key={g.join()} style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 10, marginBottom: 6, fontSize: 13 }}>
                      {g.map((id, i) => (
                        <span key={id}>{i > 0 && <span style={{ color: '#f26522', fontWeight: 900 }}>{g.length === 2 ? ' ↔ ' : ' → '}</span>}<strong>{byId.get(id)?.name}</strong> <span style={{ color: '#9ca3af', fontSize: 11 }}>({byId.get(id)?.department})</span></span>
                      ))}
                      {g.length === 3 && <span style={{ color: '#f26522', fontWeight: 900 }}> → back to {byId.get(g[0])?.name}</span>}
                    </div>
                  ))
                : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{people.filter(p => matches(p, query)).map(p => <span key={p.id} style={{ padding: '5px 10px', background: '#f9fafb', borderRadius: 999, fontSize: 12, color: '#374151' }}>{p.name}</span>)}</div>}
            </div>
          </>
        )}

        {data && tab === 'awards' && (
          <>
            <div style={card}>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 8px' }}>🏆 YEF 2026 Awards</h2>
              <p style={{ fontSize: 14, color: '#374151', margin: '0 0 12px', lineHeight: 1.6 }}>
                Light, fun and for everyone. Vote for one colleague per award, anyone on the list can win. You&apos;ll need to sign in to vote, and you can&apos;t vote for yourself.
              </p>
              {data.settings.votingOpen
                ? <a href={MEMBER_YEF} style={cta}>🗳️ Sign in and vote</a>
                : <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{data.settings.resultsRevealed ? '🎉 Voting has closed. Here are the winners!' : '⏳ Voting opens soon. Suggest an award below in the meantime!'}</div>}
            </div>

            <div style={card}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>{data.settings.resultsRevealed ? '🥇 Winners' : '📋 This year\'s awards'}</h3>
              {data.awards.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>The award list is still being put together.</p>}
              {data.awards.map(a => {
                const winners = (results.get(a.id) ?? []).map(id => byId.get(id)?.name).filter(Boolean);
                return (
                  <div key={a.id} style={{ padding: 12, background: '#f9fafb', borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#1f2937' }}>{a.title}</div>
                    {a.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.description}</div>}
                    {a.noSameDepartment && <div style={{ fontSize: 11, color: '#9a3412', marginTop: 4 }}>Vote for someone outside your own department</div>}
                    {data.settings.resultsRevealed && <div style={{ fontSize: 14, fontWeight: 800, color: '#145c38', marginTop: 6 }}>{winners.length ? `🏆 ${winners.join(' & ')}` : 'No votes cast'}</div>}
                  </div>
                );
              })}
            </div>

            {!data.settings.resultsRevealed && (
              <form onSubmit={suggest} style={card}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>💡 Suggest an award</h3>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>Keep it fun! E.g. &quot;Best Laugh&quot;, &quot;Office DJ&quot; or &quot;Most Likely to Reply-All&quot;. The organisers pick the final list.</p>
                <input value={suggestion.title} onChange={e => setSuggestion({ ...suggestion, title: e.target.value })} maxLength={YEF_AWARD_TITLE_MAX} placeholder="Award name" required style={{ ...inp, marginBottom: 8 }} />
                <input value={suggestion.description} onChange={e => setSuggestion({ ...suggestion, description: e.target.value })} maxLength={YEF_AWARD_DESC_MAX} placeholder="What's it for? (optional)" style={{ ...inp, marginBottom: 8 }} />
                <input value={suggestion.name} onChange={e => setSuggestion({ ...suggestion, name: e.target.value })} maxLength={60} placeholder="Your name (optional)" style={{ ...inp, marginBottom: 10 }} />
                {notice && <div style={{ fontSize: 13, marginBottom: 10, color: notice.ok ? '#166534' : '#dc2626' }}>{notice.text}</div>}
                <button type="submit" disabled={sending} style={{ ...cta, border: 'none', cursor: sending ? 'not-allowed' : 'pointer', background: sending ? '#9ca3af' : '#1a7a4a' }}>{sending ? 'Sending…' : 'Send suggestion'}</button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}

'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { YefPerson, YefAward, YefSantaState, YefSettings, YEF_LIKES_MAX, YEF_AWARD_TITLE_MAX, YEF_AWARD_DESC_MAX, sameDepartment } from '@/types';

interface AdminYef {
  people: YefPerson[]; santa: YefSantaState; awards: YefAward[]; settings: YefSettings;
  tallies: Record<string, { voters: number; tally: { personId: string; votes: number }[] }>;
  unpaired: string[]; sameDepartmentGroups: number; message?: string;
}
type Tab = 'people' | 'pairs' | 'awards';

const card = { background: 'white', borderRadius: 16, padding: 20, border: '1px solid #f3f4f6', marginBottom: 16 };
const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };
const btn = (bg = '#1a7a4a', disabled = false) => ({ padding: '8px 14px', borderRadius: 8, background: disabled ? '#9ca3af' : bg, color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const });
const ghost = (color = '#374151') => ({ padding: '6px 10px', borderRadius: 8, background: 'white', color, fontWeight: 600, fontSize: 12, border: '1px solid #e5e7eb', cursor: 'pointer', whiteSpace: 'nowrap' as const });
const h2 = { fontWeight: 800, fontSize: 15, color: '#1f2937', margin: '0 0 4px' };
const sub = { fontSize: 12, color: '#9ca3af', margin: '0 0 12px' };

export default function AdminYefPage() {
  const [data, setData] = useState<AdminYef | null>(null);
  const [tab, setTab] = useState<Tab>('people');
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState('');
  const [newPerson, setNewPerson] = useState({ name: '', department: '' });
  const [editing, setEditing] = useState<{ id: string; name: string; department: string; likes: string } | null>(null);
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [newAward, setNewAward] = useState({ title: '', description: '', noSameDepartment: false });

  useEffect(() => {
    fetch('/api/admin/yef').then(r => r.json()).then(d => { if (d.error) toast.error(d.error); else setData(d); }).catch(() => toast.error('Connection error'));
  }, []);

  async function act(body: object, success?: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/yef', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Something went wrong'); return false; }
      setData(d);
      if (d.message || success) toast.success(d.message || success);
      return true;
    } catch { toast.error('Connection error'); return false; } finally { setBusy(false); }
  }

  const byId = useMemo(() => new Map((data?.people ?? []).map(p => [p.id, p])), [data]);
  if (!data) return <div style={{ padding: 24, color: '#9ca3af' }}>Loading YEF 2026…</div>;

  const name = (id: string) => byId.get(id)?.name ?? 'Removed person';
  const dept = (id: string) => byId.get(id)?.department ?? '';
  const clash = (g: string[]) => g.some((a, i) => g.some((b, j) => i < j && sameDepartment(dept(a), dept(b))));
  const grouped = data.santa.groups.flat();
  const shown = data.people.filter(p => !filter.trim() || `${p.name} ${p.department}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const departments = [...new Set(data.people.map(p => p.department))].sort();

  function copyPairs() {
    const lines = data!.santa.groups.map(g => g.length === 2 ? `🎁 ${name(g[0])} ↔ ${name(g[1])}` : `🎁 ${g.map(name).join(' → ')} → ${name(g[0])}`);
    const text = `*YEF 2026 Secret Santa pairs* 🎄\nGift budget: up to KES 1,000\n\n${lines.join('\n')}\n\nFind your partner and their likes: ${window.location.origin}/yef-2026`;
    navigator.clipboard.writeText(text).then(() => toast.success('Pair list copied for Slack')).catch(() => toast.error('Could not copy'));
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1f2937', margin: 0 }}>🎄 YEF 2026</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Secret Santa and Awards for the Year-End Function · <a href="/yef-2026" target="_blank" rel="noopener noreferrer" style={{ color: '#1a7a4a', fontWeight: 700 }}>Open public page ↗</a></p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['people', `👥 People (${data.people.length})`], ['pairs', `🎁 Pairs (${data.santa.groups.length})`], ['awards', `🏆 Awards (${data.awards.filter(a => a.status === 'approved').length})`]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${tab === t ? '#1a7a4a' : '#e5e7eb'}`, background: tab === t ? '#f0fdf4' : 'white', color: tab === t ? '#145c38' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {tab === 'people' && (
        <>
          <div style={card}>
            <h2 style={h2}>📥 Import people</h2>
            <p style={sub}>Paste one person per line as &quot;Name, Department&quot; or copied straight from a spreadsheet (Name and Department columns). Names already on the list are skipped.</p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={5} placeholder={'Jane Wanjiku\tOperations\nJohn Otieno, Commercial'} style={{ ...inp, fontFamily: 'monospace', resize: 'vertical' }} />
            <button onClick={async () => { if (await act({ action: 'import', text: importText })) setImportText(''); }} disabled={busy || !importText.trim()} style={{ ...btn('#1a7a4a', busy || !importText.trim()), marginTop: 8 }}>Import</button>
          </div>

          <div style={card}>
            <h2 style={h2}>➕ Add one person</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <input value={newPerson.name} onChange={e => setNewPerson({ ...newPerson, name: e.target.value })} placeholder="Full name" style={{ ...inp, flex: '2 1 180px', width: 'auto' }} />
              <input value={newPerson.department} onChange={e => setNewPerson({ ...newPerson, department: e.target.value })} placeholder="Department" list="yef-depts" style={{ ...inp, flex: '2 1 160px', width: 'auto' }} />
              <datalist id="yef-depts">{departments.map(d => <option key={d} value={d} />)}</datalist>
              <button onClick={async () => { if (await act({ action: 'add_person', ...newPerson }, `${newPerson.name} added. Pair them on the Pairs tab.`)) setNewPerson({ name: '', department: '' }); }} disabled={busy || !newPerson.name.trim() || !newPerson.department.trim()} style={btn('#1a7a4a', busy || !newPerson.name.trim() || !newPerson.department.trim())}>Add</button>
            </div>
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <h2 style={{ ...h2, margin: 0 }}>The list</h2>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search name or department…" style={{ ...inp, width: 240 }} />
            </div>
            {departments.length > 0 && <p style={sub}>{departments.map(d => `${d}: ${data.people.filter(p => p.department === d).length}`).join(' · ')}</p>}
            {shown.map(p => editing?.id === p.id ? (
              <div key={p.id} style={{ padding: 12, background: '#f0fdf4', borderRadius: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={{ ...inp, flex: '2 1 180px', width: 'auto' }} />
                  <input value={editing.department} onChange={e => setEditing({ ...editing, department: e.target.value })} list="yef-depts" style={{ ...inp, flex: '2 1 160px', width: 'auto' }} />
                </div>
                <textarea value={editing.likes} onChange={e => setEditing({ ...editing, likes: e.target.value })} maxLength={YEF_LIKES_MAX} rows={2} placeholder="Likes" style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={async () => { if (await act({ action: 'update_person', ...editing }, 'Saved')) setEditing(null); }} disabled={busy} style={btn('#1a7a4a', busy)}>Save</button>
                  <button onClick={() => setEditing(null)} style={ghost()}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#f9fafb', borderRadius: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name} <span style={{ color: '#9ca3af', fontWeight: 500 }}>· {p.department}</span>{!grouped.includes(p.id) && <span style={{ marginLeft: 6, fontSize: 10, color: '#f26522', fontWeight: 800 }}>UNPAIRED</span>}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.claimedBy ? `✅ Claimed by ${p.claimedByName || 'a member'}` : 'Not claimed yet'}{p.likes ? ` · 💚 ${p.likes}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditing({ id: p.id, name: p.name, department: p.department, likes: p.likes ?? '' })} style={ghost()}>Edit</button>
                  {p.claimedBy && <button onClick={() => { if (confirm(`Release ${p.name}'s claim? ${p.claimedByName} will no longer be linked to this name.`)) act({ action: 'update_person', id: p.id, unclaim: true }, 'Claim released'); }} style={ghost('#d97706')}>Unclaim</button>}
                  <button onClick={() => { if (confirm(`Remove ${p.name} from YEF 2026? Their partner will become unpaired.`)) act({ action: 'remove_person', id: p.id }, `${p.name} removed`); }} style={ghost('#dc2626')}>Remove</button>
                </div>
              </div>
            ))}
            {data.people.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>No one yet. Import the list above.</p>}
          </div>
        </>
      )}

      {tab === 'pairs' && (
        <>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={h2}>🎁 Secret Santa pairs</h2>
                <p style={{ ...sub, margin: 0 }}>
                  {data.people.length} people · {data.santa.groups.length} groups · {data.unpaired.length} unpaired · {data.sameDepartmentGroups} same-department {data.sameDepartmentGroups === 1 ? 'group' : 'groups'}
                  {data.santa.generatedAt && ` · generated ${new Date(data.santa.generatedAt).toLocaleString()}`}
                </p>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: data.santa.published ? '#dcfce7' : '#fef9c3', color: data.santa.published ? '#166534' : '#92400e' }}>{data.santa.published ? '🟢 Published' : '🟡 Hidden from people'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button onClick={() => { if (data.santa.groups.length === 0 || confirm(`Generate new pairs? This replaces all ${data.santa.groups.length} current groups${data.santa.published ? ', and people can already see them' : ''}.`)) act({ action: 'generate' }, 'New pairs generated'); }} disabled={busy} style={btn('#1a7a4a', busy)}>🎲 {data.santa.groups.length ? 'Regenerate pairs' : 'Generate pairs'}</button>
              <button onClick={() => act({ action: 'publish', published: !data.santa.published }, data.santa.published ? 'Pairs hidden' : 'Pairs published 🎉')} disabled={busy || data.santa.groups.length === 0} style={btn(data.santa.published ? '#6b7280' : '#f26522', busy || data.santa.groups.length === 0)}>{data.santa.published ? 'Hide pairs' : '📣 Publish pairs'}</button>
              {data.santa.groups.length > 0 && <button onClick={copyPairs} style={ghost('#145c38')}>📋 Copy pair list</button>}
              {data.santa.groups.length > 0 && <button onClick={() => { if (confirm('Clear all pairs and hide them? People stay on the list.')) act({ action: 'reset_pairs' }, 'Pairs cleared'); }} disabled={busy} style={ghost('#dc2626')}>Clear pairs</button>}
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '12px 0 0' }}>The generator keeps departments apart wherever the numbers allow. With one department much bigger than the rest, a few same-department pairs can&apos;t be avoided; they&apos;re marked ⚠️ below. An odd count makes one group of three.</p>
          </div>

          {data.unpaired.length > 0 && (
            <div style={{ ...card, border: '1px solid #fed7aa', background: '#fffbf5' }}>
              <h2 style={h2}>🙋 Unpaired ({data.unpaired.length})</h2>
              <p style={sub}>Tick 2 people to pair them, or 3 for a group of three. Or add one person to an existing pair.</p>
              {data.unpaired.map(id => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'white', borderRadius: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={picked.includes(id)} onChange={e => setPicked(p => e.target.checked ? [...p, id] : p.filter(x => x !== id))} />
                    <strong>{name(id)}</strong> <span style={{ color: '#9ca3af' }}>· {dept(id)}</span>
                  </label>
                  {data.santa.groups.some(g => g.length === 2) && (
                    <select value="" onChange={e => e.target.value && act({ action: 'add_to_pair', id, targetId: e.target.value }, `${name(id)} joined a group of three`)} style={{ ...inp, width: 230 }}>
                      <option value="">Add to the pair of…</option>
                      {data.santa.groups.filter(g => g.length === 2).map(g => <option key={g.join()} value={g[0]}>{name(g[0])} & {name(g[1])}</option>)}
                    </select>
                  )}
                </div>
              ))}
              <button onClick={async () => { if (await act({ action: 'pair', ids: picked }, 'Paired')) setPicked([]); }} disabled={busy || picked.length < 2 || picked.length > 3} style={{ ...btn('#1a7a4a', busy || picked.length < 2 || picked.length > 3), marginTop: 6 }}>Pair {picked.length || ''} selected</button>
            </div>
          )}

          <div style={card}>
            <h2 style={h2}>All groups</h2>
            <p style={sub}>Use &quot;Swap with&quot; to move someone into a different pair (their places are exchanged).</p>
            {data.santa.groups.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No pairs yet. Hit Generate pairs.</p>}
            {data.santa.groups.map(g => (
              <div key={g.join()} style={{ padding: 12, background: clash(g) ? '#fff7ed' : '#f9fafb', border: `1px solid ${clash(g) ? '#fed7aa' : '#f3f4f6'}`, borderRadius: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: clash(g) ? '#9a3412' : '#6b7280' }}>{g.length === 3 ? '👨‍👩‍👧 GROUP OF THREE (gifts in a circle)' : 'PAIR'}{clash(g) ? ' · ⚠️ same department' : ''}</span>
                  <button onClick={() => act({ action: 'unpair', id: g[0] }, 'Group split up')} disabled={busy} style={ghost('#dc2626')}>Split up</button>
                </div>
                {g.map(id => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px', fontSize: 13 }}><strong>{name(id)}</strong> <span style={{ color: '#9ca3af' }}>· {dept(id)}</span></div>
                    <select value="" onChange={e => e.target.value && act({ action: 'swap', a: id, b: e.target.value }, 'Swapped')} style={{ ...inp, width: 220 }}>
                      <option value="">Swap with…</option>
                      {grouped.filter(x => !g.includes(x)).sort((a, b) => name(a).localeCompare(name(b))).map(x => <option key={x} value={x}>{name(x)} ({dept(x)})</option>)}
                    </select>
                    {g.length === 3 && <button onClick={() => act({ action: 'remove_from_pair', id }, `${name(id)} is now unpaired`)} style={ghost()}>Take out</button>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'awards' && (
        <>
          <div style={card}>
            <h2 style={h2}>🗳️ Voting</h2>
            <p style={sub}>Members sign in, pick their name once, then vote for one person per award. Nobody can vote for themselves.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => act({ action: 'settings', votingOpen: !data.settings.votingOpen }, data.settings.votingOpen ? 'Voting closed' : 'Voting is open 🗳️')} disabled={busy} style={btn(data.settings.votingOpen ? '#6b7280' : '#1a7a4a', busy)}>{data.settings.votingOpen ? 'Close voting' : 'Open voting'}</button>
              <button onClick={() => { if (data.settings.resultsRevealed || confirm('Reveal the winners on the public page?')) act({ action: 'settings', resultsRevealed: !data.settings.resultsRevealed }, data.settings.resultsRevealed ? 'Results hidden' : 'Winners revealed 🏆'); }} disabled={busy} style={btn(data.settings.resultsRevealed ? '#6b7280' : '#f26522', busy)}>{data.settings.resultsRevealed ? 'Hide results' : '🏆 Reveal winners'}</button>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '10px 0 0' }}>Status: voting {data.settings.votingOpen ? 'open' : 'closed'} · results {data.settings.resultsRevealed ? 'visible to everyone' : 'hidden'}</p>
          </div>

          <div style={card}>
            <h2 style={h2}>➕ Add an award</h2>
            <p style={sub}>Goes straight onto the ballot. Tip: switch on &quot;outside own department&quot; so bigger teams don&apos;t sweep every award.</p>
            <input value={newAward.title} onChange={e => setNewAward({ ...newAward, title: e.target.value })} maxLength={YEF_AWARD_TITLE_MAX} placeholder="Award name, e.g. Best Laugh" style={{ ...inp, marginBottom: 8 }} />
            <input value={newAward.description} onChange={e => setNewAward({ ...newAward, description: e.target.value })} maxLength={YEF_AWARD_DESC_MAX} placeholder="Short description (optional)" style={{ ...inp, marginBottom: 8 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={newAward.noSameDepartment} onChange={e => setNewAward({ ...newAward, noSameDepartment: e.target.checked })} /> Voters must pick someone outside their own department
            </label>
            <button onClick={async () => { if (await act({ action: 'save_award', status: 'approved', ...newAward }, 'Award added')) setNewAward({ title: '', description: '', noSameDepartment: false }); }} disabled={busy || !newAward.title.trim()} style={btn('#1a7a4a', busy || !newAward.title.trim())}>Add to ballot</button>
          </div>

          {(['suggested', 'approved', 'rejected'] as const).map(status => {
            const list = data.awards.filter(a => a.status === status);
            if (list.length === 0 && status !== 'approved') return null;
            return (
              <div key={status} style={card}>
                <h2 style={h2}>{status === 'suggested' ? `💡 Suggestions to review (${list.length})` : status === 'approved' ? `🏆 On the ballot (${list.length})` : `🗑️ Not used (${list.length})`}</h2>
                {list.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Nothing on the ballot yet. Approve a suggestion or add an award.</p>}
                {list.map(a => {
                  const t = data.tallies[a.id];
                  return (
                    <div key={a.id} style={{ padding: 12, background: '#f9fafb', borderRadius: 10, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 240px' }}>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{a.title}</div>
                          {a.description && <div style={{ fontSize: 12, color: '#6b7280' }}>{a.description}</div>}
                          {a.suggestedByName && <div style={{ fontSize: 11, color: '#9ca3af' }}>Suggested by {a.suggestedByName}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          {status !== 'approved' && <button onClick={() => act({ action: 'save_award', id: a.id, title: a.title, status: 'approved' }, 'Added to the ballot')} style={ghost('#166534')}>✓ Add to ballot</button>}
                          {status === 'suggested' && <button onClick={() => act({ action: 'save_award', id: a.id, title: a.title, status: 'rejected' }, 'Set aside')} style={ghost('#dc2626')}>Set aside</button>}
                          {status === 'approved' && <button onClick={() => act({ action: 'save_award', id: a.id, title: a.title, status: 'rejected' }, 'Taken off the ballot')} style={ghost('#dc2626')}>Take off ballot</button>}
                        </div>
                      </div>
                      {status === 'approved' && (
                        <>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 8, cursor: 'pointer', color: '#374151' }}>
                            <input type="checkbox" checked={!!a.noSameDepartment} onChange={e => act({ action: 'save_award', id: a.id, title: a.title, noSameDepartment: e.target.checked }, 'Saved')} /> Voters must pick someone outside their own department
                          </label>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                            🗳️ {t?.voters ?? 0} {(t?.voters ?? 0) === 1 ? 'vote' : 'votes'}{t?.tally.length ? ': ' : ''}
                            {t?.tally.slice(0, 5).map((x, i) => <span key={x.personId}>{i > 0 && ', '}<strong>{name(x.personId)}</strong> {x.votes}</span>)}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

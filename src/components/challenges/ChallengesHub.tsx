'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Challenge, ChallengeCategory, ChallengePeriod, ChallengeVisibility, CHALLENGE_CATEGORY_LABELS, CHALLENGE_PERIOD_LABELS } from '@/types';
import { actorInit } from '@/lib/actorClient';
import { PersonSelect } from '@/components/PeoplePicker';
import { TriviaPhase, TriviaQuestionPhase, TriviaVisibility } from '@/lib/trivia';

const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };

interface DistanceChallengeEntry {
  kind: 'distance';
  challenge: Challenge;
  progressKm: number;
  percentage: number;
  onPace: boolean;
  daysRemaining: number;
  participantCount: number;
  displayStatus: 'active' | 'ended' | 'cancelled';
}
interface TriviaChallengeEntry {
  kind: 'trivia';
  challenge: Challenge;
  teamCount: number;
  memberCount: number;
  phase: TriviaPhase;
  scheduledAt?: string;
  isScheduledInFuture: boolean;
  posterImageUrl?: string;
  visibility: TriviaVisibility;
}
type ChallengeEntry = DistanceChallengeEntry | TriviaChallengeEntry;
interface InviteEntry { challenge: Challenge; invitedByName: string; invitedAt: string; }
interface DiscoverEntry { challenge: Challenge; participantCount: number; }
interface Peer { id: string; name: string; avatarInitials: string; }

const TRIVIA_PHASE_LABEL: Record<TriviaPhase, string> = { idle: 'Not started', test: '🧪 Practice', main: '🔴 Live', tiebreak: '⚡ Tiebreak', finished: '🏁 Finished' };

function titleInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function StatusPill({ entry }: { entry: DistanceChallengeEntry }) {
  if (entry.displayStatus === 'cancelled') return <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>Cancelled</span>;
  if (entry.displayStatus === 'ended') return <span style={{ background: entry.percentage >= 100 ? '#dcfce7' : '#f3f4f6', color: entry.percentage >= 100 ? '#166534' : '#6b7280', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{entry.percentage >= 100 ? '🏁 Goal hit!' : '🏁 Ended'}</span>;
  return entry.onPace
    ? <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>✅ On pace</span>
    : <span style={{ background: '#ffedd5', color: '#9a3412', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>⏳ Behind pace</span>;
}

function DistanceChallengeCard({ entry, basePath }: { entry: DistanceChallengeEntry; basePath: string }) {
  const { challenge } = entry;
  return (
    <Link href={`${basePath}/${challenge.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 16, marginBottom: 10, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{challenge.title}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {CHALLENGE_CATEGORY_LABELS[challenge.category!]} · {CHALLENGE_PERIOD_LABELS[challenge.period!]} · 👥 {entry.participantCount} · {challenge.visibility === 'open' ? '🌍 Open' : '🔒 Invite-only'}
            </div>
          </div>
          <StatusPill entry={entry} />
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: 20, height: 8, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${entry.percentage}%`, height: '100%', background: entry.percentage >= 100 ? '#16a34a' : '#1a7a4a', borderRadius: 20, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
          <span><strong style={{ color: '#1f2937' }}>{entry.progressKm}km</strong> / {challenge.goalKm}km — {entry.percentage}%</span>
          {entry.displayStatus === 'active' && <span>{entry.daysRemaining}d left</span>}
        </div>
      </div>
    </Link>
  );
}

function TriviaChallengeCard({ entry, basePath, legacyMethaliHref }: { entry: TriviaChallengeEntry; basePath: string; legacyMethaliHref: string }) {
  const { challenge } = entry;
  // The historical Methali record routes back to the real, still-live game rather than the
  // generic trivia control panel for this frozen record.
  const href = challenge.isLegacyMethali ? legacyMethaliHref : `${basePath}/${challenge.id}`;
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 16, marginBottom: 10, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
        {entry.posterImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.posterImageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#166534', flexShrink: 0 }}>{titleInitials(challenge.title)}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{challenge.title}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            👥 {entry.teamCount} teams · {entry.memberCount} players · {entry.visibility === 'private' ? '🔒 Private' : '🌍 Public'}
          </div>
        </div>
        <span style={{ background: entry.isScheduledInFuture ? '#e0e7ff' : '#f3f4f6', color: entry.isScheduledInFuture ? '#3730a3' : '#6b7280', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {entry.isScheduledInFuture ? '📅 Scheduled' : TRIVIA_PHASE_LABEL[entry.phase]}
        </span>
      </div>
    </Link>
  );
}

// ─── Trivia creation builder ───────────────────────────────────────────────────
interface DraftMember { key: string; name: string; memberId?: string; }
interface DraftTeam { key: string; name: string; members: DraftMember[]; }
interface DraftQuestion { key: string; phase: TriviaQuestionPhase; prompt: string; text: string; meaning: string; }

let draftKeyCounter = 0;
function draftKey() { return `d${++draftKeyCounter}`; }

function TeamBuilder({ teams, setTeams, peers }: { teams: DraftTeam[]; setTeams: (t: DraftTeam[]) => void; peers: Peer[] }) {
  const [newMemberName, setNewMemberName] = useState<Record<string, string>>({});

  function addTeam() { setTeams([...teams, { key: draftKey(), name: `Team ${teams.length + 1}`, members: [] }]); }
  function removeTeam(key: string) { setTeams(teams.filter(t => t.key !== key)); }
  function renameTeam(key: string, name: string) { setTeams(teams.map(t => (t.key === key ? { ...t, name } : t))); }
  function addMemberFromPeer(teamKey: string, peerId: string) {
    const peer = peers.find(p => p.id === peerId); if (!peer) return;
    setTeams(teams.map(t => (t.key === teamKey ? { ...t, members: [...t.members, { key: draftKey(), name: peer.name, memberId: peer.id }] } : t)));
  }
  function addGuestMember(teamKey: string) {
    const name = (newMemberName[teamKey] || '').trim(); if (!name) return;
    setTeams(teams.map(t => (t.key === teamKey ? { ...t, members: [...t.members, { key: draftKey(), name }] } : t)));
    setNewMemberName(prev => ({ ...prev, [teamKey]: '' }));
  }
  function removeMember(teamKey: string, memberKey: string) {
    setTeams(teams.map(t => (t.key === teamKey ? { ...t, members: t.members.filter(m => m.key !== memberKey) } : t)));
  }
  const assignedMemberIds = new Set(teams.flatMap(t => t.members.map(m => m.memberId).filter(Boolean)));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 10 }}>
        {teams.map(team => (
          <div key={team.key} style={{ background: '#fafaf9', borderRadius: 12, border: '1px solid #f3f4f6', padding: 12 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input value={team.name} onChange={e => renameTeam(team.key, e.target.value)} maxLength={40} style={{ ...inp, padding: '7px 10px', fontSize: 13, fontWeight: 700 }} />
              {teams.length > 2 && <button type="button" onClick={() => removeTeam(team.key)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}>🗑️</button>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {team.members.map(m => (
                <span key={m.key} style={{ background: '#f0fdf4', color: '#166534', fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {m.name}
                  <button type="button" onClick={() => removeMember(team.key, m.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontWeight: 900, padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ marginBottom: 6 }}>
              <PersonSelect people={peers.filter(p => !assignedMemberIds.has(p.id))} value="" onChange={id => addMemberFromPeer(team.key, id)} placeholder="+ Search members to add…" />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={newMemberName[team.key] || ''} onChange={e => setNewMemberName(prev => ({ ...prev, [team.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuestMember(team.key); } }}
                placeholder="Or add a guest name…" style={{ ...inp, flex: 1, padding: '6px 10px', fontSize: 12 }}
              />
              <button type="button" onClick={() => addGuestMember(team.key)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        ))}
      </div>
      {teams.length < 8 && <button type="button" onClick={addTeam} style={{ padding: '8px 14px', borderRadius: 8, border: '1px dashed #d1d5db', background: 'white', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Add Team</button>}
    </div>
  );
}

const PHASE_TAB_LABEL: Record<TriviaQuestionPhase, string> = { test: '🧪 Practice', main: '🏆 Main', tiebreak: '⚡ Tiebreak' };

function QuestionsBuilder({ questions, setQuestions, asAdmin }: { questions: DraftQuestion[]; setQuestions: (q: DraftQuestion[]) => void; asAdmin?: boolean }) {
  const [tab, setTab] = useState<'upload' | 'manual'>('upload');
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<{ row: number; message: string }[]>([]);
  const [manualDraft, setManualDraft] = useState({ phase: 'main' as TriviaQuestionPhase, prompt: '', text: '', meaning: '' });

  async function downloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const res = await fetch('/api/member/challenges/trivia-template', actorInit(asAdmin));
      if (!res.ok) { toast.error('Failed to download template'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'trivia-questions-template.xlsx';
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Connection error'); } finally { setDownloadingTemplate(false); }
  }

  async function handleFile(file: File) {
    setUploading(true); setUploadErrors([]);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/member/challenges/trivia-parse', actorInit(asAdmin, { method: 'POST', body: fd }));
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to parse file'); return; }
      setUploadErrors(data.errors || []);
      if (data.questions?.length) {
        setQuestions([...questions, ...data.questions.map((q: Omit<DraftQuestion, 'key'>) => ({ ...q, key: draftKey() }))]);
        toast.success(`Added ${data.questions.length} question${data.questions.length === 1 ? '' : 's'} from the file`);
      }
    } catch { toast.error('Connection error'); } finally { setUploading(false); }
  }

  function addManual() {
    if (!manualDraft.prompt.trim() || !manualDraft.text.trim() || !manualDraft.meaning.trim()) { toast.error('Fill in prompt, full answer, and meaning'); return; }
    setQuestions([...questions, { key: draftKey(), ...manualDraft, prompt: manualDraft.prompt.trim(), text: manualDraft.text.trim(), meaning: manualDraft.meaning.trim() }]);
    setManualDraft({ phase: manualDraft.phase, prompt: '', text: '', meaning: '' });
  }
  function removeQuestion(key: string) { setQuestions(questions.filter(q => q.key !== key)); }

  const counts = { test: questions.filter(q => q.phase === 'test').length, main: questions.filter(q => q.phase === 'main').length, tiebreak: questions.filter(q => q.phase === 'tiebreak').length };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setTab('upload')} style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: `1.5px solid ${tab === 'upload' ? '#1a7a4a' : '#e5e7eb'}`, background: tab === 'upload' ? '#1a7a4a' : 'white', color: tab === 'upload' ? 'white' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📤 Upload Excel</button>
        <button type="button" onClick={() => setTab('manual')} style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: `1.5px solid ${tab === 'manual' ? '#1a7a4a' : '#e5e7eb'}`, background: tab === 'manual' ? '#1a7a4a' : 'white', color: tab === 'manual' ? 'white' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✍️ Add Manually</button>
      </div>

      {tab === 'upload' ? (
        <div style={{ background: '#fafaf9', borderRadius: 12, border: '1px solid #f3f4f6', padding: 14 }}>
          <button type="button" onClick={downloadTemplate} disabled={downloadingTemplate} style={{ display: 'inline-block', marginBottom: 10, fontSize: 12, color: '#1a7a4a', fontWeight: 700, background: 'none', border: 'none', padding: 0, cursor: downloadingTemplate ? 'not-allowed' : 'pointer' }}>
            {downloadingTemplate ? 'Downloading…' : '⬇️ Download blank template (.xlsx)'}
          </button>
          <input type="file" accept=".xlsx" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} style={{ display: 'block', fontSize: 13 }} />
          {uploading && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Parsing…</div>}
          {uploadErrors.length > 0 && (
            <div style={{ marginTop: 10, background: '#fef2f2', borderRadius: 8, padding: '8px 12px' }}>
              {uploadErrors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#991b1b' }}>Row {e.row}: {e.message}</div>)}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#fafaf9', borderRadius: 12, border: '1px solid #f3f4f6', padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {(['test', 'main', 'tiebreak'] as TriviaQuestionPhase[]).map(p => (
              <button key={p} type="button" onClick={() => setManualDraft(d => ({ ...d, phase: p }))} style={{ flex: 1, padding: '7px 6px', borderRadius: 8, border: `1.5px solid ${manualDraft.phase === p ? '#1a7a4a' : '#e5e7eb'}`, background: manualDraft.phase === p ? '#1a7a4a' : 'white', color: manualDraft.phase === p ? 'white' : '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {PHASE_TAB_LABEL[p]}
              </button>
            ))}
          </div>
          <input value={manualDraft.prompt} onChange={e => setManualDraft(d => ({ ...d, prompt: e.target.value }))} placeholder="Prompt shown live (half-reveal)" style={{ ...inp, marginBottom: 6, fontSize: 13 }} />
          <input value={manualDraft.text} onChange={e => setManualDraft(d => ({ ...d, text: e.target.value }))} placeholder="Full answer" style={{ ...inp, marginBottom: 6, fontSize: 13 }} />
          <textarea value={manualDraft.meaning} onChange={e => setManualDraft(d => ({ ...d, meaning: e.target.value }))} placeholder="Meaning / explanation" rows={2} style={{ ...inp, marginBottom: 8, fontSize: 13, resize: 'vertical' as const }} />
          <button type="button" onClick={addManual} style={{ padding: '8px 16px', borderRadius: 8, background: '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>+ Add Question</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280', margin: '10px 0' }}>
        <span>🧪 {counts.test} practice</span><span>🏆 {counts.main} main</span><span>⚡ {counts.tiebreak} tiebreak</span>
      </div>
      {questions.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: 10 }}>
          {questions.map(q => (
            <div key={q.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #fafafa' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', flexShrink: 0, width: 46 }}>{q.phase}</span>
              <span style={{ fontSize: 12, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.prompt}</span>
              <button type="button" onClick={() => removeQuestion(q.key)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChallengesHub({ basePath, asAdmin, legacyMethaliHref = '/methali-trivia' }: { basePath: string; asAdmin?: boolean; legacyMethaliHref?: string }) {
  const [owned, setOwned] = useState<ChallengeEntry[]>([]);
  const [joined, setJoined] = useState<DistanceChallengeEntry[]>([]);
  const [invites, setInvites] = useState<InviteEntry[]>([]);
  const [discover, setDiscover] = useState<DiscoverEntry[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [challengeKind, setChallengeKind] = useState<'distance' | 'trivia'>('distance');
  const [form, setForm] = useState({ title: '', category: 'run_walk' as ChallengeCategory, period: 'monthly' as ChallengePeriod, goalKm: '', visibility: 'open' as ChallengeVisibility });
  const [triviaForm, setTriviaForm] = useState({ posterImageUrl: '', visibility: 'public' as TriviaVisibility, scheduledAt: '', timerSeconds: '30' });
  const [triviaTeams, setTriviaTeams] = useState<DraftTeam[]>([{ key: draftKey(), name: 'Team 1', members: [] }, { key: draftKey(), name: 'Team 2', members: [] }]);
  const [triviaQuestions, setTriviaQuestions] = useState<DraftQuestion[]>([]);

  function fetchData() {
    setLoading(true);
    fetch('/api/member/challenges', actorInit(asAdmin))
      .then(r => r.json())
      .then(d => { setOwned(d.owned || []); setJoined(d.joined || []); setInvites(d.invites || []); setDiscover(d.discover || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetch('/api/member/peers', actorInit(asAdmin)).then(r => r.json()).then(d => setPeers(d.peers || [])).catch(() => {}); }, [asAdmin]);

  function resetTriviaForm() {
    setTriviaForm({ posterImageUrl: '', visibility: 'public', scheduledAt: '', timerSeconds: '30' });
    setTriviaTeams([{ key: draftKey(), name: 'Team 1', members: [] }, { key: draftKey(), name: 'Team 2', members: [] }]);
    setTriviaQuestions([]);
  }

  async function handleCreateDistance(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!form.title.trim()) { setError('Give your challenge a name'); return; }
    const goal = parseFloat(form.goalKm);
    if (!goal || goal <= 0) { setError('Enter a goal distance'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/member/challenges', actorInit(asAdmin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'distance', ...form, goalKm: goal }) }));
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create challenge'); return; }
      toast.success(form.visibility === 'open' ? 'Challenge created! Anyone can join, and you can invite people from the challenge page 🎯' : 'Challenge created! Invite people from the challenge page 🎯');
      setForm({ title: '', category: 'run_walk', period: 'monthly', goalKm: '', visibility: 'open' });
      setShowForm(false);
      fetchData();
    } catch { setError('Connection error'); } finally { setCreating(false); }
  }

  async function handleCreateTrivia(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!form.title.trim()) { setError('Give your trivia a name'); return; }
    if (triviaTeams.length < 2) { setError('Add at least 2 teams'); return; }
    if (triviaTeams.some(t => t.members.length === 0)) { setError('Every team needs at least one member'); return; }
    const mainCount = triviaQuestions.filter(q => q.phase === 'main').length;
    if (mainCount === 0) { setError('Add at least one "main" question'); return; }
    if (mainCount < triviaTeams.length) { setError(`Add at least ${triviaTeams.length} "main" questions so every team gets a turn`); return; }

    setCreating(true);
    try {
      const res = await fetch('/api/member/challenges', actorInit(asAdmin, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'trivia', title: form.title,
          posterImageUrl: triviaForm.posterImageUrl || undefined, visibility: triviaForm.visibility,
          scheduledAt: triviaForm.scheduledAt ? new Date(triviaForm.scheduledAt).toISOString() : undefined,
          timerSeconds: Number(triviaForm.timerSeconds) || 30,
          teams: triviaTeams.map(t => ({ name: t.name, members: t.members.map(m => ({ name: m.name, memberId: m.memberId })) })),
          questions: triviaQuestions.map(q => ({ phase: q.phase, prompt: q.prompt, text: q.text, meaning: q.meaning })),
        }),
      }));
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create trivia'); return; }
      toast.success('Trivia created! 🏛️ Open it to start the game');
      setForm({ title: '', category: 'run_walk', period: 'monthly', goalKm: '', visibility: 'open' });
      resetTriviaForm();
      setShowForm(false);
      fetchData();
    } catch { setError('Connection error'); } finally { setCreating(false); }
  }

  async function respond(challengeId: string, action: 'accept' | 'decline') {
    setRespondingId(challengeId);
    try {
      const res = await fetch(`/api/member/challenges/${challengeId}/respond`, actorInit(asAdmin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }));
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to respond'); return; }
      toast.success(action === 'accept' ? 'Joined the challenge! 🎯' : 'Invite declined');
      fetchData();
    } catch { toast.error('Connection error'); } finally { setRespondingId(null); }
  }

  async function join(challengeId: string) {
    setRespondingId(challengeId);
    try {
      const res = await fetch(`/api/member/challenges/${challengeId}/join`, actorInit(asAdmin, { method: 'POST' }));
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to join'); return; }
      toast.success('Joined the challenge! 🎯 Tag your runs to it when you log them');
      fetchData();
    } catch { toast.error('Connection error'); } finally { setRespondingId(null); }
  }

  const weeklyPace = form.period === 'monthly' && form.goalKm ? Math.round((parseFloat(form.goalKm) / 30) * 7 * 10) / 10 : null;

  const segBtn = (active: boolean) => ({ flex: 1, padding: '10px 8px', borderRadius: 10, border: `1.5px solid ${active ? '#1a7a4a' : '#e5e7eb'}`, background: active ? '#1a7a4a' : 'white', color: active ? 'white' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' as const, transition: 'all 0.15s' });

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', margin: '0 0 4px' }}>🏁 Challenges</h2>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Create a distance goal or a live trivia game, and track who&apos;s crushing it</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 8, background: '#f26522', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ New Challenge'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => setChallengeKind('distance')} style={segBtn(challengeKind === 'distance')}>🏃 Distance Goal</button>
            <button type="button" onClick={() => setChallengeKind('trivia')} style={segBtn(challengeKind === 'trivia')}>🏛️ Trivia Game</button>
          </div>

          {challengeKind === 'distance' ? (
            <form onSubmit={handleCreateDistance}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Challenge Name *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Team 120km Monthly Push" style={inp} maxLength={60} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Category *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setForm({ ...form, category: 'run_walk' })} style={segBtn(form.category === 'run_walk')}>🏃 Run / Walk / Hike</button>
                  <button type="button" onClick={() => setForm({ ...form, category: 'cycling' })} style={segBtn(form.category === 'cycling')}>🚴 Cycling</button>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Period *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setForm({ ...form, period: 'weekly' })} style={segBtn(form.period === 'weekly')}>Weekly (7 days)</button>
                  <button type="button" onClick={() => setForm({ ...form, period: 'monthly' })} style={segBtn(form.period === 'monthly')}>Monthly (30 days)</button>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Goal Distance — km *</label>
                <input type="number" min="0" step="0.1" value={form.goalKm} onChange={e => setForm({ ...form, goalKm: e.target.value })} placeholder="e.g. 120" style={inp} />
                {weeklyPace && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>≈ {weeklyPace}km/week to stay on pace</div>}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Who can join?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setForm({ ...form, visibility: 'open' })} style={segBtn(form.visibility === 'open')}>🌍 Anyone can join</button>
                  <button type="button" onClick={() => setForm({ ...form, visibility: 'invite' })} style={segBtn(form.visibility === 'invite')}>🔒 Invite-only</button>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
                  {form.visibility === 'open' ? 'Listed for everyone to discover and join. Members who join can invite others too.' : 'Hidden from others. Only people you invite can join.'}
                </div>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 14 }}>
                ⚠️ Only activities logged <strong>with a distance (km)</strong> and tagged to this challenge when logging count. Rank is by total distance; points (+1 for group activities) are shown alongside.
              </div>
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button type="submit" disabled={creating} style={{ padding: '11px 22px', borderRadius: 10, background: creating ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating…' : 'Create Challenge'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreateTrivia}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Trivia Name *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Countries of the World Trivia" style={inp} maxLength={60} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Poster image URL</label>
                  <input value={triviaForm.posterImageUrl} onChange={e => setTriviaForm(f => ({ ...f, posterImageUrl: e.target.value }))} placeholder="https://… (optional)" style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Visibility</label>
                  <select value={triviaForm.visibility} onChange={e => setTriviaForm(f => ({ ...f, visibility: e.target.value as TriviaVisibility }))} style={inp}>
                    <option value="public">🌍 Public — anyone can watch</option>
                    <option value="private">🔒 Private — sign-in required</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Schedule for later</label>
                  <input type="datetime-local" value={triviaForm.scheduledAt} onChange={e => setTriviaForm(f => ({ ...f, scheduledAt: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Timer per round (seconds)</label>
                  <input type="number" min={5} max={300} value={triviaForm.timerSeconds} onChange={e => setTriviaForm(f => ({ ...f, timerSeconds: e.target.value }))} style={inp} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Teams *</label>
                <TeamBuilder teams={triviaTeams} setTeams={setTriviaTeams} peers={peers} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Questions *</label>
                <QuestionsBuilder questions={triviaQuestions} setQuestions={setTriviaQuestions} asAdmin={asAdmin} />
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 14 }}>
                🎙️ Same mechanic as Methali Trivia: you read the prompt aloud, the room shouts the answer, you score Full / Half / None.
              </div>
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button type="submit" disabled={creating} style={{ padding: '11px 22px', borderRadius: 10, background: creating ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating…' : 'Create Trivia'}
              </button>
            </form>
          )}
        </div>
      )}

      {invites.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#374151', margin: '0 0 10px' }}>📩 Invitations ({invites.length})</h3>
          {invites.map(inv => (
            <div key={inv.challenge.id} style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#4c1d95' }}>{inv.challenge.title}</div>
              <div style={{ fontSize: 11, color: '#7c3aed', margin: '3px 0 10px' }}>
                {CHALLENGE_CATEGORY_LABELS[inv.challenge.category!]} · {CHALLENGE_PERIOD_LABELS[inv.challenge.period!]} · Goal {inv.challenge.goalKm}km · Invited by <strong>{inv.invitedByName}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => respond(inv.challenge.id, 'accept')} disabled={respondingId === inv.challenge.id} style={{ padding: '7px 16px', borderRadius: 8, background: '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>✓ Accept</button>
                <button onClick={() => respond(inv.challenge.id, 'decline')} disabled={respondingId === inv.challenge.id} style={{ padding: '7px 16px', borderRadius: 8, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 12, border: '1px solid #e5e7eb', cursor: 'pointer' }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#374151', margin: '0 0 10px' }}>🏆 Challenges I Own</h3>
        {owned.length === 0
          ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13, background: 'white', borderRadius: 14, border: '1px solid #f3f4f6' }}>You haven&apos;t created a challenge yet.</div>
          : owned.map(e => e.kind === 'trivia' ? <TriviaChallengeCard key={e.challenge.id} entry={e} basePath={basePath} legacyMethaliHref={legacyMethaliHref} /> : <DistanceChallengeCard key={e.challenge.id} entry={e} basePath={basePath} />)}
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#374151', margin: '0 0 10px' }}>🤝 Challenges I&apos;ve Joined</h3>
        {joined.length === 0
          ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13, background: 'white', borderRadius: 14, border: '1px solid #f3f4f6' }}>No joined challenges yet — join an open one below, wait for an invite, or create your own above.</div>
          : joined.map(e => <DistanceChallengeCard key={e.challenge.id} entry={e} basePath={basePath} />)}
      </div>

      {discover.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#374151', margin: '0 0 10px' }}>🌍 Open Challenges — Jump In</h3>
          {discover.map(d => (
            <div key={d.challenge.id} style={{ background: 'white', border: '1px solid #fed7aa', borderRadius: 14, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href={`${basePath}/${d.challenge.id}`} style={{ flex: '1 1 200px', minWidth: 0, textDecoration: 'none' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1f2937' }}>{d.challenge.title}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                  {CHALLENGE_CATEGORY_LABELS[d.challenge.category!]} · {CHALLENGE_PERIOD_LABELS[d.challenge.period!]} · Goal {d.challenge.goalKm}km · 👥 {d.participantCount} · by {d.challenge.ownerName}
                </div>
              </Link>
              <button onClick={() => join(d.challenge.id)} disabled={respondingId === d.challenge.id} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 8, background: '#f26522', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
                {respondingId === d.challenge.id ? 'Joining…' : '+ Join'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

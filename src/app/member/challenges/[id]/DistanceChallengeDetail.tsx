'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Challenge, ChallengeParticipant, ChallengeLeaderboardEntry, ChallengePace, CHALLENGE_CATEGORY_LABELS, CHALLENGE_PERIOD_LABELS } from '@/types';

const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };

interface Peer { id: string; name: string; avatarInitials: string; }
interface DetailResponse {
  challenge: Challenge;
  leaderboard: ChallengeLeaderboardEntry[];
  myParticipant: ChallengeParticipant;
  myProgressKm: number;
  pace: ChallengePace;
  isOwner: boolean;
  participants?: ChallengeParticipant[];
  displayStatus: 'active' | 'ended' | 'cancelled';
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
function Avatar({ name, size = 30, bg = '#1a7a4a' }: { name: string; size?: number; bg?: string }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: bg, color: 'white', fontSize: size * 0.38, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid white' }}>
      {initials(name)}
    </span>
  );
}
function fmtDateLabel(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function InvitePicker({ peers, selected, onChange }: { peers: Peer[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);
  function toggle(id: string) { onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]); }
  const selectedPeers = peers.filter(p => selected.includes(p.id));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {selectedPeers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectedPeers.map(p => (
            <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 20, padding: '3px 10px 3px 6px', fontSize: 12, fontWeight: 600, color: '#14532d' }}>
              <Avatar name={p.name} size={18} />
              {p.name}
              <button onClick={() => toggle(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} style={{ ...inp, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: selected.length ? '#1f2937' : '#9ca3af' }}>
        <span>{selected.length ? `${selected.length} selected` : 'Select members to invite…'}</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
          {peers.length === 0 ? (
            <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>No eligible members to invite</div>
          ) : peers.map(p => {
            const checked = selected.includes(p.id);
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: checked ? '#f0fdf4' : 'white', borderBottom: '1px solid #fafafa' }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} style={{ accentColor: '#1a7a4a', width: 15, height: 15 }} />
                <Avatar name={p.name} size={26} bg={checked ? '#1a7a4a' : '#e5e7eb'} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{p.name}</span>
                {checked && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#16a34a' }}>✓</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DistanceChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [busy, setBusy] = useState(false);

  function fetchData() {
    fetch(`/api/member/challenges/${id}`)
      .then(async r => {
        if (!r.ok) { setNotFound(true); return; }
        setData(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, [id]);
  useEffect(() => {
    fetch('/api/member/peers').then(r => r.json()).then(d => setPeers(d.peers || [])).catch(() => {});
  }, []);

  async function sendInvites() {
    if (inviteIds.length === 0) return;
    setSendingInvites(true);
    try {
      const res = await fetch(`/api/member/challenges/${id}/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds: inviteIds }) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to send invites'); return; }
      toast.success(`Invited ${d.invited.length} ${d.invited.length === 1 ? 'person' : 'people'}${d.skipped.length ? ` (${d.skipped.length} skipped)` : ''}`);
      setInviteIds([]);
      fetchData();
    } catch { toast.error('Connection error'); } finally { setSendingInvites(false); }
  }

  async function respond(action: 'accept' | 'decline') {
    setBusy(true);
    try {
      const res = await fetch(`/api/member/challenges/${id}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to respond'); return; }
      toast.success(action === 'accept' ? 'Joined! 🎯' : 'Invite declined');
      fetchData();
    } catch { toast.error('Connection error'); } finally { setBusy(false); }
  }

  async function leave() {
    if (!confirm('Leave this challenge? Your progress will stop counting.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/member/challenges/${id}/leave`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to leave'); return; }
      toast.success('You left the challenge');
      router.push('/member/challenges');
    } catch { toast.error('Connection error'); } finally { setBusy(false); }
  }

  async function cancelChallenge() {
    if (!confirm('Cancel this challenge for everyone? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/member/challenges/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to cancel'); return; }
      toast.success('Challenge cancelled');
      fetchData();
    } catch { toast.error('Connection error'); } finally { setBusy(false); }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  );
  if (notFound || !data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Challenge not found, or you don&apos;t have access to it.</div>;

  const { challenge, leaderboard, myParticipant, myProgressKm, pace, isOwner, participants, displayStatus } = data;
  const invitedIds = new Set((participants || []).filter(p => p.status === 'pending' || p.status === 'accepted').map(p => p.memberId));
  const invitablePeers = peers.filter(p => !invitedIds.has(p.id));
  const isPendingSelf = myParticipant.status === 'pending';
  const myRank = leaderboard.find(e => e.memberId === myParticipant.memberId)?.rank;

  return (
    <div>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 900, color: '#1f2937', margin: '0 0 4px' }}>{challenge.title}</h2>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {CHALLENGE_CATEGORY_LABELS[challenge.category!]} · {CHALLENGE_PERIOD_LABELS[challenge.period!]} · Goal {challenge.goalKm}km
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
              {fmtDateLabel(challenge.startDate!)} – {fmtDateLabel(challenge.endDate!)} · Created by {challenge.ownerName}
            </div>
          </div>
          {displayStatus === 'cancelled' && <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Cancelled</span>}
          {displayStatus === 'ended' && <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>🏁 Ended</span>}
          {displayStatus === 'active' && <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Active</span>}
        </div>
      </div>

      {isPendingSelf ? (
        <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#4c1d95', fontWeight: 600, marginBottom: 10 }}>You&apos;ve been invited to this challenge — join in?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => respond('accept')} disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, background: '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>✓ Accept</button>
            <button onClick={() => respond('decline')} disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 13, border: '1px solid #e5e7eb', cursor: 'pointer' }}>Decline</button>
          </div>
        </div>
      ) : (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Your Standing{myRank ? ` — Rank #${myRank}` : ''}</div>
          <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 20, height: 10, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${pace.percentage}%`, height: '100%', background: '#16a34a', borderRadius: 20, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#14532d' }}>{myProgressKm}km <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>/ {challenge.goalKm}km — {pace.percentage}%</span></span>
            {displayStatus === 'active' && (pace.onPace
              ? <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✅ On pace</span>
              : <span style={{ fontSize: 12, fontWeight: 700, color: '#9a3412' }}>⏳ Behind pace ({pace.expectedKm}km expected)</span>)}
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: 14, color: '#374151' }}>🏆 Leaderboard</div>
        {leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13 }}>🏁 No participants yet</div>
        ) : leaderboard.map(entry => {
          const isMe = entry.memberId === myParticipant.memberId;
          return (
            <div key={entry.memberId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #fafafa', background: isMe ? '#f0fdf4' : 'white' }}>
              <span style={{ width: 22, fontWeight: 900, color: entry.rank === 1 ? '#f59e0b' : '#9ca3af', fontSize: 14, flexShrink: 0 }}>{entry.rank === 1 ? '👑' : `#${entry.rank}`}</span>
              <Avatar name={entry.memberName} size={32} bg={isMe ? '#1a7a4a' : '#6b7280'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{entry.memberName}{isMe ? ' (You)' : ''}</div>
                <div style={{ background: '#f3f4f6', borderRadius: 20, height: 6, overflow: 'hidden', marginTop: 4, maxWidth: 160 }}>
                  <div style={{ width: `${entry.percentage}%`, height: '100%', background: '#1a7a4a', borderRadius: 20 }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 900, color: '#1a7a4a', fontSize: 13 }}>{entry.percentage}%</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{entry.progressKm}km</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 20 }}>Progress only counts activities logged with a distance, within the challenge dates.</div>

      {isOwner && displayStatus === 'active' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 10 }}>📩 Invite Members</div>
          <InvitePicker peers={invitablePeers} selected={inviteIds} onChange={setInviteIds} />
          <button onClick={sendInvites} disabled={sendingInvites || inviteIds.length === 0} style={{ marginTop: 10, padding: '9px 18px', borderRadius: 8, background: sendingInvites || inviteIds.length === 0 ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: sendingInvites || inviteIds.length === 0 ? 'not-allowed' : 'pointer' }}>
            {sendingInvites ? 'Sending…' : 'Send Invites'}
          </button>
          {participants && participants.some(p => p.status !== 'accepted') && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Other invites</div>
              {participants.filter(p => p.status !== 'accepted').map(p => (
                <div key={p.memberId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', padding: '5px 0' }}>
                  <span>{p.memberName}</span>
                  <span style={{ fontWeight: 600, color: p.status === 'pending' ? '#f26522' : '#9ca3af' }}>{p.status === 'pending' ? 'Pending' : p.status === 'declined' ? 'Declined' : 'Left'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isPendingSelf && (
        <div>
          {isOwner ? (
            displayStatus !== 'cancelled' && <button onClick={cancelChallenge} disabled={busy} style={{ padding: '9px 18px', borderRadius: 8, background: 'white', color: '#dc2626', fontWeight: 700, fontSize: 13, border: '1px solid #fecaca', cursor: 'pointer' }}>Cancel Challenge</button>
          ) : (
            displayStatus === 'active' && myParticipant.status === 'accepted' && <button onClick={leave} disabled={busy} style={{ padding: '9px 18px', borderRadius: 8, background: 'white', color: '#dc2626', fontWeight: 700, fontSize: 13, border: '1px solid #fecaca', cursor: 'pointer' }}>Leave Challenge</button>
          )}
        </div>
      )}
    </div>
  );
}

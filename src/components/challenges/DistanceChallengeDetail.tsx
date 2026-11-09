'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Challenge, ChallengeParticipant, ChallengeLeaderboardEntry, ChallengeMemberStats, ChallengePace, CHALLENGE_CATEGORY_LABELS, CHALLENGE_PERIOD_LABELS, CHALLENGE_DESCRIPTION_MAX } from '@/types';
import { actorInit } from '@/lib/actorClient';
import PeoplePicker from '@/components/PeoplePicker';

interface Peer { id: string; name: string; avatarInitials: string; }
interface DetailResponse {
  challenge: Challenge;
  leaderboard: ChallengeLeaderboardEntry[];
  myParticipant: ChallengeParticipant | null;
  myMemberId: string;
  myProgressKm: number;
  myStats: ChallengeMemberStats;
  pace: ChallengePace;
  isOwner: boolean;
  canInvite: boolean;
  canJoin: boolean;
  canCancel: boolean;
  participants?: ChallengeParticipant[];
  displayStatus: 'active' | 'ended' | 'cancelled';
  upcoming: boolean;
  isAdmin: boolean;
  canRequestFeature: boolean;
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

export default function DistanceChallengeDetail({ id, basePath, asAdmin }: { id: string; basePath: string; asAdmin?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [featureDraft, setFeatureDraft] = useState<string | null>(null);

  function fetchData() {
    fetch(`/api/member/challenges/${id}`, actorInit(asAdmin))
      .then(async r => {
        if (!r.ok) { setNotFound(true); return; }
        setData(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, [id]);
  useEffect(() => {
    fetch('/api/member/peers', actorInit(asAdmin)).then(r => r.json()).then(d => setPeers(d.peers || [])).catch(() => {});
  }, [asAdmin]);

  async function sendInvites() {
    if (inviteIds.length === 0) return;
    setSendingInvites(true);
    try {
      const res = await fetch(`/api/member/challenges/${id}/invite`, actorInit(asAdmin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds: inviteIds }) }));
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
      const res = await fetch(`/api/member/challenges/${id}/respond`, actorInit(asAdmin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }));
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
      const res = await fetch(`/api/member/challenges/${id}/leave`, actorInit(asAdmin, { method: 'POST' }));
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to leave'); return; }
      toast.success('You left the challenge');
      router.push(basePath);
    } catch { toast.error('Connection error'); } finally { setBusy(false); }
  }

  async function join() {
    setBusy(true);
    try {
      const res = await fetch(`/api/member/challenges/${id}/join`, actorInit(asAdmin, { method: 'POST' }));
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to join'); return; }
      toast.success('Joined! 🎯 Tag your activities to this challenge when you log them');
      fetchData();
    } catch { toast.error('Connection error'); } finally { setBusy(false); }
  }

  async function cancelChallenge() {
    if (!confirm('Cancel this challenge for everyone? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/member/challenges/${id}`, actorInit(asAdmin, { method: 'DELETE' }));
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to cancel'); return; }
      toast.success('Challenge cancelled');
      fetchData();
    } catch { toast.error('Connection error'); } finally { setBusy(false); }
  }

  async function requestFeature() {
    if (!featureDraft?.trim()) { toast.error('Add a description first'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/member/challenges/${id}/feature-request`, actorInit(asAdmin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: featureDraft }) }));
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to send request'); return; }
      toast.success('Request sent! An admin will review it ⭐');
      setFeatureDraft(null);
      fetchData();
    } catch { toast.error('Connection error'); } finally { setBusy(false); }
  }

  // Admin only. Featuring past the limit asks once, then retries with an override.
  async function setFeatured(action: 'feature' | 'unfeature' | 'decline') {
    setBusy(true);
    try {
      const send = (override: boolean) => fetch(`/api/challenges/${id}/feature`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, override, ...(featureDraft !== null && { description: featureDraft }) }) });
      let res = await send(false);
      let d = await res.json();
      if (res.status === 409 && d.code === 'cap_reached') {
        if (!confirm(`${d.current} challenges are already featured (limit ${d.max}). Feature this one anyway?`)) return;
        res = await send(true); d = await res.json();
      }
      if (!res.ok) { toast.error(d.error || 'Failed to update'); return; }
      toast.success(action === 'feature' ? 'Featured on the main page ⭐' : action === 'unfeature' ? 'Removed from the main page' : 'Request declined');
      setFeatureDraft(null);
      fetchData();
    } catch { toast.error('Connection error'); } finally { setBusy(false); }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  );
  if (notFound || !data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Challenge not found, or you don&apos;t have access to it.</div>;

  const { challenge, leaderboard, myParticipant, myMemberId, myStats, pace, isOwner, canInvite, canJoin, canCancel, participants, displayStatus, upcoming, isAdmin, canRequestFeature } = data;
  const podium = displayStatus === 'ended' ? leaderboard.filter(e => e.progressKm > 0).slice(0, 3) : [];
  const invitedIds = new Set((participants || []).filter(p => p.status === 'pending' || p.status === 'accepted').map(p => p.memberId));
  const invitablePeers = peers.filter(p => !invitedIds.has(p.id) && p.id !== challenge.ownerId);
  const isPendingSelf = myParticipant?.status === 'pending';
  const isMember = myParticipant?.status === 'accepted';
  const myRank = leaderboard.find(e => e.memberId === myMemberId)?.rank;
  const statPill = (label: string, value: string | number) => (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#14532d' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );

  return (
    <div>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 900, color: '#1f2937', margin: '0 0 4px' }}>
              {challenge.title}
              {challenge.featureStatus === 'featured' && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 800, marginLeft: 8, verticalAlign: 'middle' }}>⭐ Featured</span>}
            </h2>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {CHALLENGE_CATEGORY_LABELS[challenge.category!]} · {CHALLENGE_PERIOD_LABELS[challenge.period!]} · Goal {challenge.goalKm}km · {challenge.visibility === 'open' ? '🌍 Open' : '🔒 Invite-only'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
              {fmtDateLabel(challenge.startDate!)} – {fmtDateLabel(challenge.endDate!)} · Created by {challenge.ownerName}
            </div>
          </div>
          {displayStatus === 'cancelled' && <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Cancelled</span>}
          {displayStatus === 'ended' && <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>🏁 Ended</span>}
          {displayStatus === 'active' && (upcoming
            ? <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>📅 Starts {fmtDateLabel(challenge.startDate!)}</span>
            : <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Active</span>)}
        </div>
        {challenge.description && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '12px 0 0', whiteSpace: 'pre-line' }}>{challenge.description}</p>}
      </div>

      {podium.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg,#fef9c3,#fde68a)', border: '1px solid #fcd34d', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 8 }}>🏆 Final results</div>
          {podium.map((e, i) => (
            <div key={e.memberId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#78350f' }}>
              <span>{['🥇', '🥈', '🥉'][i]} <strong>{e.memberName}</strong>{e.memberId === myMemberId ? ' (You)' : ''}</span>
              <span>{e.progressKm}km · {e.percentage}%</span>
            </div>
          ))}
        </div>
      )}

      {canRequestFeature && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          {featureDraft === null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', fontSize: 13, color: '#92400e', fontWeight: 600 }}>⭐ Want more people to join? Ask an admin to feature this challenge on the main page.</div>
              <button onClick={() => setFeatureDraft(challenge.description ?? '')} style={{ padding: '8px 16px', borderRadius: 8, background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>Request feature</button>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Description for the main page *</label>
              <textarea value={featureDraft} onChange={e => setFeatureDraft(e.target.value)} maxLength={CHALLENGE_DESCRIPTION_MAX} rows={3} placeholder="What's the challenge about, who is it for, and why should people join?" style={{ width: '100%', padding: '10px 12px', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={requestFeature} disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>{busy ? 'Sending…' : 'Send request'}</button>
                <button onClick={() => setFeatureDraft(null)} style={{ padding: '8px 16px', borderRadius: 8, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 12, border: '1px solid #e5e7eb', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {isOwner && !isAdmin && challenge.featureStatus === 'requested' && displayStatus === 'active' && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#6b7280' }}>⏳ Your request to feature this challenge is waiting for an admin.</div>
      )}

      {isAdmin && asAdmin && displayStatus === 'active' && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            ⭐ Main page · {challenge.featureStatus === 'featured' ? 'Featured' : challenge.featureStatus === 'requested' ? 'Feature requested' : 'Not featured'}
          </div>
          {challenge.featureStatus !== 'featured' && (featureDraft !== null || !challenge.description) && (
            <textarea value={featureDraft ?? ''} onChange={e => setFeatureDraft(e.target.value)} maxLength={CHALLENGE_DESCRIPTION_MAX} rows={3} placeholder="Description shown on the main page and in the chatbot (required to feature)" style={{ width: '100%', padding: '10px 12px', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', outline: 'none', marginBottom: 8 }} />
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {challenge.featureStatus === 'featured' ? (
              <button onClick={() => setFeatured('unfeature')} disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, background: 'white', color: '#92400e', fontWeight: 700, fontSize: 12, border: '1px solid #fcd34d', cursor: 'pointer' }}>Remove from main page</button>
            ) : (<>
              <button onClick={() => setFeatured('feature')} disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>⭐ Feature on main page</button>
              {challenge.description && featureDraft === null && <button onClick={() => setFeatureDraft(challenge.description ?? '')} style={{ padding: '8px 16px', borderRadius: 8, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 12, border: '1px solid #e5e7eb', cursor: 'pointer' }}>Edit description</button>}
              {challenge.featureStatus === 'requested' && <button onClick={() => setFeatured('decline')} disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, background: 'white', color: '#dc2626', fontWeight: 600, fontSize: 12, border: '1px solid #fecaca', cursor: 'pointer' }}>Decline request</button>}
            </>)}
          </div>
          {challenge.visibility !== 'open' && challenge.featureStatus !== 'featured' && <div style={{ fontSize: 11, color: '#92400e', marginTop: 8 }}>Featuring makes this challenge open so anyone can join.</div>}
        </div>
      )}

      {isPendingSelf ? (
        <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#4c1d95', fontWeight: 600, marginBottom: 10 }}>{myParticipant!.invitedByName} invited you to this challenge — join in?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => respond('accept')} disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, background: '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>✓ Accept</button>
            <button onClick={() => respond('decline')} disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 13, border: '1px solid #e5e7eb', cursor: 'pointer' }}>Decline</button>
          </div>
        </div>
      ) : canJoin ? (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', fontSize: 13, color: '#9a3412', fontWeight: 600 }}>This challenge is open — join and start tagging your {challenge.category === 'cycling' ? 'rides' : 'runs, walks and hikes'} to it.</div>
          <button onClick={join} disabled={busy} style={{ padding: '9px 20px', borderRadius: 8, background: '#f26522', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>{busy ? 'Joining…' : '+ Join Challenge'}</button>
        </div>
      ) : isMember ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Your Standing{myRank && !upcoming ? ` — Rank #${myRank}` : ''}</div>
          {upcoming && <div style={{ fontSize: 13, color: '#166534', marginBottom: 8 }}>📅 You&apos;re in! It starts on <strong>{fmtDateLabel(challenge.startDate!)}</strong>. Activities from that day on can be tagged to it.</div>}
          <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 20, height: 10, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${pace.percentage}%`, height: '100%', background: '#16a34a', borderRadius: 20, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#14532d' }}>{myStats.km}km <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>/ {challenge.goalKm}km — {pace.percentage}%</span></span>
            {displayStatus === 'active' && !upcoming && (pace.onPace
              ? <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✅ On pace</span>
              : <span style={{ fontSize: 12, fontWeight: 700, color: '#9a3412' }}>⏳ Behind pace ({pace.expectedKm}km expected)</span>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {statPill('Points', myStats.points)}
            {statPill('Activities', myStats.activityCount)}
            {statPill('Group', myStats.groupActivityCount)}
          </div>
        </div>
      ) : null}

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>🏆 Challenge Leaderboard</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Ranked by distance</span>
        </div>
        {leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13 }}>🏁 No participants yet</div>
        ) : leaderboard.map(entry => {
          const isMe = entry.memberId === myMemberId;
          return (
            <div key={entry.memberId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #fafafa', background: isMe ? '#f0fdf4' : 'white' }}>
              <span style={{ width: 22, fontWeight: 900, color: entry.rank === 1 ? '#f59e0b' : '#9ca3af', fontSize: 14, flexShrink: 0 }}>{entry.rank === 1 && entry.progressKm > 0 ? '👑' : `#${entry.rank}`}</span>
              <Avatar name={entry.memberName} size={32} bg={isMe ? '#1a7a4a' : '#6b7280'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{entry.memberName}{isMe ? ' (You)' : ''}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                  {entry.points} pts · {entry.activityCount} activit{entry.activityCount === 1 ? 'y' : 'ies'}{entry.groupActivityCount > 0 ? ` · 🤝 ${entry.groupActivityCount} group` : ''}
                </div>
                <div style={{ background: '#f3f4f6', borderRadius: 20, height: 6, overflow: 'hidden', marginTop: 4, maxWidth: 160 }}>
                  <div style={{ width: `${entry.percentage}%`, height: '100%', background: '#1a7a4a', borderRadius: 20 }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 900, color: '#1a7a4a', fontSize: 15 }}>{entry.progressKm}km</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{entry.percentage}% of goal</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 20 }}>
        {challenge.taggedOnly
          ? 'Only activities with a distance, tagged to this challenge when logged, count. Group activities earn everyone +1 point and count for every tagged teammate who has joined.'
          : 'Progress counts activities logged with a distance, within the challenge dates.'}
      </div>

      {canInvite && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 10 }}>📩 Invite People</div>
          <PeoplePicker people={invitablePeers} selected={inviteIds} onChange={setInviteIds} placeholder="Search people to invite…" emptyText="Everyone's already in or invited" />
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isOwner && displayStatus === 'active' && isMember && <button onClick={leave} disabled={busy} style={{ padding: '9px 18px', borderRadius: 8, background: 'white', color: '#dc2626', fontWeight: 700, fontSize: 13, border: '1px solid #fecaca', cursor: 'pointer' }}>Leave Challenge</button>}
          {canCancel && displayStatus !== 'cancelled' && <button onClick={cancelChallenge} disabled={busy} style={{ padding: '9px 18px', borderRadius: 8, background: 'white', color: '#dc2626', fontWeight: 700, fontSize: 13, border: '1px solid #fecaca', cursor: 'pointer' }}>Cancel Challenge</button>}
        </div>
      )}
    </div>
  );
}

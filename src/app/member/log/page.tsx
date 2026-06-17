'use client';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { ActivityLog, ActivityType, ACTIVITY_LABELS, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS } from '@/types';

const MAX_PER_DAY = 2;
const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };

function todayUTC(): string { return new Date().toISOString().slice(0, 10); }
function shiftDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtDateLabel(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function activityMeta(a: ActivityLog): string {
  return [a.distance != null ? `${a.distance}km` : null, a.duration != null ? `${a.duration}min` : null, a.steps != null ? `${a.steps.toLocaleString()} steps` : null, a.notes || null].filter(Boolean).join(' · ');
}
function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface Peer { id: string; name: string; avatarInitials: string; }

// ─── Avatar bubble ───────────────────────────────────────────────────────────
function Avatar({ name, size = 28, bg = '#1a7a4a' }: { name: string; size?: number; bg?: string }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: bg, color: 'white', fontSize: size * 0.38, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid white' }}>
      {initials(name)}
    </span>
  );
}

// ─── TeamMemberSelector (for the log form) ───────────────────────────────────
function TeamMemberSelector({ peers, selected, onChange, excludeIds = [] }: { peers: Peer[]; selected: string[]; onChange: (ids: string[]) => void; excludeIds?: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);
  const available = peers.filter(p => !excludeIds.includes(p.id));
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
        <span>{selected.length ? `${selected.length} teammate${selected.length !== 1 ? 's' : ''} selected` : 'Select teammates…'}</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
          {available.length === 0 ? (
            <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>No other members available</div>
          ) : available.map(p => {
            const checked = selected.includes(p.id);
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: checked ? '#f0fdf4' : 'white', borderBottom: '1px solid #fafafa', transition: 'background 0.1s' }}>
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

// ─── Points preview ───────────────────────────────────────────────────────────
function PointsPreview({ basePoints, teamCount }: { basePoints: number; teamCount: number }) {
  const hasTeam = teamCount > 0;
  const totalPoints = hasTeam ? basePoints + 1 : basePoints;
  if (!hasTeam) return (
    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534', border: '1px solid #bbf7d0' }}>
      This awards <strong>{basePoints} point{basePoints !== 1 ? 's' : ''}</strong> toward your total 🏅
    </div>
  );
  return (
    <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '2px solid #4ade80' }}>
      <div style={{ background: 'linear-gradient(90deg, #16a34a, #1a7a4a)', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🤝</span>
        <span style={{ fontWeight: 800, fontSize: 13, color: 'white', letterSpacing: '0.02em' }}>TEAM SPIRIT ACTIVATED</span>
        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.25)', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>+1 BONUS</span>
      </div>
      <div style={{ background: '#f0fdf4', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'line-through' }}>{basePoints} pt{basePoints !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>→</span>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#14532d', lineHeight: 1 }}>{totalPoints}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>pts each</span>
          <span style={{ marginLeft: 'auto', fontSize: 18 }}>🏅</span>
        </div>
        <div style={{ fontSize: 12, color: '#166534', fontWeight: 500 }}>
          {teamCount + 1} people moving together — everyone earns <strong>{totalPoints} pts</strong>!
        </div>
      </div>
    </div>
  );
}

// ─── Participant popover (click-to-expand) ────────────────────────────────────
interface OriginalActivity { memberName: string; teamMembers?: { id: string; name: string }[] }

function ParticipantPanel({ activity, currentMemberId }: { activity: ActivityLog; currentMemberId: string }) {
  const [original, setOriginal] = useState<OriginalActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const toggle = useCallback(async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (!original && activity.teamActivityId && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/member/activities/${activity.teamActivityId}`);
        if (res.ok) { const data = await res.json(); setOriginal(data.activity); }
      } catch { /* silent */ } finally { setLoading(false); }
    }
  }, [open, original, activity.teamActivityId, loading]);

  // People to show: owner + other teammates (exclude current viewer)
  const owner = activity.teamActivityOwner;
  const others = original?.teamMembers?.filter(m => m.id !== currentMemberId && m.id !== owner?.id) ?? [];

  return (
    <div>
      <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
        {/* Avatar stack preview */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {owner && <Avatar name={owner.name} size={22} bg="#7c3aed" />}
          {(original?.teamMembers ?? []).filter(m => m.id !== currentMemberId && m.id !== owner?.id).slice(0, 2).map(m => (
            <span key={m.id} style={{ marginLeft: -6 }}><Avatar name={m.name} size={22} bg="#6d28d9" /></span>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>{open ? 'Hide' : 'Who was there?'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '10px 14px' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading participants…</div>
          ) : (
            <>
              {owner && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: others.length > 0 ? 8 : 0 }}>
                  <Avatar name={owner.name} size={28} bg="#7c3aed" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#4c1d95' }}>{owner.name}</div>
                    <div style={{ fontSize: 10, color: '#8b5cf6' }}>Organized this activity</div>
                  </div>
                </div>
              )}
              {others.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Also there</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {others.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={m.name} size={26} bg="#6d28d9" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#4c1d95' }}>{m.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {!owner && others.length === 0 && (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>No participant info available.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Edit team panel ──────────────────────────────────────────────────────────
function EditTeamPanel({ activity, peers, onSaved, onCancel }: { activity: ActivityLog; peers: Peer[]; onSaved: (updated: ActivityLog) => void; onCancel: () => void }) {
  const existingIds = (activity.teamMembers ?? []).map(m => m.id);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const available = peers.filter(p => !existingIds.includes(p.id));

  async function handleSave() {
    if (addIds.length === 0) { setError('Pick at least one new teammate'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/member/activities/${activity.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addMemberIds: addIds }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update'); return; }
      const names = data.addedNames.map((n: string) => n.split(' ')[0]).join(', ');
      setSavedMsg(`Added! ${names} ${data.addedCount === 1 ? 'is' : 'are'} now getting their points 🤝`);
      onSaved(data.activity);
      setAddIds([]);
    } catch { setError('Connection error'); } finally { setSaving(false); }
  }

  if (savedMsg) return (
    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#166534', fontWeight: 500 }}>
      ✓ {savedMsg}
      {available.length > (activity.teamMembers ?? []).length ? (
        <button onClick={() => setSavedMsg('')} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'underline' }}>Add more</button>
      ) : null}
    </div>
  );

  return (
    <div style={{ background: '#f8fffe', border: '1px dashed #86efac', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
        Add teammates to this activity
        {existingIds.length > 0 && <span style={{ fontWeight: 400, color: '#9ca3af' }}> (already tagged: {(activity.teamMembers ?? []).map(m => m.name.split(' ')[0]).join(', ')})</span>}
      </div>
      {available.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9ca3af' }}>All active members are already tagged.</div>
      ) : (
        <>
          <TeamMemberSelector peers={available} selected={addIds} onChange={setAddIds} />
          {addIds.length > 0 && (
            <div style={{ fontSize: 12, color: '#166534', background: '#f0fdf4', borderRadius: 8, padding: '7px 12px', marginTop: 8, fontWeight: 500 }}>
              🤝 {addIds.length} teammate{addIds.length !== 1 ? 's' : ''} will get <strong>{ACTIVITY_POINTS[activity.category] + 1} pts</strong> each
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleSave} disabled={saving || addIds.length === 0} style={{ padding: '8px 18px', borderRadius: 8, background: saving || addIds.length === 0 ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: saving || addIds.length === 0 ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onCancel} style={{ padding: '8px 14px', borderRadius: 8, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 13, border: '1px solid #e5e7eb', cursor: 'pointer' }}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MemberLogPage() {
  const today = useMemo(() => todayUTC(), []);
  const dateOptions = useMemo(() => [
    { date: today, label: 'Today' },
    { date: shiftDays(today, -1), label: 'Yesterday' },
    { date: shiftDays(today, -2), label: '2 days ago' },
  ], [today]);

  const [allActivities, setAllActivities] = useState<ActivityLog[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ activityType: 'run' as ActivityType, notes: '', distance: '', duration: '', steps: '' });
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [expandedEditId, setExpandedEditId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/member/activities')
      .then(r => r.json())
      .then(d => {
        setAllActivities(d.activities || []);
        // Detect own member ID from a self-logged activity
        const own = (d.activities || []).find((a: ActivityLog) => !a.isTeamActivity);
        if (own) setCurrentMemberId(own.memberId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch('/api/member/peers')
      .then(r => r.json())
      .then(d => setPeers(d.peers || []))
      .catch(() => {});
  }, []);

  const dateActivities = allActivities.filter(a => a.date === selectedDate);
  const ownOnDate = dateActivities.filter(a => !a.isTeamActivity);
  const teamOnDate = dateActivities.filter(a => a.isTeamActivity);
  const remaining = MAX_PER_DAY - ownOnDate.length;

  // Group activity stats (all time)
  const totalGroupActivities = allActivities.filter(a => a.isTeamActivity || (a.teamMembers && a.teamMembers.length > 0)).length;

  async function handleLog(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSuccess(''); setSaving(true);
    try {
      const body = {
        activityType: form.activityType, notes: form.notes, date: selectedDate,
        ...(form.distance ? { distance: parseFloat(form.distance) } : {}),
        ...(form.duration ? { duration: parseInt(form.duration) } : {}),
        ...(form.steps ? { steps: parseInt(form.steps) } : {}),
        ...(teamMemberIds.length > 0 ? { teamMemberIds } : {}),
      };
      const res = await fetch('/api/member/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to log activity'); toast.error(data.error || 'Failed to log activity'); return; }
      const { activity } = data;
      const teamCount = activity.teamMembers?.length ?? 0;
      let msg = `Logged! +${activity.points} point${activity.points !== 1 ? 's' : ''} 🎉`;
      if (teamCount > 0) {
        const names = activity.teamMembers!.map((m: { name: string }) => m.name.split(' ')[0]).join(', ');
        msg += ` ${names} also got their points! 🤝`;
      }
      toast.success(msg);
      setSuccess(msg);
      setForm({ activityType: 'run', notes: '', distance: '', duration: '', steps: '' });
      setTeamMemberIds([]);
      setAllActivities(prev => [activity, ...prev]);
    } catch { setError('Connection error'); } finally { setSaving(false); }
  }

  const basePoints = ACTIVITY_POINTS[ACTIVITY_CATEGORY_MAP[form.activityType]];
  const isToday = selectedDate === today;

  return (
    <div>
      {/* Header + group counter */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', margin: '0 0 4px' }}>Log an Activity</h2>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Log for today or catch up on the last 2 days</p>
        </div>
        {totalGroupActivities > 0 && (
          <div style={{ flexShrink: 0, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 20, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 14 }}>🤝</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{totalGroupActivities}</span>
            <span style={{ fontSize: 11, color: '#8b5cf6' }}>group</span>
          </div>
        )}
      </div>

      {/* Date selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {dateOptions.map(opt => {
          const ownCount = allActivities.filter(a => a.date === opt.date && !a.isTeamActivity).length;
          const full = ownCount >= MAX_PER_DAY;
          const active = selectedDate === opt.date;
          return (
            <button key={opt.date} onClick={() => { setSelectedDate(opt.date); setError(''); setSuccess(''); setExpandedEditId(null); }} style={{ flex: 1, padding: '10px 8px', borderRadius: 12, border: `2px solid ${active ? '#1a7a4a' : '#e5e7eb'}`, background: active ? '#f0fdf4' : 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: active ? '#145c38' : '#374151' }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: active ? '#166534' : '#9ca3af', marginTop: 2 }}>{fmtDateLabel(opt.date)}</div>
              {full && <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginTop: 3 }}>✓ Full</div>}
              {!full && ownCount > 0 && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>{ownCount}/{MAX_PER_DAY} logged</div>}
            </button>
          );
        })}
      </div>

      {/* Slot indicators (own activities only) */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {Array.from({ length: MAX_PER_DAY }).map((_, i) => {
          const filled = i < ownOnDate.length;
          return (
            <div key={i} style={{ flex: 1, background: filled ? '#1a7a4a' : '#f3f4f6', borderRadius: 10, padding: '12px 16px', textAlign: 'center', transition: 'all 0.3s' }}>
              <div style={{ fontSize: 22 }}>{filled ? '✅' : '⬜'}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: filled ? 'white' : '#9ca3af', marginTop: 4 }}>Activity {i + 1}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      ) : remaining > 0 ? (
        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: '#374151', margin: '0 0 16px' }}>
            {remaining === MAX_PER_DAY ? 'Log an activity' : 'Log one more'} for {isToday ? 'today' : fmtDateLabel(selectedDate)} ({remaining} slot{remaining !== 1 ? 's' : ''} left)
          </h3>
          <form onSubmit={handleLog}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Activity Type *</label>
              <select value={form.activityType} onChange={e => setForm({ ...form, activityType: e.target.value as ActivityType })} style={inp}>
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Distance — km <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input type="number" min="0" step="0.1" value={form.distance} onChange={e => setForm({ ...form, distance: e.target.value })} placeholder="e.g. 5.2" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Duration — min <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input type="number" min="1" step="1" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 32" style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Steps <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional — use if your app counts steps)</span></label>
              <input type="number" min="0" step="1" value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })} placeholder="e.g. 8000" style={inp} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. ran with the team, morning session…" style={inp} />
            </div>
            {peers.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Who was with you? <span style={{ color: '#9ca3af', fontWeight: 400 }}>(tag teammates for a team spirit bonus)</span>
                </label>
                <TeamMemberSelector peers={peers} selected={teamMemberIds} onChange={setTeamMemberIds} />
              </div>
            )}
            <PointsPreview basePoints={basePoints} teamCount={teamMemberIds.length} />
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{success}</div>}
            <button type="submit" disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, background: saving ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Logging…' : 'Log Activity'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 16, padding: 28, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <h3 style={{ fontWeight: 900, color: '#145c38', fontSize: 18, margin: '0 0 4px' }}>
            {isToday ? 'All done for today!' : `${fmtDateLabel(selectedDate)} is fully logged!`}
          </h3>
          <p style={{ color: '#166534', fontSize: 14, margin: 0 }}>
            {isToday ? `You've logged your ${MAX_PER_DAY} activities for today. Come back tomorrow!` : `Both activities have been logged for this day.`}
          </p>
        </div>
      )}

      {/* Own activities for this date */}
      {ownOnDate.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: 14, color: '#374151' }}>
            {isToday ? 'Today' : fmtDateLabel(selectedDate)}&apos;s Activities
          </div>
          {ownOnDate.map(a => {
            const meta = activityMeta(a);
            const withNames = a.teamMembers?.map(m => m.name.split(' ')[0]).join(', ');
            const isEditing = expandedEditId === a.id;
            return (
              <div key={a.id} style={{ borderBottom: '1px solid #fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 20px' }}>
                  <span style={{ fontSize: 22, marginTop: 1 }}>{ACTIVITY_LABELS[a.activityType]?.split(' ')[0] || '✨'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{ACTIVITY_LABELS[a.activityType]}</div>
                    {meta && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{meta}</div>}
                    {withNames && (
                      <div style={{ fontSize: 12, color: '#059669', marginTop: 3, fontWeight: 500 }}>🤝 with {withNames}</div>
                    )}
                    {peers.length > 0 && (
                      <button onClick={() => setExpandedEditId(isEditing ? null : a.id)} style={{ marginTop: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: isEditing ? '#9ca3af' : '#16a34a', fontWeight: 600, padding: 0 }}>
                        {isEditing ? '↑ Close' : '+ Add teammates'}
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontWeight: 900, color: '#1a7a4a', fontSize: 14 }}>+{a.points} pt{a.points !== 1 ? 's' : ''}</span>
                    {withNames && <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>team spirit</div>}
                  </div>
                </div>
                {isEditing && (
                  <div style={{ paddingLeft: 56, paddingRight: 20, paddingBottom: 14 }}>
                    <EditTeamPanel activity={a} peers={peers} onSaved={updated => { setAllActivities(prev => prev.map(x => x.id === updated.id ? updated : x)); }} onCancel={() => setExpandedEditId(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Team activities for this date */}
      {teamOnDate.length > 0 && (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #ddd6fe' }}>
          <div style={{ background: 'linear-gradient(90deg, #7c3aed, #6d28d9)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🤝</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>Group Activities</span>
            <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{teamOnDate.length}</span>
          </div>
          {teamOnDate.map(a => {
            const meta = activityMeta(a);
            const ownerName = a.teamActivityOwner?.name ?? 'Someone';
            const ownerFirst = ownerName.split(' ')[0];
            return (
              <div key={a.id} style={{ background: '#faf5ff', borderBottom: '1px solid #ede9fe', padding: '13px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Activity icon with purple tint */}
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {ACTIVITY_LABELS[a.activityType]?.split(' ')[0] || '✨'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#4c1d95' }}>{ACTIVITY_LABELS[a.activityType]}</span>
                      <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>GROUP</span>
                    </div>
                    {meta && <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 3, opacity: 0.8 }}>{meta}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {a.teamActivityOwner && <Avatar name={a.teamActivityOwner.name} size={20} bg="#7c3aed" />}
                      <span style={{ fontSize: 12, color: '#6d28d9', fontWeight: 500 }}>Added by <strong>{ownerFirst}</strong></span>
                    </div>
                    <ParticipantPanel activity={a} currentMemberId={currentMemberId} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontWeight: 900, color: '#7c3aed', fontSize: 14 }}>+{a.points} pt{a.points !== 1 ? 's' : ''}</span>
                    <div style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 700, marginTop: 2 }}>team spirit</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

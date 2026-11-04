'use client';
import { useEffect, useRef, useState } from 'react';
import { ActivityType, ChallengeCategory, CHALLENGE_CATEGORY_ACTIVITY_TYPES } from '@/types';
import { actorInit } from '@/lib/actorClient';

interface LoggableChallenge { id: string; title: string; category: ChallengeCategory; goalKm: number; endDate: string; }

// "Is this for a challenge?" toggle plus a dropdown of the logger's active challenges on that date.
// Only challenges whose category fits the activity type can be picked; selections that stop fitting
// (activity type changed, date changed) are dropped automatically.
export default function ChallengeTagPicker({ date, memberId, asAdmin, activityType, hasDistance, selected, onChange, label = 'Is this for a challenge?' }: {
  date: string; memberId?: string; asAdmin?: boolean; activityType: ActivityType; hasDistance: boolean;
  selected: string[]; onChange: (ids: string[]) => void; label?: string;
}) {
  const [fetched, setFetched] = useState<LoggableChallenge[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (asAdmin && !memberId) return;
    const qs = new URLSearchParams({ date, ...(memberId ? { memberId } : {}) });
    fetch(`/api/member/challenges/loggable?${qs}`, actorInit(asAdmin))
      .then(r => r.json()).then(d => setFetched(d.challenges || [])).catch(() => setFetched([]));
  }, [date, memberId, asAdmin]);
  const challenges = asAdmin && !memberId ? [] : fetched;

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fitting = challenges.filter(c => CHALLENGE_CATEGORY_ACTIVITY_TYPES[c.category].includes(activityType));
  const fittingKey = fitting.map(c => c.id).join(',');

  useEffect(() => {
    const keep = selected.filter(id => fittingKey.split(',').includes(id));
    if (keep.length !== selected.length) onChange(keep);
  }, [fittingKey, selected, onChange]);

  if (challenges.length === 0) return null;

  function toggle(id: string) { onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]); }
  function setMode(on: boolean) { setEnabled(on); if (!on) onChange([]); else if (fitting.length === 1) onChange([fitting[0].id]); }

  const segBtn = (active: boolean) => ({ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${active ? '#f26522' : '#e5e7eb'}`, background: active ? '#fff7ed' : 'white', color: active ? '#c2410c' : '#6b7280', fontWeight: 700, fontSize: 12, cursor: 'pointer' as const });
  const selectedTitles = fitting.filter(c => selected.includes(c.id)).map(c => c.title);

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>🏁 {label}</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: enabled ? 8 : 0 }}>
        <button type="button" onClick={() => setMode(false)} style={segBtn(!enabled)}>No, just a normal log</button>
        <button type="button" onClick={() => setMode(true)} style={segBtn(enabled)}>Yes, count it 🎯</button>
      </div>
      {enabled && (fitting.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9a3412', background: '#fff7ed', borderRadius: 8, padding: '8px 12px' }}>
          None of your active challenges count this activity type — distance challenges take runs, walks and hikes, or cycling.
        </div>
      ) : (
        <div ref={ref} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '10px 14px', border: '1px solid #fed7aa', borderRadius: 10, background: 'white', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: selected.length ? '#1f2937' : '#9ca3af', boxSizing: 'border-box' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTitles.length ? selectedTitles.join(', ') : 'Pick a challenge…'}</span>
            <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
          </button>
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
              {fitting.map(c => {
                const checked = selected.includes(c.id);
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: checked ? '#fff7ed' : 'white', borderBottom: '1px solid #fafafa' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} style={{ accentColor: '#f26522', width: 15, height: 15 }} />
                    <span style={{ fontSize: 16 }}>{c.category === 'cycling' ? '🚴' : '🏃'}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{c.title}</span>
                      <span style={{ display: 'block', fontSize: 11, color: '#9ca3af' }}>Goal {c.goalKm}km · ends {new Date(c.endDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {selected.length > 0 && !hasDistance && (
            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>Add a distance (km) above — challenges rank on distance.</div>
          )}
          {selected.length > 0 && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Tagged teammates who are also in the challenge get it counted for them too.</div>
          )}
        </div>
      ))}
    </div>
  );
}

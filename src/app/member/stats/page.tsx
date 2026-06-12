'use client';
import { useEffect, useState } from 'react';
import { ActivityLog, ActivityType, ACTIVITY_LABELS } from '@/types';

type Period = 'today' | 'week' | 'month' | 'custom' | 'all';
type Range = { start: string; end: string };

const asUTC = (d: string) => new Date(d + 'T12:00:00Z');
const todayUTC = () => new Date().toISOString().slice(0, 10);

function weekStart(date: string): string {
  const d = asUTC(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
function shiftDays(date: string, n: number): string {
  const d = asUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function monthStart(date: string): string { return date.slice(0, 7) + '-01'; }
function fmtShort(date: string): string {
  return asUTC(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function getRange(period: Period, today: string, cs: string, ce: string): Range | null {
  if (period === 'today') return { start: today, end: today };
  if (period === 'week') return { start: weekStart(today), end: today };
  if (period === 'month') return { start: monthStart(today), end: today };
  if (period === 'custom' && cs && ce) {
    const [s, e] = cs <= ce ? [cs, ce] : [ce, cs];
    return { start: s, end: e };
  }
  return null;
}

function getPrev(period: Period, today: string): Range | null {
  if (period === 'today') { const y = shiftDays(today, -1); return { start: y, end: y }; }
  if (period === 'week') {
    const ws = weekStart(today);
    const prevEnd = shiftDays(ws, -1);
    return { start: weekStart(prevEnd), end: prevEnd };
  }
  if (period === 'month') {
    const ms = monthStart(today);
    const prevEnd = shiftDays(ms, -1);
    return { start: monthStart(prevEnd), end: prevEnd };
  }
  return null;
}

function filterActs(acts: ActivityLog[], range: Range | null): ActivityLog[] {
  if (!range) return acts;
  return acts.filter(a => a.date >= range.start && a.date <= range.end);
}

interface Stats { count: number; points: number; distance: number | null; duration: number | null; }

function computeStats(acts: ActivityLog[]): Stats {
  return {
    count: acts.length,
    points: acts.reduce((s, a) => s + a.points, 0),
    distance: acts.some(a => a.distance != null) ? acts.reduce((s, a) => s + (a.distance ?? 0), 0) : null,
    duration: acts.some(a => a.duration != null) ? acts.reduce((s, a) => s + (a.duration ?? 0), 0) : null,
  };
}

interface Breakdown { type: ActivityType; label: string; count: number; distance: number | null; duration: number | null; points: number; }

function computeBreakdown(acts: ActivityLog[]): Breakdown[] {
  const map = new Map<ActivityType, Breakdown>();
  for (const a of acts) {
    const b = map.get(a.activityType);
    if (b) {
      b.count++; b.points += a.points;
      if (a.distance != null) b.distance = (b.distance ?? 0) + a.distance;
      if (a.duration != null) b.duration = (b.duration ?? 0) + a.duration;
    } else {
      map.set(a.activityType, { type: a.activityType, label: ACTIVITY_LABELS[a.activityType] ?? a.activityType, count: 1, distance: a.distance ?? null, duration: a.duration ?? null, points: a.points });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function StatDelta({ curr, prev, unit, precision = 0 }: { curr: number | null; prev: number; unit: string; precision?: number }) {
  if (curr === null) return null;
  const diff = curr - prev;
  const color = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#6b7280';
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  return (
    <span style={{ color, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
      {arrow} {diff >= 0 ? '+' : ''}{diff.toFixed(precision)}{unit}
    </span>
  );
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
  { key: 'all', label: 'All Time' },
];

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function StatsPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const today = todayUTC();

  useEffect(() => {
    fetch('/api/member/activities')
      .then(r => r.json())
      .then(d => setActivities(d.activities || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isCustomIncomplete = period === 'custom' && (!customStart || !customEnd);
  const range = getRange(period, today, customStart, customEnd);
  const prevRange = getPrev(period, today);
  const periodActs = isCustomIncomplete ? [] : filterActs(activities, range);
  const prevActs = filterActs(activities, prevRange);
  const curr = computeStats(periodActs);
  const prev = computeStats(prevActs);
  const bd = computeBreakdown(periodActs);

  const ws = weekStart(today);
  const weekDots = period === 'week' ? (() => {
    const activeDays = new Set(periodActs.map(a => a.date));
    return Array.from({ length: 7 }, (_, i) => {
      const d = shiftDays(ws, i);
      return { date: d, active: activeDays.has(d), future: d > today };
    });
  })() : null;

  const prevLabel = period === 'today' ? 'yesterday' : period === 'week' ? 'last week' : period === 'month' ? 'last month' : null;

  let rangeLabel = 'All time';
  if (isCustomIncomplete) rangeLabel = 'Select a date range';
  else if (range) {
    if (period === 'today') rangeLabel = fmtShort(today);
    else if (period === 'month') rangeLabel = asUTC(today).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    else rangeLabel = `${fmtShort(range.start)} – ${fmtShort(range.end)}`;
  }

  const dateInp = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', margin: '0 0 4px' }}>My Progress</h2>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{rangeLabel}</p>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: period === 'custom' ? 12 : 16, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${period === p.key ? '#1a7a4a' : '#e5e7eb'}`, background: period === p.key ? '#1a7a4a' : 'white', color: period === p.key ? 'white' : '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>FROM</label>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} max={today} style={dateInp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>TO</label>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} max={today} style={dateInp} />
          </div>
        </div>
      )}

      {isCustomIncomplete ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: 14 }}>
          Pick a start and end date to see your stats.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
            <StatCard value={String(curr.count)} label="Activities" />
            <StatCard value={String(curr.points)} label="Points earned" />
            {curr.distance !== null && <StatCard value={curr.distance.toFixed(1)} unit="km" label="Distance" />}
            {curr.duration !== null && <StatCard value={fmtDuration(curr.duration)} label="Time active" />}
          </div>

          {/* Week dots */}
          {weekDots && (
            <div style={{ background: 'white', borderRadius: 14, padding: '14px 20px', border: '1px solid #f3f4f6', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Week at a glance</div>
              <div style={{ display: 'flex', gap: 0 }}>
                {weekDots.map((dot, i) => (
                  <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 5, fontWeight: 600 }}>{WEEK_DAYS[i]}</div>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: dot.active ? '#1a7a4a' : 'transparent', border: dot.future ? '1.5px dashed #d1d5db' : dot.active ? 'none' : '1.5px solid #e5e7eb', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'white', fontWeight: 700 }}>
                      {dot.active ? '✓' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison */}
          {prevLabel && (curr.count > 0 || prev.count > 0) && (
            <div style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 16px', border: '1px solid #e2e8f0', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>vs {prevLabel}:</span>
              <StatDelta curr={curr.count} prev={prev.count} unit=" activities" />
              <StatDelta curr={curr.points} prev={prev.points} unit=" pts" />
              {curr.distance !== null && <StatDelta curr={curr.distance} prev={prev.distance ?? 0} unit="km" precision={1} />}
              {curr.duration !== null && <StatDelta curr={curr.duration} prev={prev.duration ?? 0} unit="m" />}
            </div>
          )}

          {/* Activity breakdown */}
          {bd.length > 0 && (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: 13, color: '#374151' }}>
                Activity Breakdown
              </div>
              {bd.map(b => {
                const emoji = b.label.split(' ')[0];
                const name = b.label.slice(b.label.indexOf(' ') + 1);
                const sub = [
                  `${b.count} session${b.count !== 1 ? 's' : ''}`,
                  b.distance != null ? `${b.distance.toFixed(1)}km` : null,
                  b.duration != null ? fmtDuration(b.duration) : null,
                ].filter(Boolean).join(' · ');
                return (
                  <div key={b.type} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid #fafafa' }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#1a7a4a', fontSize: 13, flexShrink: 0 }}>{b.points} pt{b.points !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Activity history */}
          {periodActs.length > 0 ? (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: 13, color: '#374151' }}>
                Activity History
              </div>
              {[...periodActs].sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)).map(a => {
                const sub = [
                  fmtShort(a.date),
                  a.distance != null ? `${a.distance}km` : null,
                  a.duration != null ? fmtDuration(a.duration) : null,
                  a.notes || null,
                ].filter(Boolean).join(' · ');
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid #fafafa' }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{ACTIVITY_LABELS[a.activityType]?.split(' ')[0] || '✨'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>{ACTIVITY_LABELS[a.activityType]}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#1a7a4a', fontSize: 13, flexShrink: 0 }}>+{a.points}pt{a.points !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#9ca3af', fontSize: 14 }}>
              No activities{period === 'today' ? ' today' : period === 'week' ? ' this week' : period === 'month' ? ' this month' : ' in this period'}.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ value, label, unit }: { value: string; label: string; unit?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '16px 18px', border: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#1f2937', lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginLeft: 3 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

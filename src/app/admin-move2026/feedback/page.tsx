'use client';
import { useEffect, useState } from 'react';
import { Feedback, FeedbackCategory, FeedbackStatus, FEEDBACK_CATEGORY_LABELS, FEEDBACK_STATUS_CONFIG } from '@/types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_ORDER: FeedbackStatus[] = ['pending', 'acknowledged', 'in_progress', 'done'];
const FILTER_LABELS: { key: FeedbackStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: '🕐 Pending' },
  { key: 'acknowledged', label: '👀 Acknowledged' },
  { key: 'in_progress', label: '🔨 In Progress' },
  { key: 'done', label: '✅ Done' },
];

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');
  const [editing, setEditing] = useState<Record<string, { status: FeedbackStatus; comment: string; saving: boolean }>>({});

  useEffect(() => {
    fetch('/api/feedback').then(r => r.json()).then(d => setFeedbacks(d.feedbacks || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function initEdit(fb: Feedback) {
    setEditing(prev => ({ ...prev, [fb.id]: { status: fb.status, comment: fb.adminComment || '', saving: false } }));
  }

  async function handleUpdate(fb: Feedback) {
    const ed = editing[fb.id]; if (!ed) return;
    setEditing(prev => ({ ...prev, [fb.id]: { ...ed, saving: true } }));
    try {
      const res = await fetch(`/api/feedback/${fb.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: ed.status, adminComment: ed.comment }) });
      const data = await res.json();
      if (res.ok) {
        setFeedbacks(prev => prev.map(f => f.id === fb.id ? data.feedback : f));
        setEditing(prev => { const next = { ...prev }; delete next[fb.id]; return next; });
      }
    } catch { /* silent */ } finally {
      setEditing(prev => prev[fb.id] ? { ...prev, [fb.id]: { ...prev[fb.id], saving: false } } : prev);
    }
  }

  const displayed = filter === 'all' ? feedbacks : feedbacks.filter(f => f.status === filter);
  const pendingCount = feedbacks.filter(f => f.status === 'pending').length;

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1f2937', margin: 0 }}>📬 Feedback Inbox</h1>
          {pendingCount > 0 && (
            <span style={{ background: '#f26522', color: 'white', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>{pendingCount} pending</span>
          )}
        </div>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Notes sent to Rhino 🦏 · Reply and update status so members can track their submissions</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTER_LABELS.map(({ key, label }) => {
          const count = key === 'all' ? feedbacks.length : feedbacks.filter(f => f.status === key).length;
          return (
            <button key={key} onClick={() => setFilter(key)} style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${filter === key ? '#1a7a4a' : '#e5e7eb'}`, background: filter === key ? '#1a7a4a' : 'white', color: filter === key ? 'white' : '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading feedback…
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🦏</div>
          <p style={{ margin: 0, fontSize: 14 }}>{filter === 'all' ? 'No feedback yet. Members can send notes from their dashboard.' : `No ${filter.replace('_', ' ')} items.`}</p>
        </div>
      ) : (
        displayed.map(fb => {
          const sc = FEEDBACK_STATUS_CONFIG[fb.status];
          const ed = editing[fb.id];
          const isEditing = !!ed;
          return (
            <div key={fb.id} style={{ background: 'white', borderRadius: 16, padding: 22, border: `1.5px solid ${fb.status === 'pending' ? '#fbbf24' : '#f3f4f6'}`, marginBottom: 14, transition: 'border-color 0.2s' }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{fb.memberName}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{FEEDBACK_CATEGORY_LABELS[fb.category as FeedbackCategory]}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtDate(fb.submittedAt)}</div>
                </div>
                <span style={{ background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, flexShrink: 0 }}>{sc.label}</span>
              </div>

              {/* Message */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
                {fb.message}
              </div>

              {/* Existing admin comment */}
              {fb.adminComment && !isEditing && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#145c38', marginBottom: 6 }}>🦏 Rhino&apos;s response</div>
                  <div style={{ fontSize: 13, color: '#1f2937', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{fb.adminComment}&rdquo;</div>
                  {fb.updatedAt && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Updated {fmtDate(fb.updatedAt)}</div>}
                </div>
              )}

              {/* Edit panel */}
              {isEditing ? (
                <div style={{ background: '#fafafa', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    {STATUS_ORDER.map(s => {
                      const ssc = FEEDBACK_STATUS_CONFIG[s];
                      return (
                        <button key={s} type="button" onClick={() => setEditing(prev => ({ ...prev, [fb.id]: { ...ed, status: s } }))} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${ed.status === s ? ssc.color : '#e5e7eb'}`, background: ed.status === s ? ssc.bg : 'white', color: ed.status === s ? ssc.color : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {ssc.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={ed.comment}
                    onChange={e => setEditing(prev => ({ ...prev, [fb.id]: { ...ed, comment: e.target.value } }))}
                    placeholder="Leave a reply for the member (optional)…"
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleUpdate(fb)} disabled={ed.saving} style={{ padding: '9px 20px', borderRadius: 10, background: ed.saving ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                      {ed.saving ? 'Saving…' : 'Save Update'}
                    </button>
                    <button onClick={() => setEditing(prev => { const n = { ...prev }; delete n[fb.id]; return n; })} style={{ padding: '9px 20px', borderRadius: 10, background: '#f3f4f6', color: '#374151', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => initEdit(fb)} style={{ padding: '8px 18px', borderRadius: 10, background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                  ✏️ {fb.adminComment ? 'Edit Response' : 'Reply & Update Status'}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

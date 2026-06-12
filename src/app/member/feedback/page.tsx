'use client';
import { useEffect, useState } from 'react';
import { Feedback, FeedbackCategory, FEEDBACK_CATEGORY_LABELS, FEEDBACK_STATUS_CONFIG } from '@/types';

const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };

const CATEGORIES: FeedbackCategory[] = ['suggestion', 'bug', 'question', 'other'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MemberFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ category: 'suggestion' as FeedbackCategory, message: '' });

  useEffect(() => {
    fetch('/api/member/feedback').then(r => r.json()).then(d => setFeedbacks(d.feedbacks || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const res = await fetch('/api/member/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send'); return; }
      setFeedbacks(p => [data.feedback, ...p]);
      setForm({ category: 'suggestion', message: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch { setError('Connection error'); } finally { setSaving(false); }
  }

  const charCount = form.message.length;

  return (
    <div>
      {/* Rhino character card */}
      <div style={{ background: 'linear-gradient(135deg, #145c38 0%, #1a7a4a 60%, #1e6b3e 100%)', borderRadius: 20, padding: 24, marginBottom: 24, color: 'white', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -10, top: -10, fontSize: 80, opacity: 0.1, lineHeight: 1 }}>🦏</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, position: 'relative' }}>
          <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🦏</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Nemwel Boniface</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>nicknamed Rhino · PaceTracker Creator</div>
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.7, margin: '0 0 12px', fontStyle: 'italic', position: 'relative' }}>
          &ldquo;I built PaceTracker to help every one of you move more and push each other. Your feedback is what makes it better. Drop me a note — I receive every message with love and I&apos;ll get back to you.&rdquo;
        </p>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'right' }}>— Nemwel 🦏</div>
      </div>

      {/* Submit form */}
      <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 24 }}>
        <h3 style={{ fontWeight: 800, fontSize: 16, color: '#1f2937', margin: '0 0 16px' }}>Send a note to Rhino</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>What kind of note is this?</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, category: c })} style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${form.category === c ? '#1a7a4a' : '#e5e7eb'}`, background: form.category === c ? '#f0fdf4' : 'white', color: form.category === c ? '#166534' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {FEEDBACK_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Your message *</label>
            <textarea
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="Tell Rhino what you think, what's not working, or what you'd love to see in PaceTracker…"
              required maxLength={1000}
              rows={5}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: charCount > 900 ? '#dc2626' : '#9ca3af', marginTop: 4 }}>{charCount}/1000</div>
          </div>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          {success && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🦏</span>
              <span><strong>Message sent!</strong> Rhino will review it and get back to you soon.</span>
            </div>
          )}
          <button type="submit" disabled={saving || !form.message.trim()} style={{ padding: '12px 24px', borderRadius: 10, background: saving || !form.message.trim() ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving || !form.message.trim() ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Sending…' : 'Send to Rhino 🦏'}
          </button>
        </form>
      </div>

      {/* Previous tickets */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      ) : feedbacks.length > 0 ? (
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 15, color: '#1f2937', margin: '0 0 12px' }}>Your Previous Notes ({feedbacks.length})</h3>
          {feedbacks.map(fb => {
            const sc = FEEDBACK_STATUS_CONFIG[fb.status];
            return (
              <div key={fb.id} style={{ background: 'white', borderRadius: 14, padding: 20, border: `1.5px solid ${fb.status === 'pending' ? '#e5e7eb' : fb.status === 'done' ? '#bbf7d0' : '#e0f2fe'}`, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{FEEDBACK_CATEGORY_LABELS[fb.category]}</span>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtDate(fb.submittedAt)}</div>
                  </div>
                  <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>{sc.label}</span>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: fb.adminComment ? 12 : 0 }}>
                  {fb.message}
                </div>
                {fb.adminComment && (
                  <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', marginTop: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>🦏</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#145c38' }}>Rhino&apos;s response</span>
                      {fb.updatedAt && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{fmtDate(fb.updatedAt)}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#1f2937', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{fb.adminComment}&rdquo;</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

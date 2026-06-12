'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError('Missing reset token. Please request a new reset link.');
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/member/reset-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: form.password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Reset failed'); return; }
      setDone(true);
      setTimeout(() => router.push('/authenticate'), 2500);
    } catch { setError('Connection error'); } finally { setLoading(false); }
  }

  return (
    <div style={{ background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, color: '#1f2937', margin: '0 0 8px' }}>Password updated!</h2>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Redirecting you to sign in…</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontWeight: 900, fontSize: 20, color: '#1f2937', margin: '0 0 4px' }}>Set New Password</h2>
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Choose a new password for your account.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>New Password</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" required disabled={!token} style={{ ...inp, opacity: !token ? 0.5 : 1 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm New Password</label>
              <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder="••••••••" required disabled={!token} style={{ ...inp, opacity: !token ? 0.5 : 1 }} />
            </div>
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <button type="submit" disabled={loading || !token} style={{ width: '100%', padding: '12px', borderRadius: 10, background: loading || !token ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: loading || !token ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <a href="/authenticate" style={{ color: '#6b7280', fontSize: 12, textDecoration: 'none' }}>← Back to Sign In</a>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: 'white', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>🔐</div>
          <h1 style={{ color: 'white', fontWeight: 900, fontSize: 24, margin: '0 0 4px' }}>PaceTracker</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>Eden Care · #Move2026</p>
        </div>
        <Suspense fallback={<div style={{ background: 'white', borderRadius: 20, padding: 28, textAlign: 'center', color: '#6b7280' }}>Loading…</div>}>
          <ResetForm />
        </Suspense>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 16 }}>
          Reset links expire after 1 hour
        </p>
      </div>
    </div>
  );
}

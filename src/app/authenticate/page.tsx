'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CountryConfig } from '@/types';

const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'white' };
const btn = (bg: string, disabled = false) => ({ width: '100%', padding: '12px', borderRadius: 10, background: disabled ? '#9ca3af' : bg, color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer' });

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthenticatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [signup, setSignup] = useState({ name: '', email: '', password: '', confirm: '', country: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pt_member_creds');
      if (saved) {
        const { email, password } = JSON.parse(saved);
        if (email && password) setLogin({ email, password });
      }
    } catch { /* ignore */ }

    fetch('/api/countries').then(r => r.json()).then(d => {
      const active = (d.countries || []).filter((c: CountryConfig) => c.isActive);
      setCountries(active);
      if (active.length > 0) setSignup(s => ({ ...s, country: active[0].name }));
    }).catch(() => {});
  }, []);

  function switchMode(m: Mode) { setMode(m); setError(''); setResetToken(''); }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/member/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      if (!data.requiresPasswordChange) {
        try { localStorage.setItem('pt_member_creds', JSON.stringify(login)); } catch { /* ignore */ }
      }
      router.push(data.requiresPasswordChange ? '/member/change-password' : '/member');
    } catch { setError('Connection error'); } finally { setLoading(false); }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (signup.password !== signup.confirm) { setError('Passwords do not match'); return; }
    if (signup.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/member/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: signup.name, email: signup.email, password: signup.password, country: signup.country }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); return; }
      try { localStorage.setItem('pt_member_creds', JSON.stringify({ email: signup.email, password: signup.password })); } catch { /* ignore */ }
      router.push('/member');
    } catch { setError('Connection error'); } finally { setLoading(false); }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/member/reset-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Request failed'); return; }
      if (data.hasToken) { setResetToken(data.token); }
      else { setError('No account with a password was found for this email. If your account was created by an admin, contact them directly.'); }
    } catch { setError('Connection error'); } finally { setLoading(false); }
  }

  const resetUrl = typeof window !== 'undefined' ? `${window.location.origin}/reset-password?token=${resetToken}` : '';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: 'white', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>🏃</div>
          <h1 style={{ color: 'white', fontWeight: 900, fontSize: 24, margin: '0 0 4px' }}>PaceTracker</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>Eden Care · #Move2026</p>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          {mode !== 'forgot' && (
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {(['login', 'signup'] as const).map(m => (
                <button key={m} onClick={() => switchMode(m)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: mode === m ? 'white' : 'transparent', color: mode === m ? '#1a7a4a' : '#6b7280', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
                  {m === 'login' ? '🔑 Sign In' : '✨ Create Account'}
                </button>
              ))}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email</label>
                <input type="email" value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} placeholder="you@example.com" required style={inp} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password</label>
                <input type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} placeholder="••••••••" required style={inp} />
              </div>
              <div style={{ textAlign: 'right', marginBottom: 20 }}>
                <button type="button" onClick={() => switchMode('forgot')} style={{ background: 'none', border: 'none', color: '#1a7a4a', fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0 }}>Forgot password?</button>
              </div>
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <button type="submit" disabled={loading} style={btn('#1a7a4a', loading)}>{loading ? 'Signing in…' : 'Sign In'}</button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name</label>
                <input value={signup.name} onChange={e => setSignup({ ...signup, name: e.target.value })} placeholder="Jane Wanjiku" required style={inp} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email</label>
                <input type="email" value={signup.email} onChange={e => setSignup({ ...signup, email: e.target.value })} placeholder="you@example.com" required style={inp} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Country</label>
                <select value={signup.country} onChange={e => setSignup({ ...signup, country: e.target.value })} required style={inp}>
                  {countries.map(c => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password</label>
                <input type="password" value={signup.password} onChange={e => setSignup({ ...signup, password: e.target.value })} placeholder="At least 6 characters" required style={inp} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm Password</label>
                <input type="password" value={signup.confirm} onChange={e => setSignup({ ...signup, confirm: e.target.value })} placeholder="••••••••" required style={inp} />
              </div>
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <button type="submit" disabled={loading} style={btn('#1a7a4a', loading)}>{loading ? 'Creating account…' : 'Create Account'}</button>
            </form>
          )}

          {mode === 'forgot' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>← Back to Sign In</button>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: '#1f2937', margin: '12px 0 4px' }}>Reset Password</h2>
                <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Enter your email to get a reset link.</p>
              </div>

              {resetToken ? (
                <div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <p style={{ color: '#166534', fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>✅ Reset link generated! Copy it and open in a new tab:</p>
                    <div style={{ background: 'white', border: '1px solid #d1fae5', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all', fontSize: 12, color: '#374151', marginBottom: 10, fontFamily: 'monospace' }}>
                      {resetUrl}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(resetUrl); }} style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>📋 Copy Link</button>
                    <p style={{ color: '#9ca3af', fontSize: 11, margin: '8px 0 0', textAlign: 'center' }}>Link expires in 1 hour and is single-use</p>
                  </div>
                  <button onClick={() => switchMode('login')} style={{ ...btn('#f3f4f6'), color: '#374151' }}>Back to Sign In</button>
                </div>
              ) : (
                <form onSubmit={handleForgot}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email Address</label>
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" required style={inp} />
                  </div>
                  {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
                  <button type="submit" disabled={loading} style={btn('#1a7a4a', loading)}>{loading ? 'Generating link…' : 'Get Reset Link'}</button>
                </form>
              )}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 16 }}>
          Consistency over intensity · #Move2026
        </p>
      </div>
    </div>
  );
}

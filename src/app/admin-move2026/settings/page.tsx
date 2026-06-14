'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CountryConfig } from '@/types';

const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const };

export default function SettingsPage() {
  const router = useRouter();
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', flag: '' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [dangerUnlocked, setDangerUnlocked] = useState(false);
  const [dangerPassword, setDangerPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeInput, setPurgeInput] = useState('');
  const [purging, setPurging] = useState(false);
  const [purged, setPurged] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault(); setUnlockError(''); setUnlocking(true);
    try {
      const res = await fetch('/api/admin/verify-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: dangerPassword }) });
      const data = await res.json();
      if (data.valid) { setDangerUnlocked(true); setDangerPassword(''); }
      else { setUnlockError('Incorrect password. Only the admin can access this section.'); }
    } catch { setUnlockError('Connection error'); } finally { setUnlocking(false); }
  }

  async function handlePurge() {
    if (purgeInput !== 'PURGE') return;
    setPurging(true);
    try {
      const res = await fetch('/api/admin/purge', { method: 'DELETE' });
      if (!res.ok) { alert('Purge failed — please try again.'); return; }
      setPurged(true);
      setTimeout(() => router.push('/admin-move2026/dashboard'), 3000);
    } catch { alert('Connection error'); } finally { setPurging(false); }
  }

  useEffect(() => {
    fetch('/api/countries').then(r => r.json()).then(d => setCountries(d.countries || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleToggle(name: string) {
    const slug = name.toLowerCase().replace(/\s+/g, '_');
    setToggling(name);
    try {
      const res = await fetch(`/api/countries/${encodeURIComponent(slug)}`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok) setCountries(p => p.map(c => c.name === name ? data.country : c));
    } finally { setToggling(null); }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Remove "${name}" from the country list? Members already assigned to this country won't be affected.`)) return;
    const slug = name.toLowerCase().replace(/\s+/g, '_');
    setDeleting(name);
    try {
      const res = await fetch(`/api/countries/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      if (res.ok) setCountries(p => p.filter(c => c.name !== name));
    } finally { setDeleting(null); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setError(''); setAdding(true);
    try {
      const res = await fetch('/api/countries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setCountries(p => [...p, data.country].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: '', flag: '' });
    } catch { setError('Connection error'); } finally { setAdding(false); }
  }

  const active = countries.filter(c => c.isActive);
  const inactive = countries.filter(c => !c.isActive);
  const filtered = (list: CountryConfig[]) => search ? list.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) : list;

  const CountryRow = ({ c }: { c: CountryConfig }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderRadius: 10, background: '#f9fafb', marginBottom: 6 }}>
      <span style={{ fontSize: 22 }}>{c.flag}</span>
      <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{c.name}</span>
      <button
        onClick={() => handleToggle(c.name)}
        disabled={toggling === c.name}
        title={c.isActive ? 'Deactivate (hides from signup + leaderboard filters)' : 'Activate'}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, opacity: toggling === c.name ? 0.4 : 1 }}
      >
        {c.isActive ? '🟢' : '⚫'}
      </button>
      <button
        onClick={() => handleDelete(c.name)}
        disabled={deleting === c.name}
        title="Remove country"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, opacity: deleting === c.name ? 0.4 : 1 }}
      >
        🗑️
      </button>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1f2937', margin: 0 }}>Settings</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Manage countries shown in signup forms and leaderboard filters</p>
      </div>

      <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 20 }}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#374151' }}>➕ Add New Country</h2>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Country Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Uganda" required style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Flag Emoji *</label>
              <input value={form.flag} onChange={e => setForm({ ...form, flag: e.target.value })} placeholder="🇺🇬" required style={{ ...inp, width: 80, textAlign: 'center', fontSize: 20 }} />
            </div>
          </div>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button type="submit" disabled={adding} style={{ padding: '10px 20px', borderRadius: 10, background: adding ? '#9ca3af' : '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: adding ? 'not-allowed' : 'pointer' }}>
            {adding ? 'Adding…' : 'Add Country'}
          </button>
        </form>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
        🟢 <strong>Active</strong> countries appear in signup forms and leaderboard filters. ⚫ <strong>Inactive</strong> countries are hidden but existing members keep their data.
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search countries…" style={{ ...inp, paddingLeft: 34 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div style={{ width: 28, height: 28, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#374151', margin: 0 }}>Active Countries</h2>
              <span style={{ background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{active.length}</span>
            </div>
            {filtered(active).length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>{search ? 'No matches' : 'No active countries'}</p> : filtered(active).map(c => <CountryRow key={c.name} c={c} />)}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#374151', margin: 0 }}>Inactive Countries</h2>
              <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{inactive.length}</span>
            </div>
            {filtered(inactive).length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>{search ? 'No matches' : 'No inactive countries'}</p> : filtered(inactive).map(c => <CountryRow key={c.name} c={c} />)}
          </div>
        </>
      )}
      {/* ─── Danger Zone ─── */}
      <div style={{ marginTop: 40, border: '2px solid #fecaca', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ background: '#fef2f2', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #fecaca' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#991b1b' }}>⚠️ Danger Zone</div>
            <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 2 }}>Irreversible actions that affect all data</div>
          </div>
          <span style={{ fontSize: 20 }}>{dangerUnlocked ? '🔓' : '🔒'}</span>
        </div>

        {!dangerUnlocked ? (
          <div style={{ padding: 24, background: 'white' }}>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
              This section is protected. Enter your admin password to unlock it.
            </p>
            <form onSubmit={handleUnlock} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input
                type="password"
                value={dangerPassword}
                onChange={e => { setDangerPassword(e.target.value); setUnlockError(''); }}
                placeholder="Admin password"
                required
                style={{ ...inp, maxWidth: 240 }}
              />
              <button type="submit" disabled={unlocking || !dangerPassword} style={{ padding: '9px 18px', borderRadius: 8, background: unlocking || !dangerPassword ? '#9ca3af' : '#991b1b', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: unlocking || !dangerPassword ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {unlocking ? 'Verifying…' : '🔓 Unlock'}
              </button>
            </form>
            {unlockError && (
              <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{unlockError}</div>
            )}
          </div>
        ) : (
          <div style={{ background: 'white' }}>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✅ Danger Zone unlocked</span>
              <button onClick={() => { setDangerUnlocked(false); setPurgeOpen(false); setPurgeInput(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>🔒 Lock again</button>
            </div>

            <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>🗑️ Purge All PaceTracker Data</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Deletes only <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>pt:*</code> keys — other systems sharing this database are not affected.</div>
              </div>
              <button onClick={() => { setPurgeOpen(!purgeOpen); setPurgeInput(''); }} style={{ padding: '8px 16px', borderRadius: 10, background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {purgeOpen ? 'Cancel' : 'Purge Data'}
              </button>
            </div>

            {purgeOpen && (
              <div style={{ padding: '0 24px 24px' }}>
                {purged ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: '#1f2937', marginBottom: 4 }}>PaceTracker data purged</div>
                    <div style={{ color: '#6b7280', fontSize: 14 }}>Redirecting to dashboard in 3 seconds…</div>
                  </div>
                ) : (
                  <>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b', marginBottom: 10 }}>This will permanently delete:</div>
                      <ul style={{ margin: 0, paddingLeft: 20, color: '#b91c1c', fontSize: 13, lineHeight: 2 }}>
                        <li>All member accounts and self-registrations</li>
                        <li>All activity logs and points</li>
                        <li>All prizes and winners</li>
                        <li>All feedback tickets</li>
                        <li>All country configurations (auto-reseed on next load)</li>
                      </ul>
                      <div style={{ marginTop: 10, fontSize: 13, color: '#166534', fontWeight: 600 }}>✓ Admin login credentials are not affected — they live in environment variables.</div>
                      <div style={{ marginTop: 4, fontSize: 13, color: '#166534', fontWeight: 600 }}>✓ Other systems sharing this database are not affected — only <code style={{ background: '#dcfce7', padding: '1px 4px', borderRadius: 3 }}>pt:*</code> keys are deleted.</div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                        Type <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, color: '#dc2626', fontWeight: 900 }}>PURGE</code> to confirm
                      </label>
                      <input
                        value={purgeInput}
                        onChange={e => setPurgeInput(e.target.value)}
                        placeholder="Type PURGE here"
                        style={{ ...inp, maxWidth: 240, borderColor: purgeInput === 'PURGE' ? '#16a34a' : '#e5e7eb', color: '#1f2937', fontWeight: 700, letterSpacing: '0.05em' }}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handlePurge}
                      disabled={purgeInput !== 'PURGE' || purging}
                      style={{ padding: '11px 24px', borderRadius: 10, background: purgeInput === 'PURGE' && !purging ? '#dc2626' : '#9ca3af', color: 'white', fontWeight: 800, fontSize: 14, border: 'none', cursor: purgeInput === 'PURGE' && !purging ? 'pointer' : 'not-allowed' }}
                    >
                      {purging ? 'Purging…' : '🗑️ Yes, delete PaceTracker data'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

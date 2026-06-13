'use client';
import { useEffect, useState, useMemo } from 'react';
import { MemberStats, Winner, PrizeCategory, CountryConfig, TIER_CONFIG, PointTier, getCountryFlag } from '@/types';
import { getSticker, getStickerTier, STICKER_BG, STICKER_LABELS } from '@/lib/stickers';

type SlackMsgType = 'leaders' | 'reminder' | 'combined';

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtDateLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function today() { return new Date().toISOString().slice(0, 10); }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

const LEADERBOARD_LINK = 'https://pacetracker-move2026.vercel.app/leaderboard';

function buildLeadersMessage(active: MemberStats[], date: string, prizes: PrizeCategory[]): string {
  const top = active.slice(0, 5);
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const topLines = top.length > 0
    ? top.map((m, i) => `${medals[i]} *${m.memberName}* — ${m.totalPoints} pts | ${m.activeDays} active day${m.activeDays !== 1 ? 's' : ''} | ${m.runSessions} session${m.runSessions !== 1 ? 's' : ''}`).join('\n')
    : '_No activity logged yet — be the first!_';
  const totalPoints = active.reduce((s, m) => s + m.totalPoints, 0);
  const totalDays = active.reduce((s, m) => s + m.activeDays, 0);
  const prizeNote = prizes.length > 0
    ? `\n🎁 *Prizes up for grabs:* ${prizes.map(p => p.amount > 0 ? `${p.name} ($${p.amount})` : p.name).join(', ')}`
    : '';

  return `🏆 *Move Together Leaderboard Update — ${fmtDateLong(date)}*

Here's where we stand on the Eden Care #Move2026 challenge!

${topLines}

📊 *Challenge Snapshot:*
• ${active.length} participant${active.length !== 1 ? 's' : ''} moving together
• ${totalPoints} total points earned
• ${totalDays} total active days logged${prizeNote}

Every step counts — keep pushing! 💪

👉 *Full leaderboard:* ${LEADERBOARD_LINK}`;
}

function buildReminderMessage(active: MemberStats[], date: string): string {
  const dateLabel = fmtDateLong(date);
  const count = active.length;
  const peerNote = count > 0
    ? `${count} of your teammates are already on the leaderboard`
    : 'The challenge is now live';

  return `👋 *Hey Move Together crew — ${dateLabel}!*

${peerNote} — are you in? 🏃

*Log your activity today and:*
✅ Build healthy movement habits with your colleagues
✅ Earn points for every workout — even a 20-min lunch walk counts!
✅ Compete in the 8-Week Couch to 10K challenge
✅ Win prizes for top performers
✅ Stay accountable and motivated with your whole team
✅ Track your own personal stats and progress week by week

*Already a member?* Log today's activity and keep your streak alive! 🔥
*Not signed up yet?* Create your free account now and join the fun!

🔗 ${LEADERBOARD_LINK}

_You can log up to 2 activities per day, and even catch up on the last 2 days if you missed a log!_ 💙`;
}

function buildCombinedMessage(active: MemberStats[], date: string, prizes: PrizeCategory[]): string {
  return buildLeadersMessage(active, date, prizes) + '\n\n---\n\n' + buildReminderMessage(active, date);
}

export default function AdminLeaderboardPage() {
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [prizes, setPrizes] = useState<PrizeCategory[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [date, setDate] = useState(yesterday());
  const [msgType, setMsgType] = useState<SlackMsgType>('leaders');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([fetch('/api/leaderboard'), fetch('/api/countries')]).then(([lr, cr]) => Promise.all([lr.json(), cr.json()]))
      .then(([d, cd]) => { setStats(d.stats || []); setWinners((d.winners || []).filter((w: Winner) => w.isVisible)); setPrizes((d.prizes || []).filter((p: PrizeCategory) => p.isVisible)); setCountries(cd.countries || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const active = stats.filter(s => s.isActive);
  const rankMap = new Map(active.map((m, i) => [m.memberId, i + 1]));
  const tierGroups = (Object.entries(TIER_CONFIG) as [PointTier, typeof TIER_CONFIG[PointTier]][])
    .reverse().map(([key, cfg]) => ({ tier: key, cfg, members: active.filter(s => s.tier === key) })).filter(g => g.members.length > 0);

  const slackMessage = useMemo(() => {
    if (msgType === 'leaders') return buildLeadersMessage(active, date, prizes);
    if (msgType === 'reminder') return buildReminderMessage(active, date);
    return buildCombinedMessage(active, date, prizes);
  }, [msgType, active, date, prizes]);

  function copyToClipboard() {
    navigator.clipboard.writeText(slackMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function generateImage() {
    setGenerating(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const el = document.getElementById('leaderboard-capture');
      if (!el) { alert('Preview not found'); return; }
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const link = document.createElement('a');
      link.download = `pacetracker-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error(e); alert('Image generation failed. Try PDF instead.'); }
    finally { setGenerating(false); }
  }

  async function generatePDF() {
    setGenerating(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const el = document.getElementById('leaderboard-capture');
      if (!el) { alert('Preview not found'); return; }
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height / canvas.width) * w;
      pdf.addImage(imgData, 'PNG', 0, 0, w, h);
      pdf.save(`pacetracker-${date}.pdf`);
    } catch (e) { console.error(e); alert('PDF generation failed.'); }
    finally { setGenerating(false); }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1f2937', margin: 0 }}>Generate Leaderboard</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Download daily images or PDFs to post in the team channel</p>
      </div>

      <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #f3f4f6', marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Report Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today()} style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => setDate(yesterday())} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Yesterday</button>
            <button onClick={() => setDate(today())} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Today</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={generateImage} disabled={generating} style={{ padding: '11px 20px', borderRadius: 10, background: '#1a7a4a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', opacity: generating ? 0.6 : 1 }}>
            {generating ? '⏳ Generating...' : '📸 Download PNG'}
          </button>
          <button onClick={generatePDF} disabled={generating} style={{ padding: '11px 20px', borderRadius: 10, background: '#f26522', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', opacity: generating ? 0.6 : 1 }}>
            📄 Download PDF
          </button>
        </div>
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#1e40af' }}>
        💡 <strong>Daily routine:</strong> Each morning, set the date to yesterday → copy the Slack message → post in #Move2026 → then download and attach the PNG image.
      </div>

      {/* Slack Message Generator */}
      <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #f3f4f6', marginBottom: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>Slack Message Generator</h2>
          <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0' }}>
            Dynamic messages ready to copy and paste directly into #Move2026 — updates automatically when you change the date above.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {([
            { key: 'leaders', label: '🏆 Leaderboard Update' },
            { key: 'reminder', label: '👋 Daily Reminder' },
            { key: 'combined', label: '📢 Full Update' },
          ] as { key: SlackMsgType; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => { setMsgType(key); setCopied(false); }} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: msgType === key ? 700 : 500,
              border: `2px solid ${msgType === key ? '#1a7a4a' : '#e5e7eb'}`,
              background: msgType === key ? '#f0fdf4' : 'white',
              color: msgType === key ? '#1a7a4a' : '#374151',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <textarea readOnly value={slackMessage} style={{
            width: '100%', minHeight: msgType === 'combined' ? 340 : 220, padding: '12px 14px',
            border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12, fontFamily: 'ui-monospace, monospace',
            color: '#374151', background: '#f9fafb', resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box',
            outline: 'none',
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            Ready to paste in Slack · uses Slack markdown (*bold*, _italic_) · link included
          </span>
          <button onClick={copyToClipboard} style={{
            padding: '9px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
            background: copied ? '#16a34a' : '#1a7a4a', color: 'white',
            transition: 'background 0.2s',
          }}>
            {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
          </button>
        </div>
      </div>

      {/* Leaderboard preview — this is what gets captured */}
      <div id="leaderboard-capture" style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid #f3f4f6', fontFamily: 'Inter, -apple-system, sans-serif', maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', padding: '24px 24px 20px', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Eden Care · #Move2026</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>Move Together Leaderboard</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>8-Week Couch to 10K</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{fmtDate(date)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[['Participants', active.length], ['Total Points', active.reduce((s, m) => s + m.totalPoints, 0)], ['Active Days', active.reduce((s, m) => s + m.activeDays, 0)]].map(([l, v]) => (
              <div key={l as string} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{v}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {winners.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg,#fef9c3,#fde68a)', border: '1px solid #fcd34d', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 10, fontSize: 13 }}>🎉 Challenge Winners</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                {winners.map(w => (
                  <div key={w.id} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 20 }}>🏅</span>
                    <div><div style={{ fontWeight: 700, fontSize: 12 }}>{w.memberName}</div><div style={{ fontSize: 10, color: '#b45309' }}>{w.prizeCategoryName}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {prizes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Prizes Up for Grabs</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                {prizes.map(p => (
                  <div key={p.id} style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 10px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600, fontSize: 11 }}>{p.name}</span>{p.amount > 0 && <span style={{ fontWeight: 900, fontSize: 11, color: '#f26522' }}>${p.amount}</span>}</div>
                    {p.criteria && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{p.criteria}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tierGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🏁</div>
              <p style={{ margin: 0 }}>No participants logged yet</p>
            </div>
          ) : (
            tierGroups.map(({ tier, cfg, members }) => (
              <div key={tier} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{cfg.emoji}</span>
                  <span style={{ fontWeight: 900, fontSize: 15, color: '#1f2937' }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{cfg.min}{cfg.max ? `–${cfg.max}` : '+'} pts</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map((m, i) => {
                    const rank = rankMap.get(m.memberId) ?? 0;
                    const sticker = getSticker(rank, active.length, m.memberId);
                    const { bg, border } = STICKER_BG[getStickerTier(rank, active.length)];
                    return (
                    <div key={m.memberId} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb', borderRadius: 10, padding: '10px 12px' }}>
                      <span style={{ fontSize: 12, color: '#d1d5db', width: 16, textAlign: 'center', fontWeight: 700 }}>{tier === 'move_together_champions' && i === 0 ? '👑' : i + 1}</span>
                      <div title={`${m.memberName} · ${STICKER_LABELS[sticker] ?? sticker}`} style={{ width: 32, height: 32, borderRadius: '50%', background: bg, border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {sticker}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.memberName} <span>{getCountryFlag(m.country, countries)}</span></div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{m.activeDays} days active · {m.runSessions} sessions</div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: '#1a7a4a', flexShrink: 0 }}>{m.totalPoints}</div>
                    </div>
                  ); })}
                </div>
              </div>
            ))
          )}
          <div style={{ textAlign: 'center', fontSize: 10, color: '#d1d5db', marginTop: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
            Consistency over intensity · Small steps, big difference · Eden Care #Move2026
          </div>
        </div>
      </div>
      <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 12 }}>This is a live preview — the downloaded image matches what you see here</p>
    </div>
  );
}
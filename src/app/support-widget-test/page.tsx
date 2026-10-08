import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

// Zoho Desk feedback widget IDs are public identifiers (they ship to every visitor's
// browser in the script URL), not secrets, so they can live in source safely.
const ZOHO_WIDGET_ID = '1449898000000592059';
const ZOHO_ORG_ID = '936873128';

const MODES = {
  popup: { label: 'Popup', displayType: 'popout', desc: 'Floating launcher button; the form opens in an overlay.' },
  embed: { label: 'Embedded', displayType: 'embeded', desc: 'Form rendered inline inside the page below.' },
} as const;
type Mode = keyof typeof MODES;

export const metadata: Metadata = { title: 'Support Widget Test | PaceTracker', robots: { index: false, follow: false } };

export default async function SupportWidgetTestPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { mode: rawMode } = await searchParams;
  const mode: Mode | null = rawMode === 'popup' || rawMode === 'embed' ? rawMode : null;
  const src = mode ? `https://desk.zoho.com/portal/api/feedbackwidget/${ZOHO_WIDGET_ID}?orgId=${ZOHO_ORG_ID}&displayType=${MODES[mode].displayType}` : null;

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)', color: 'white', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Link href="/leaderboard" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, textDecoration: 'none' }}>← Back to Leaderboard</Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>Support Widget Test</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Try both Zoho Desk options and compare</p>
        </div>
      </header>
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
          {(Object.keys(MODES) as Mode[]).map(m => {
            const active = m === mode;
            // Plain <a> (not <Link>) forces a full reload, so the previous widget's
            // globals and injected DOM are gone before the other variant loads.
            return (
              <a key={m} href={`?mode=${m}`} style={{ display: 'block', padding: 16, borderRadius: 14, textDecoration: 'none', background: active ? '#1a7a4a' : 'white', color: active ? 'white' : '#111827', border: `2px solid ${active ? '#1a7a4a' : '#e5e7eb'}` }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{active ? '✓ ' : ''}{MODES[m].label}</div>
                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>{MODES[m].desc}</div>
              </a>
            );
          })}
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', minHeight: 200 }}>
          {!mode && <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Pick an option above to load that widget.</p>}
          {mode === 'popup' && <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Look for the Zoho launcher button on the edge of the screen and click it to open the form.</p>}
          {mode === 'embed' && <div id="zsfeedbackwidgetdiv" />}
        </div>
      </main>
      {src && <Script key={mode} src={src} strategy="afterInteractive" />}
    </div>
  );
}

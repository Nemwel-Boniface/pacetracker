'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';

const DISMISS_KEY = 'pt_install_dismissed';
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }>; }
const noSubscribe = () => () => {};
function notInstalledOrDismissed(): boolean {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  try { return !standalone && localStorage.getItem(DISMISS_KEY) !== '1'; } catch { return !standalone; }
}
function detectIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Offers "Add to home screen" so members don't have to hunt for the link.
// Android/desktop Chrome get a one-tap install button; iPhone/iPad Safari get Share-sheet instructions.
export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  // Read browser-only state after hydration (server renders nothing).
  const eligible = useSyncExternalStore(noSubscribe, notInstalledOrDismissed, () => false);
  const isIOS = useSyncExternalStore(noSubscribe, detectIOS, () => false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage unavailable */ }
    setHidden(true);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setHidden(true);
    setInstallEvent(null);
  }

  // Only show when there's something to do: an install button (Chrome) or instructions (iOS).
  if (!eligible || hidden || (!installEvent && !isIOS)) return null;
  return (
    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 24 }}>📲</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#065f46' }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>Add PaceTracker to your home screen</div>
        {isIOS
          ? <div style={{ marginTop: 2 }}>In Safari, tap <b>Share</b> <span aria-hidden>⬆️</span> then <b>Add to Home Screen</b>.</div>
          : <div style={{ marginTop: 2 }}>Open it like an app, no link needed.</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {installEvent && <button onClick={install} style={{ background: '#145c38', color: 'white', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Install</button>}
        <button onClick={dismiss} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{installEvent ? 'Not now' : 'Got it'}</button>
      </div>
    </div>
  );
}

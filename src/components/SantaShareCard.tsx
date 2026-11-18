'use client';
import { useState } from 'react';
import { YEF_GIFT_BUDGET_KES } from '@/types';

// The picture people save after the wheel lands: who they're gifting, and who's gifting them.
// It's shown on the page as a preview, and the same element is what gets captured as the PNG.
export default function SantaShareCard({ name, gifting, giftedBy }: { name: string; gifting: string; giftedBy: string | null }) {
  const [saving, setSaving] = useState(false);
  const mutual = giftedBy === gifting;

  async function save() {
    setSaving(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const el = document.getElementById('santa-share-capture');
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 3, backgroundColor: null, useCORS: true, logging: false });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (!blob) return;
      const fileName = `yef-2026-secret-santa-${name.trim().split(/\s+/)[0].toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      // On phones, the share sheet lets people save to photos or send it straight to WhatsApp.
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'YEF 2026 Secret Santa' }); return; }
        catch (e) { if ((e as Error).name === 'AbortError') return; }
      }
      const link = document.createElement('a');
      link.download = fileName;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div id="santa-share-capture" style={{ maxWidth: 360, margin: '0 auto', borderRadius: 20, overflow: 'hidden', background: 'linear-gradient(160deg,#145c38 0%,#1a7a4a 55%,#f26522 100%)', color: 'white', padding: '28px 24px', textAlign: 'center', fontFamily: 'inherit' }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, opacity: 0.85 }}>🎄 YEF 2026 · SECRET SANTA</div>
        <div style={{ fontSize: 44, margin: '14px 0 6px' }}>🎅</div>
        <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>{name}</div>
        <div style={{ fontSize: 14, opacity: 0.85, margin: '8px 0' }}>is gifting</div>
        <div style={{ display: 'inline-block', background: '#facc15', color: '#145c38', borderRadius: 14, padding: '10px 18px', fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>🎁 {gifting}</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 14 }}>
          {mutual ? `…and ${gifting} is gifting ${name.split(/\s+/)[0]} right back! 🤝` : giftedBy ? `${giftedBy} is gifting ${name.split(/\s+/)[0]} 🎁` : ''}
        </div>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.25)', fontSize: 12, opacity: 0.85 }}>
          Gift budget: up to KES {YEF_GIFT_BUDGET_KES.toLocaleString()} · Ginja AI Year-End Function
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, background: saving ? '#9ca3af' : '#f26522', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Making your picture…' : '📸 Save my picture'}
        </button>
      </div>
    </div>
  );
}

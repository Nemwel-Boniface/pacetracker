'use client';
import { useState, useRef, useEffect } from 'react';
import { PrizeCategory, Winner } from '@/types';

interface ChatMsg {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

const FAQS = [
  { id: 'what_is',      label: '🦏 What is PaceTracker?' },
  { id: 'log_activity', label: '➕ How do I log an activity?' },
  { id: 'points',       label: '⭐ How do points work?' },
  { id: 'tiers',        label: '🏅 What are the tiers?' },
  { id: 'gifts',        label: '🎁 What gifts are there?' },
  { id: 'winners',      label: '🥇 Any winners yet?' },
];

function renderText(text: string) {
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>
      {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={j}>{part.slice(2, -2)}</strong>
          : part
      )}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

export default function ChatBot() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [showFAQs, setShowFAQs] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [prizes, setPrizes]     = useState<PrizeCategory[]>([]);
  const [winners, setWinners]   = useState<Winner[]>([]);
  const bottomRef               = useRef<HTMLDivElement>(null);

  // Auto-hide "Chat with me" hint after 6 s
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  // Fetch live data the first time the chat opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/prizes').then(r => r.json()).then(d => setPrizes(d.prizes || [])).catch(() => {});
    fetch('/api/winners').then(r => r.json()).then(d => setWinners(d.winners || [])).catch(() => {});
  }, [open]);

  // Greet on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: '0',
        role: 'bot',
        text: "Hey there! 👋 I'm **Nemwel**, the creator of PaceTracker!\n\nHow can I help you today? Pick a question below and I'll get right on it. 🦏",
      }]);
    }
  }, [open, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  function getBotResponse(faqId: string): string {
    switch (faqId) {
      case 'what_is':
        return "PaceTracker is Eden Care's **#Move2026** challenge — an 8-week movement challenge to get everyone active! 🏃‍♂️\n\nYou log activities like runs, walks, gym sessions, yoga, and more to earn points. The goal is to build a healthy habit, cheer on your colleagues, and have fun moving together! 🌟\n\nIs there anything else you'd like to know?";

      case 'log_activity':
        return "Logging an activity is super easy! Here's how:\n\n1️⃣ Click the **➕ Log Activity** tab at the top\n2️⃣ Choose your activity type (run, walk, gym, yoga…)\n3️⃣ Pick the date\n4️⃣ Optionally add distance / duration\n5️⃣ Hit **Log Activity** — done! ✅\n\nYou can log up to **2 activities per day**. Every step counts! 💪";

      case 'points':
        return "Here's the full points breakdown:\n\n🏃 **Run / Workout session** — 2 points\n🍃 **Lunch-time activity** — 1 point\n📋 **Sign up for a race** — 5 points\n🏅 **Complete a race** — 10 points\n\n💡 This is about **consistency, not intensity**. Whether you run 1 km or 10 km you get the same points — every move matters! 🦏";

      case 'tiers':
        return "As you rack up points you level up through these tiers:\n\n🌱 **Getting Started** — 1–10 pts\n🔥 **Building Momentum** — 11–20 pts\n⚡ **Consistency Crew** — 21–30 pts\n🏆 **Move Together Champions** — 31+ pts\n\nYou also unlock special stickers along the way! 🎖️ Keep moving and collect them all! 💫";

      case 'gifts': {
        const visible = prizes.filter(p => p.isVisible);
        if (visible.length === 0) {
          return prizes.length === 0
            ? "No gifts have been set up yet — but they're definitely coming! 🎁\n\nKeep earning those points and be ready when the prizes drop! 🦏✨"
            : "Prizes are being finalized behind the scenes... 🎁🤫\n\nNemwel is cooking something special — stay tuned and keep those points coming! 🦏";
        }
        const list = visible
          .map(p => `🎁 **${p.name}**${p.amount ? ` — KES ${p.amount.toLocaleString()}` : ''}${p.description ? `\n   ${p.description}` : ''}`)
          .join('\n\n');
        return `Here's what's up for grabs! 🎉\n\n${list}\n\nThose prizes are waiting for the most consistent movers — it could be YOU! 🦏🏆`;
      }

      case 'winners': {
        const visible = winners.filter(w => w.isVisible);
        if (visible.length === 0) {
          return winners.length === 0
            ? "No winners have been announced yet! 🏅\n\nThe challenge is still going strong — keep logging activities and earning points. You could be the next champion! 💪🦏"
            : "Winners are being carefully reviewed... 👀\n\nNemwel is checking the results — stay tuned for the big announcement! 🦏";
        }
        const list = visible.map(w => `🥇 **${w.memberName}** — ${w.prizeCategoryName}`).join('\n');
        return `And the winners are... 🥁🥁🥁\n\n${list}\n\nMassive congratulations to all our champions! 🎉🦏`;
      }

      default:
        return "Hmm, I'm not sure about that one — but I'm always here to help! Pick one of the questions below and I'll sort you out. 🦏";
    }
  }

  async function handleFAQ(faq: { id: string; label: string }) {
    if (thinking) return;
    setShowFAQs(false);
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: faq.label }]);
    setThinking(true);
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 1000));
    setThinking(false);
    setMessages(prev => [...prev, { id: `b-${Date.now()}`, role: 'bot', text: getBotResponse(faq.id) }]);
    setShowFAQs(true);
  }

  return (
    <>
      {/* ── Chat window ─────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 20,
          width: 360, maxWidth: 'calc(100vw - 40px)',
          height: 530, maxHeight: 'calc(100vh - 120px)',
          background: 'white', borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          zIndex: 9999,
          animation: 'chatSlideUp 0.28s cubic-bezier(0.175,0.885,0.32,1.275)',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{
                width: 46, height: 46,
                background: 'rgba(255,255,255,0.18)', borderRadius: 13,
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0,
              }}>🦏</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, color: 'white' }}>Nemwel Boniface</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>PaceTracker Creator · #Move2026</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <div style={{ width: 7, height: 7, background: '#4ade80', borderRadius: '50%', boxShadow: '0 0 0 2px rgba(74,222,128,0.35)' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>Online now</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white',
                width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700,
              }}
            >✕</button>
          </div>

          {/* Messages area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 14px 6px',
            display: 'flex', flexDirection: 'column', gap: 10,
            background: 'linear-gradient(180deg,#f0fdf4 0%,#f8fafb 100%)',
          }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 8,
                animation: 'msgFadeIn 0.3s ease',
              }}>
                {msg.role === 'bot' && (
                  <div style={{
                    width: 30, height: 30, flexShrink: 0,
                    background: 'linear-gradient(135deg,#145c38,#1a7a4a)',
                    borderRadius: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, boxShadow: '0 2px 8px rgba(20,92,56,0.3)',
                  }}>🦏</div>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 13px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg,#1a7a4a,#145c38)'
                    : 'white',
                  color: msg.role === 'user' ? 'white' : '#1f2937',
                  fontSize: 13, lineHeight: 1.65,
                  boxShadow: msg.role === 'user'
                    ? '0 3px 12px rgba(20,92,56,0.35)'
                    : '0 2px 8px rgba(0,0,0,0.06)',
                  border: msg.role === 'bot' ? '1px solid #e5e7eb' : 'none',
                }}>
                  {renderText(msg.text)}
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {thinking && (
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 8,
                animation: 'msgFadeIn 0.3s ease',
              }}>
                <div style={{
                  width: 30, height: 30, flexShrink: 0,
                  background: 'linear-gradient(135deg,#145c38,#1a7a4a)',
                  borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15,
                }}>🦏</div>
                <div style={{
                  padding: '11px 15px', borderRadius: '16px 16px 16px 4px',
                  background: 'white', border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Nemwel is thinking</span>
                  <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 5, height: 5, background: '#1a7a4a', borderRadius: '50%',
                        display: 'inline-block',
                        animation: `dotBounce 1.3s ${i * 0.22}s infinite ease-in-out`,
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* FAQ pills */}
          {showFAQs && !thinking && (
            <div style={{
              padding: '10px 13px 13px',
              background: 'white',
              borderTop: '1px solid #f3f4f6',
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7,
              }}>Quick questions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {FAQS.map(faq => (
                  <button
                    key={faq.id}
                    onClick={() => handleFAQ(faq)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: 20,
                      border: '1.5px solid #e5e7eb',
                      background: 'white',
                      color: '#374151',
                      fontSize: 12, fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseOver={e => {
                      const b = e.currentTarget;
                      b.style.background = '#f0fdf4';
                      b.style.borderColor = '#1a7a4a';
                      b.style.color = '#145c38';
                      b.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={e => {
                      const b = e.currentTarget;
                      b.style.background = 'white';
                      b.style.borderColor = '#e5e7eb';
                      b.style.color = '#374151';
                      b.style.transform = 'translateY(0)';
                    }}
                  >
                    {faq.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── "Chat with me" hint label ────────────────────────────────── */}
      {!open && showHint && (
        <div style={{
          position: 'fixed', bottom: 98, right: 18,
          background: 'white',
          padding: '7px 13px',
          borderRadius: 20,
          boxShadow: '0 4px 18px rgba(0,0,0,0.13)',
          fontSize: 12, fontWeight: 700, color: '#145c38',
          border: '1.5px solid #d1fae5',
          whiteSpace: 'nowrap',
          zIndex: 9998,
          animation: 'hintSlideIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
          pointerEvents: 'none',
        }}>
          💬 Chat with Nemwel!
          {/* Arrow pointing down-right */}
          <span style={{
            position: 'absolute', bottom: -7, right: 18,
            width: 13, height: 13,
            background: 'white',
            transform: 'rotate(45deg)',
            borderRight: '1.5px solid #d1fae5',
            borderBottom: '1.5px solid #d1fae5',
          }} />
        </div>
      )}

      {/* ── Floating trigger button ──────────────────────────────────── */}
      <button
        onClick={() => { setOpen(o => !o); setShowHint(false); }}
        title="Chat with Nemwel 🦏"
        style={{
          position: 'fixed', bottom: 20, right: 20,
          width: 62, height: 62, borderRadius: '50%',
          background: open
            ? 'linear-gradient(135deg,#374151,#1f2937)'
            : 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)',
          border: 'none',
          cursor: 'pointer',
          fontSize: open ? 22 : 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open
            ? '0 4px 20px rgba(0,0,0,0.3)'
            : '0 4px 20px rgba(20,92,56,0.55)',
          zIndex: 10000,
          transition: 'transform 0.2s, box-shadow 0.2s, background 0.3s',
          animation: open ? 'none' : 'rhinoPulse 2.5s infinite',
          color: 'white',
          fontWeight: 900,
        }}
        onMouseOver={e => {
          const b = e.currentTarget;
          b.style.transform = 'scale(1.1)';
          b.style.boxShadow = open
            ? '0 8px 28px rgba(0,0,0,0.4)'
            : '0 8px 28px rgba(20,92,56,0.65)';
        }}
        onMouseOut={e => {
          const b = e.currentTarget;
          b.style.transform = 'scale(1)';
          b.style.boxShadow = open
            ? '0 4px 20px rgba(0,0,0,0.3)'
            : '0 4px 20px rgba(20,92,56,0.55)';
        }}
      >
        {open ? '✕' : '🦏'}
      </button>

      {/* ── Keyframe animations ──────────────────────────────────────── */}
      <style>{`
        @keyframes rhinoPulse {
          0%,100% { box-shadow: 0 4px 20px rgba(20,92,56,0.55), 0 0 0 0 rgba(20,122,74,0.4); }
          60%      { box-shadow: 0 4px 20px rgba(20,92,56,0.55), 0 0 0 14px rgba(20,122,74,0); }
        }
        @keyframes chatSlideUp {
          from { opacity:0; transform:translateY(18px) scale(0.95); }
          to   { opacity:1; transform:translateY(0)   scale(1); }
        }
        @keyframes msgFadeIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes dotBounce {
          0%,80%,100% { transform:scale(0.55); opacity:0.35; }
          40%          { transform:scale(1);    opacity:1; }
        }
        @keyframes hintSlideIn {
          from { opacity:0; transform:translateX(12px) scale(0.9); }
          to   { opacity:1; transform:translateX(0)    scale(1); }
        }
      `}</style>
    </>
  );
}

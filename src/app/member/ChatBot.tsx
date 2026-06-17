'use client';
import { useState, useRef, useEffect } from 'react';
import {
  PrizeCategory, Winner,
  ActivityType, ACTIVITY_LABELS, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS,
} from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMsg { id: string; role: 'user' | 'bot'; text: string; }
interface LogDraft {
  activityType?: ActivityType;
  date?: string;
  dateLabel?: string;
  distance?: string;
  duration?: string;
  notes?: string;
}
type InputMode =
  | 'faqs'
  | 'activity_types'
  | 'dates'
  | 'optional_details'
  | 'preview_actions'
  | 'login_prompt'
  | 'none';

// ── Constants ──────────────────────────────────────────────────────────────────
const FAQS = [
  { id: 'what_is',      label: '🦏 What is PaceTracker?' },
  { id: 'log_activity', label: '➕ How do I log an activity?' },
  { id: 'points',       label: '⭐ How do points work?' },
  { id: 'tiers',        label: '🏅 What are the tiers?' },
  { id: 'gifts',        label: '🎁 What gifts are there?' },
  { id: 'winners',      label: '🥇 Any winners yet?' },
  { id: '__log__',      label: '📝 Log an activity for me' },
];

const ACTIVITY_TYPES = Object.entries(ACTIVITY_LABELS) as [ActivityType, string][];

function todayUTC() { return new Date().toISOString().slice(0, 10); }
function shiftDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtDateLabel(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}
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

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #e5e7eb',
  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const btnPill = (active = false): React.CSSProperties => ({
  padding: '6px 11px', borderRadius: 20,
  border: `1.5px solid ${active ? '#1a7a4a' : '#e5e7eb'}`,
  background: active ? '#f0fdf4' : 'white',
  color: active ? '#145c38' : '#374151',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
});

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChatBot() {
  const [open, setOpen]             = useState(false);
  const [messages, setMessages]     = useState<ChatMsg[]>([]);
  const [thinking, setThinking]     = useState(false);
  const [inputMode, setInputMode]   = useState<InputMode>('faqs');
  const [showHint, setShowHint]     = useState(true);
  const [prizes, setPrizes]         = useState<PrizeCategory[]>([]);
  const [winners, setWinners]       = useState<Winner[]>([]);
  const [logDraft, setLogDraft]     = useState<LogDraft>({});
  const [optionals, setOptionals]   = useState({ distance: '', duration: '', notes: '' });
  const bottomRef                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch('/api/prizes').then(r => r.json()).then(d => setPrizes(d.prizes || [])).catch(() => {});
    fetch('/api/winners').then(r => r.json()).then(d => setWinners(d.winners || [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: '0', role: 'bot',
        text: "Hey there! 👋 I'm **Nemwel**, the creator of PaceTracker!\n\nHow can I help you today? I can answer questions — or even log an activity for you! 🦏",
      }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // ── FAQ responses ─────────────────────────────────────────────────────────
  function getBotResponse(faqId: string): string {
    switch (faqId) {
      case 'what_is':
        return "PaceTracker is Eden Care's **#Move2026** challenge — an 8-week movement challenge to get everyone active! 🏃‍♂️\n\nYou log activities like runs, walks, gym sessions, yoga, and more to earn points. The goal is to build a healthy habit, cheer on your colleagues, and have fun moving together! 🌟\n\nAnything else you'd like to know?";
      case 'log_activity':
        return "Logging an activity is super easy!\n\n1️⃣ Click the **➕ Log Activity** tab\n2️⃣ Choose your activity type\n3️⃣ Pick the date\n4️⃣ Optionally add distance / duration\n5️⃣ Hit **Log Activity** — done! ✅\n\n💡 Or just tap **📝 Log an activity for me** below and I'll walk you through it! 🦏";
      case 'points':
        return "Here's the full points breakdown:\n\n🏃 **Run / Workout session** — 2 points\n🍃 **Lunch-time activity** — 1 point\n📋 **Sign up for a race** — 5 points\n🏅 **Complete a race** — 10 points\n\n💡 This is about **consistency, not intensity**. Every move matters! 🦏";
      case 'tiers':
        return "As you rack up points you level up through these tiers:\n\n🌱 **Getting Started** — 1–10 pts\n🔥 **Building Momentum** — 11–20 pts\n⚡ **Consistency Crew** — 21–30 pts\n🏆 **Move Together Champions** — 31+ pts\n\nYou also unlock special stickers along the way! 🎖️ Keep moving and collect them all! 💫";
      case 'gifts': {
        const visible = prizes.filter(p => p.isVisible);
        if (visible.length === 0) {
          return prizes.length === 0
            ? "No gifts have been set up yet — but they're definitely coming! 🎁\n\nKeep earning those points and be ready when the prizes drop! 🦏✨"
            : "Prizes are being finalized behind the scenes... 🎁🤫\n\nNemwel is cooking something special — keep those points coming! 🦏";
        }
        const list = visible.map(p =>
          `🎁 **${p.name}**${p.amount ? ` — KES ${p.amount.toLocaleString()}` : ''}${p.description ? `\n   ${p.description}` : ''}`
        ).join('\n\n');
        return `Here's what's up for grabs! 🎉\n\n${list}\n\nThose prizes are waiting for the most consistent movers — it could be YOU! 🦏🏆`;
      }
      case 'winners': {
        const visible = winners.filter(w => w.isVisible);
        if (visible.length === 0) {
          return winners.length === 0
            ? "No winners have been announced yet! 🏅\n\nThe challenge is still going strong — keep logging and earning points. You could be the next champion! 💪🦏"
            : "Winners are being carefully reviewed... 👀\n\nNemwel is checking the results — stay tuned for the big announcement! 🦏";
        }
        const list = visible.map(w => `🥇 **${w.memberName}** — ${w.prizeCategoryName}`).join('\n');
        return `And the winners are... 🥁🥁🥁\n\n${list}\n\nMassive congratulations to all our champions! 🎉🦏`;
      }
      default:
        return "Hmm, I'm not sure about that one — but I'm always here to help! Pick one of the questions below. 🦏";
    }
  }

  // ── FAQ handler ───────────────────────────────────────────────────────────
  async function handleFAQ(faq: { id: string; label: string }) {
    if (thinking) return;
    if (faq.id === '__log__') { startLogFlow(); return; }
    setInputMode('none');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: faq.label }]);
    setThinking(true);
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 1000));
    setThinking(false);
    setMessages(prev => [...prev, { id: `b-${Date.now()}`, role: 'bot', text: getBotResponse(faq.id) }]);
    setInputMode('faqs');
  }

  // ── Log activity flow ─────────────────────────────────────────────────────

  async function startLogFlow() {
    if (thinking) return;
    setInputMode('none');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: '📝 Log an activity for me' }]);
    setThinking(true);

    const res = await fetch('/api/auth/member/me');
    const data = await res.json();
    setThinking(false);

    if (!data.member) {
      setMessages(prev => [...prev, {
        id: `b-${Date.now()}`, role: 'bot',
        text: "You need to be **logged in** to log an activity! 🔐\n\nHead over to the login page, sign in, and come back — I'll be right here waiting to help you log! 🦏",
      }]);
      setInputMode('login_prompt');
      return;
    }

    const firstName = data.member.name.split(' ')[0];
    setLogDraft({});
    setOptionals({ distance: '', duration: '', notes: '' });

    setMessages(prev => [...prev, {
      id: `b-${Date.now()}`, role: 'bot',
      text: `Let's do it, **${firstName}**! 💪\n\nWhat type of activity did you do?`,
    }]);
    setInputMode('activity_types');
  }

  function handleActivityType(type: ActivityType) {
    if (thinking) return;
    setLogDraft(d => ({ ...d, activityType: type }));
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: ACTIVITY_LABELS[type] }]);
    setInputMode('none');
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setMessages(prev => [...prev, {
        id: `b-${Date.now()}`, role: 'bot',
        text: `${ACTIVITY_LABELS[type]} — love it! 🔥\n\nWhen did you do this?`,
      }]);
      setInputMode('dates');
    }, 1000);
  }

  function handleDateSelect(date: string, label: string, sub: string) {
    if (thinking) return;
    const dateLabel = `${label} · ${sub}`;
    setLogDraft(d => ({ ...d, date, dateLabel }));
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: dateLabel }]);
    setInputMode('none');
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setMessages(prev => [...prev, {
        id: `b-${Date.now()}`, role: 'bot',
        text: "Got it! Want to add any extra details? All fields are optional — just tap **Continue** to skip them.",
      }]);
      setInputMode('optional_details');
    }, 900);
  }

  function handleOptionalDetails() {
    const dist  = optionals.distance.trim();
    const dur   = optionals.duration.trim();
    const notes = optionals.notes.trim();

    // Stage these in draft for the confirm step
    setLogDraft(d => ({
      ...d,
      distance: dist  || undefined,
      duration: dur   || undefined,
      notes:    notes || undefined,
    }));

    const parts: string[] = [];
    if (dist)  parts.push(`${dist} km`);
    if (dur)   parts.push(`${dur} min`);
    if (notes) parts.push(notes);
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`, role: 'user',
      text: parts.length ? parts.join(' · ') : 'No extra details',
    }]);
    setInputMode('none');
    setThinking(true);

    // Capture current draft values (activityType + date were set in earlier steps)
    const { activityType, dateLabel } = logDraft;
    setTimeout(() => {
      setThinking(false);
      const type     = activityType!;
      const category = ACTIVITY_CATEGORY_MAP[type];
      const pts      = ACTIVITY_POINTS[category];
      const details: string[] = [];
      if (dist)  details.push(`📏 **${dist} km**`);
      if (dur)   details.push(`⏱️ **${dur} min**`);
      if (notes) details.push(`📝 "${notes}"`);

      const preview = [
        'Here\'s what I\'m about to log for you:\n',
        `🏷️ **Activity:** ${ACTIVITY_LABELS[type]}`,
        `📅 **Date:** ${dateLabel}`,
        ...details,
        `⭐ **Points:** +${pts}`,
        '\nLooks good?',
      ].join('\n');

      setMessages(prev => [...prev, { id: `b-${Date.now()}`, role: 'bot', text: preview }]);
      setInputMode('preview_actions');
    }, 1000);
  }

  async function confirmLog() {
    if (thinking) return;
    setInputMode('none');
    setThinking(true);

    try {
      const res = await fetch('/api/member/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: logDraft.activityType,
          date:         logDraft.date,
          ...(logDraft.distance && { distance: parseFloat(logDraft.distance) }),
          ...(logDraft.duration && { duration: parseInt(logDraft.duration) }),
          ...(logDraft.notes    && { notes: logDraft.notes }),
        }),
      });
      const data = await res.json();
      setThinking(false);

      if (!res.ok) {
        setMessages(prev => [...prev, {
          id: `b-${Date.now()}`, role: 'bot',
          text: `Oops! **${data.error || 'Failed to log activity'}**\n\nWant to try again or start over?`,
        }]);
        setInputMode('preview_actions');
        return;
      }

      const pts = data.activity.points;
      setMessages(prev => [...prev, {
        id: `b-${Date.now()}`, role: 'bot',
        text: `Done! 🎉 **+${pts} point${pts !== 1 ? 's' : ''}** added to your total!\n\n${ACTIVITY_LABELS[logDraft.activityType!]} logged for ${logDraft.dateLabel}. It's showing up in your activity log right now! 🦏\n\nAnything else I can help with?`,
      }]);
      setLogDraft({});
      setOptionals({ distance: '', duration: '', notes: '' });
      setInputMode('faqs');
    } catch {
      setThinking(false);
      setMessages(prev => [...prev, {
        id: `b-${Date.now()}`, role: 'bot',
        text: "Hmm, couldn't connect right now. Please try again! 🦏",
      }]);
      setInputMode('preview_actions');
    }
  }

  function restartLogFlow() {
    setLogDraft({});
    setOptionals({ distance: '', duration: '', notes: '' });
    setMessages(prev => [...prev, {
      id: `b-${Date.now()}`, role: 'bot',
      text: "No worries — let's start fresh! What type of activity did you do?",
    }]);
    setInputMode('activity_types');
  }

  // ── Date options ──────────────────────────────────────────────────────────
  const today = todayUTC();
  const dateOptions = [
    { date: today,                label: 'Today',       sub: fmtDateLabel(today) },
    { date: shiftDays(today, -1), label: 'Yesterday',   sub: fmtDateLabel(shiftDays(today, -1)) },
    { date: shiftDays(today, -2), label: '2 days ago',  sub: fmtDateLabel(shiftDays(today, -2)) },
  ];

  // ── Hover helpers (inline style mutation) ────────────────────────────────
  function hoverGreen(e: React.MouseEvent<HTMLButtonElement>) {
    const b = e.currentTarget;
    b.style.background = '#f0fdf4'; b.style.borderColor = '#1a7a4a'; b.style.color = '#145c38';
  }
  function hoverReset(e: React.MouseEvent<HTMLButtonElement>, active = false) {
    const b = e.currentTarget;
    b.style.background = active ? '#f0fdf4' : 'white';
    b.style.borderColor = active ? '#1a7a4a' : '#e5e7eb';
    b.style.color = active ? '#145c38' : '#374151';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Chat window ──────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 20,
          width: 360, maxWidth: 'calc(100vw - 40px)',
          height: 570, maxHeight: 'calc(100vh - 120px)',
          background: 'white', borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          zIndex: 9999,
          animation: 'chatSlideUp 0.28s cubic-bezier(0.175,0.885,0.32,1.275)',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)',
            padding: '14px 16px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{
                width: 46, height: 46,
                background: 'rgba(255,255,255,0.18)', borderRadius: 13,
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
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
                fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
              }}
            >✕</button>
          </div>

          {/* Messages */}
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
                    background: 'linear-gradient(135deg,#145c38,#1a7a4a)', borderRadius: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, boxShadow: '0 2px 8px rgba(20,92,56,0.3)',
                  }}>🦏</div>
                )}
                <div style={{
                  maxWidth: '78%', padding: '10px 13px',
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
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, animation: 'msgFadeIn 0.3s ease' }}>
                <div style={{
                  width: 30, height: 30, flexShrink: 0,
                  background: 'linear-gradient(135deg,#145c38,#1a7a4a)', borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}>🦏</div>
                <div style={{
                  padding: '11px 15px', borderRadius: '16px 16px 16px 4px',
                  background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Nemwel is thinking</span>
                  <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 5, height: 5, background: '#1a7a4a', borderRadius: '50%', display: 'inline-block',
                        animation: `dotBounce 1.3s ${i * 0.22}s infinite ease-in-out`,
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── Bottom input panel ──────────────────────────────────── */}
          {!thinking && inputMode !== 'none' && (
            <div style={{ flexShrink: 0, background: 'white', borderTop: '1px solid #f3f4f6' }}>

              {/* FAQ pills */}
              {inputMode === 'faqs' && (
                <div style={{ padding: '10px 13px 13px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 }}>Quick questions</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {FAQS.map(faq => {
                      const isLog = faq.id === '__log__';
                      return (
                        <button
                          key={faq.id}
                          onClick={() => handleFAQ(faq)}
                          style={btnPill(isLog)}
                          onMouseOver={hoverGreen}
                          onMouseOut={e => hoverReset(e, isLog)}
                        >
                          {faq.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Activity type grid */}
              {inputMode === 'activity_types' && (
                <div style={{ padding: '10px 13px 13px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 }}>Pick your activity</div>
                  <div style={{ maxHeight: 190, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {ACTIVITY_TYPES.map(([type, label]) => (
                      <button
                        key={type}
                        onClick={() => handleActivityType(type)}
                        style={{
                          padding: '7px 10px', borderRadius: 10, border: '1.5px solid #e5e7eb',
                          background: 'white', color: '#374151', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}
                        onMouseOver={hoverGreen}
                        onMouseOut={e => hoverReset(e)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date picker */}
              {inputMode === 'dates' && (
                <div style={{ padding: '10px 13px 13px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 }}>When was it?</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {dateOptions.map(opt => (
                      <button
                        key={opt.date}
                        onClick={() => handleDateSelect(opt.date, opt.label, opt.sub)}
                        style={{
                          flex: 1, padding: '9px 6px', borderRadius: 12,
                          border: '1.5px solid #e5e7eb', background: 'white',
                          cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#1a7a4a'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional details */}
              {inputMode === 'optional_details' && (
                <div style={{ padding: '10px 13px 13px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Extra details — all optional</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Distance (km)</label>
                      <input
                        type="number" min="0" step="0.1" placeholder="e.g. 5.2"
                        value={optionals.distance}
                        onChange={e => setOptionals(o => ({ ...o, distance: e.target.value }))}
                        style={inp}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Duration (min)</label>
                      <input
                        type="number" min="1" step="1" placeholder="e.g. 30"
                        value={optionals.duration}
                        onChange={e => setOptionals(o => ({ ...o, duration: e.target.value }))}
                        style={inp}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Notes</label>
                    <input
                      type="text" placeholder="e.g. morning run with the team…"
                      value={optionals.notes}
                      onChange={e => setOptionals(o => ({ ...o, notes: e.target.value }))}
                      style={inp}
                      onKeyDown={e => e.key === 'Enter' && handleOptionalDetails()}
                    />
                  </div>
                  <button
                    onClick={handleOptionalDetails}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 10,
                      background: 'linear-gradient(135deg,#1a7a4a,#145c38)',
                      color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                    }}
                  >
                    Continue →
                  </button>
                </div>
              )}

              {/* Preview confirmation */}
              {inputMode === 'preview_actions' && (
                <div style={{ padding: '10px 13px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <button
                    onClick={confirmLog}
                    style={{
                      padding: '11px', borderRadius: 10,
                      background: 'linear-gradient(135deg,#1a7a4a,#145c38)',
                      color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                    }}
                  >
                    ✅ Yes, log it!
                  </button>
                  <button
                    onClick={restartLogFlow}
                    style={{
                      padding: '9px', borderRadius: 10, background: 'white',
                      color: '#6b7280', fontWeight: 600, fontSize: 13,
                      border: '1.5px solid #e5e7eb', cursor: 'pointer',
                    }}
                  >
                    🔄 Start over
                  </button>
                </div>
              )}

              {/* Login prompt */}
              {inputMode === 'login_prompt' && (
                <div style={{ padding: '10px 13px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <a
                    href="/authenticate"
                    style={{
                      display: 'block', padding: '11px', borderRadius: 10, textAlign: 'center',
                      background: 'linear-gradient(135deg,#1a7a4a,#145c38)',
                      color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none',
                    }}
                  >
                    🔐 Go to Login
                  </a>
                  <button
                    onClick={() => setInputMode('faqs')}
                    style={{
                      padding: '8px', borderRadius: 10, background: 'white',
                      color: '#6b7280', fontWeight: 600, fontSize: 12,
                      border: '1.5px solid #e5e7eb', cursor: 'pointer',
                    }}
                  >
                    Back to questions
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* ── "Chat with me" hint ───────────────────────────────────────── */}
      {!open && showHint && (
        <div style={{
          position: 'fixed', bottom: 98, right: 18,
          background: 'white', padding: '7px 13px', borderRadius: 20,
          boxShadow: '0 4px 18px rgba(0,0,0,0.13)',
          fontSize: 12, fontWeight: 700, color: '#145c38',
          border: '1.5px solid #d1fae5', whiteSpace: 'nowrap',
          zIndex: 9998, animation: 'hintSlideIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
          pointerEvents: 'none',
        }}>
          💬 Chat with Nemwel!
          <span style={{
            position: 'absolute', bottom: -7, right: 18,
            width: 13, height: 13, background: 'white',
            transform: 'rotate(45deg)',
            borderRight: '1.5px solid #d1fae5', borderBottom: '1.5px solid #d1fae5',
          }} />
        </div>
      )}

      {/* ── Floating trigger ──────────────────────────────────────────── */}
      <button
        onClick={() => { setOpen(o => !o); setShowHint(false); }}
        title="Chat with Nemwel 🦏"
        style={{
          position: 'fixed', bottom: 20, right: 20,
          width: 62, height: 62, borderRadius: '50%',
          background: open
            ? 'linear-gradient(135deg,#374151,#1f2937)'
            : 'linear-gradient(135deg,#145c38 0%,#1a7a4a 60%,#f26522 100%)',
          border: 'none', cursor: 'pointer',
          fontSize: open ? 22 : 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(20,92,56,0.55)',
          zIndex: 10000,
          transition: 'transform 0.2s, box-shadow 0.2s, background 0.3s',
          animation: open ? 'none' : 'rhinoPulse 2.5s infinite',
          color: 'white', fontWeight: 900,
        }}
        onMouseOver={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = open ? '0 8px 28px rgba(0,0,0,0.4)' : '0 8px 28px rgba(20,92,56,0.65)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = open ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(20,92,56,0.55)';
        }}
      >
        {open ? '✕' : '🦏'}
      </button>

      {/* ── Animations ────────────────────────────────────────────────── */}
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

'use client';
import { useState, useRef, useEffect } from 'react';
import {
  PrizeCategory, Winner,
  ActivityType, ACTIVITY_LABELS, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS,
  CHALLENGE_CATEGORY_LABELS, CHALLENGE_PERIOD_LABELS, CHALLENGE_CATEGORY_ACTIVITY_TYPES, ChallengeCategory,
} from '@/types';
import { actorInit } from '@/lib/actorClient';
import { FeaturedChallenge, FeaturedViewer, challengeHref, featuredFacilitators } from '@/components/challenges/FeaturedChallenges';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMsg { id: string; role: 'user' | 'bot'; text: string; }
interface LogDraft {
  activityType?: ActivityType;
  date?: string;
  dateLabel?: string;
  distance?: string;
  duration?: string;
  steps?: string;
  notes?: string;
  // Set when the log flow was started from a featured challenge: the activity gets tagged to it.
  challenge?: { id: string; title: string; category: ChallengeCategory; startDate: string; endDate: string };
}
interface PastChallenge {
  id: string; title: string; startDate: string; endDate: string; goalKm: number; participantCount: number;
  podium: { rank: number; memberName: string; progressKm: number; percentage: number }[];
}
interface Peer { id: string; name: string; }
type InputMode =
  | 'faqs'
  | 'activity_types'
  | 'dates'
  | 'optional_details'
  | 'preview_actions'
  | 'login_prompt'
  | 'challenge_list'
  | 'challenge_actions'
  | 'challenge_join_confirm'
  | 'challenge_invite'
  | 'none';

// ── Constants ──────────────────────────────────────────────────────────────────
const FAQS = [
  { id: 'what_is',      label: '🦏 What is PaceTracker?' },
  { id: 'log_activity', label: '➕ How do I log an activity?' },
  { id: 'log_challenge', label: '🎯 How do I log for a challenge?' },
  { id: 'points',       label: '⭐ How do points work?' },
  { id: 'tiers',        label: '🏅 What are the tiers?' },
  { id: 'gifts',        label: '🎁 What gifts are there?' },
  { id: 'winners',      label: '🥇 Any winners yet?' },
  { id: '__challenges__', label: '🏁 Featured challenges' },
  { id: '__past__',     label: '🏆 Past challenge winners' },
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
function fmtShort(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function plural(n: number, word: string) { return `${n} ${word}${n === 1 ? '' : 's'}`; }
function people(n: number) { return `${n} ${n === 1 ? 'person' : 'people'}`; }
const MEDALS = ['🥇', '🥈', '🥉'];

function challengeTiming(c: FeaturedChallenge) {
  return c.upcoming ? `starts in ${plural(c.daysUntilStart, 'day')}` : `${plural(c.daysRemaining, 'day')} left`;
}

// The viewer's own line: where they stand, or how to get in.
function standingText(c: FeaturedChallenge, viewer: FeaturedViewer | null) {
  if (!viewer) return '🔐 **Log in** to join and see where you stand.';
  if (c.me) {
    if (c.upcoming) return `✅ **You're in!** It kicks off on **${fmtShort(c.startDate)}**. Tag your activities to it from then on.`;
    const left = c.me.remainingKm > 0 ? `**${c.me.remainingKm} km to go**` : '🏁 **Goal reached!**';
    const pace = c.me.onPace ? '✅ You\'re on pace' : `⏳ A bit behind pace (${c.me.expectedKm} km expected by now)`;
    return `📍 **You're #${c.me.rank} of ${c.participantCount}**\n🏃 ${c.me.km} / ${c.goalKm} km (${c.me.percentage}%) · ${left}\n${pace}`;
  }
  if (c.invited) return '📩 You\'ve been **invited** to this one. Want to join?';
  return '🙌 You haven\'t joined yet. Want in?';
}

function describeChallenge(c: FeaturedChallenge, viewer: FeaturedViewer | null) {
  return [
    `⭐ **${c.title}**`,
    ...(c.description ? [c.description, ''] : []),
    `🏷️ ${CHALLENGE_CATEGORY_LABELS[c.category]} · ${CHALLENGE_PERIOD_LABELS[c.period]}`,
    `📆 ${fmtShort(c.startDate)} – ${fmtShort(c.endDate)} (${challengeTiming(c)})`,
    `🎯 Goal: **${c.goalKm} km** each`,
    `👥 **${people(c.participantCount)}** joined so far`,
    c.coFacilitators?.length ? `🤝 Facilitated by **${featuredFacilitators(c)}**` : `🧑‍💼 Created by **${c.ownerName}**`,
    `💬 Questions? Reach out to ${c.coFacilitators?.length ? 'any of them' : 'them'}.`,
    '',
    standingText(c, viewer),
  ].join('\n');
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
  const [optionals, setOptionals]   = useState({ distance: '', duration: '', steps: '', notes: '' });
  const [featured, setFeatured]     = useState<FeaturedChallenge[]>([]);
  const [featViewer, setFeatViewer] = useState<FeaturedViewer | null>(null);
  const [activeChal, setActiveChal] = useState<FeaturedChallenge | null>(null);
  const [peers, setPeers]           = useState<Peer[]>([]);
  const [inviteIds, setInviteIds]   = useState<string[]>([]);
  const [peerQuery, setPeerQuery]   = useState('');
  const [loginNext, setLoginNext]   = useState('/member');
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
        return "Logging an activity is super easy!\n\n1️⃣ Click the **➕ Log Activity** tab\n2️⃣ Choose your activity type\n3️⃣ Pick the date\n4️⃣ Optionally add distance / duration\n5️⃣ In a challenge? Under **🏁 Is this for a challenge?** tap **Yes, count it 🎯** and pick it\n6️⃣ Hit **Log Activity** — done! ✅\n\n💡 Or just tap **📝 Log an activity for me** below and I'll walk you through it! 🦏";
      case 'log_challenge':
        return "To make an activity count toward a challenge like **Project 50**:\n\n1️⃣ **Join it first.** Tap **🏁 Featured challenges** below, or open the **Challenges** tab\n2️⃣ Log a **run, walk or hike** (or a **ride** for cycling challenges)\n3️⃣ Add the **distance (km)**, it's required for challenges\n4️⃣ Under **🏁 Is this for a challenge?** tap **Yes, count it 🎯** and pick the challenge\n5️⃣ Hit **Log Activity** ✅\n\n⚠️ Activities you don't tag won't count, and the date has to fall inside the challenge dates.\n\n💡 Tap **📝 Log an activity for me** below and I'll ask about your challenges for you! 🦏";
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
    if (faq.id === '__challenges__') { startChallengesFlow(faq.label); return; }
    if (faq.id === '__past__') { showPastChallenges(faq.label); return; }
    setInputMode('none');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: faq.label }]);
    setThinking(true);
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 1000));
    setThinking(false);
    setMessages(prev => [...prev, { id: `b-${Date.now()}`, role: 'bot', text: getBotResponse(faq.id) }]);
    setInputMode('faqs');
  }

  // ── Featured challenges flow ──────────────────────────────────────────────
  function say(text: string) { setMessages(prev => [...prev, { id: `b-${Date.now()}-${Math.random()}`, role: 'bot', text }]); }
  function echo(text: string) { setMessages(prev => [...prev, { id: `u-${Date.now()}-${Math.random()}`, role: 'user', text }]); }
  const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Always refetched, so challenges that ended or were unfeatured since last time drop out on their own.
  async function loadFeatured(): Promise<{ list: FeaturedChallenge[]; viewer: FeaturedViewer | null } | null> {
    try {
      const d = await (await fetch('/api/challenges/featured')).json();
      const list: FeaturedChallenge[] = d.featured || [];
      setFeatured(list); setFeatViewer(d.viewer ?? null);
      return { list, viewer: d.viewer ?? null };
    } catch { return null; }
  }

  async function startChallengesFlow(label = '🏁 Featured challenges') {
    if (thinking) return;
    setInputMode('none');
    echo(label);
    setThinking(true);
    const [data] = await Promise.all([loadFeatured(), pause(900)]);
    setThinking(false);
    if (!data) { say("Hmm, couldn't load the challenges right now. Please try again! 🦏"); setInputMode('faqs'); return; }
    if (data.list.length === 0) {
      say("There are no featured challenges running right now. 🏁\n\nKeep an eye out, new ones pop up here and on the main page! You can also create your own from the **Challenges** tab. 🦏");
      setInputMode('faqs');
      return;
    }
    const lines = data.list.map(c => `⭐ **${c.title}** (${challengeTiming(c)}, ${people(c.participantCount)} in)`);
    say(`Here ${data.list.length === 1 ? "is what's" : "are the challenges"} featured right now:\n\n${lines.join('\n')}\n\nTap one to learn more! 👇`);
    setInputMode('challenge_list');
  }

  async function selectChallenge(c: FeaturedChallenge) {
    if (thinking) return;
    setInputMode('none');
    echo(c.title);
    setActiveChal(c);
    setThinking(true);
    await pause(800);
    setThinking(false);
    say(describeChallenge(c, featViewer));
    setInputMode('challenge_actions');
  }

  function askJoin() {
    if (!activeChal) return;
    echo('➕ Join this challenge');
    say(`Join **${activeChal.title}**? 🎯\n\nOnly activities **with a distance** that you tag to this challenge when logging will count${activeChal.upcoming ? `, starting **${fmtShort(activeChal.startDate)}**` : ''}. They still earn your normal points on the main leaderboard too.`);
    setInputMode('challenge_join_confirm');
  }

  async function confirmJoin() {
    if (!activeChal || thinking) return;
    const target = activeChal;
    echo('✅ Yes, join');
    setInputMode('none');
    setThinking(true);
    try {
      const res = await fetch(`/api/member/challenges/${target.id}/join`, actorInit(featViewer?.isAdmin, { method: 'POST' }));
      const d = await res.json();
      if (!res.ok) {
        setThinking(false);
        say(`Oops! **${d.error || 'Could not join'}** 🦏`);
        setInputMode('challenge_actions');
        return;
      }
      const data = await loadFeatured();
      setThinking(false);
      const updated = data?.list.find(x => x.id === target.id) ?? target;
      setActiveChal(updated);
      say(`You're in! 🎉 Welcome to **${updated.title}**.\n\n${standingText(updated, data?.viewer ?? featViewer)}\n\n💡 When you log a ${updated.category === 'cycling' ? 'ride' : 'run, walk or hike'}, add the distance and pick this challenge so it counts.`);
      setInputMode('challenge_actions');
    } catch {
      setThinking(false);
      say("Hmm, couldn't connect right now. Please try again! 🦏");
      setInputMode('challenge_actions');
    }
  }

  async function startInvite() {
    if (!activeChal || thinking) return;
    echo('📩 Invite people');
    setInputMode('none');
    setThinking(true);
    try {
      const d = await (await fetch('/api/member/peers', actorInit(featViewer?.isAdmin))).json();
      setPeers(d.peers || []);
    } catch { setPeers([]); }
    setThinking(false);
    setInviteIds([]); setPeerQuery('');
    say(`Who would you like to invite to **${activeChal.title}**? Search below and pick as many as you like. They'll get an invite they can accept from their Challenges page. 📩`);
    setInputMode('challenge_invite');
  }

  async function sendChallengeInvites() {
    if (!activeChal || inviteIds.length === 0 || thinking) return;
    const names = inviteIds.map(id => peers.find(p => p.id === id)?.name).filter(Boolean);
    echo(`Invite ${names.join(', ')}`);
    setInputMode('none');
    setThinking(true);
    try {
      const res = await fetch(`/api/member/challenges/${activeChal.id}/invite`, actorInit(featViewer?.isAdmin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds: inviteIds }) }));
      const d = await res.json();
      setThinking(false);
      if (!res.ok) { say(`Oops! **${d.error || 'Could not send invites'}** 🦏`); setInputMode('challenge_actions'); return; }
      const skipped = (d.skipped as { memberId: string; reason: string }[]).map(x => `${peers.find(p => p.id === x.memberId)?.name ?? 'Someone'} (${x.reason})`);
      say(`📩 Sent **${plural(d.invited.length, 'invite')}**!${skipped.length ? `\n\nSkipped: ${skipped.join(', ')}.` : ''}`);
      setInviteIds([]);
      setInputMode('challenge_actions');
    } catch {
      setThinking(false);
      say("Hmm, couldn't connect right now. Please try again! 🦏");
      setInputMode('challenge_actions');
    }
  }

  function challengeLogin() {
    if (!activeChal) return;
    setLoginNext(`/member/challenges/${activeChal.id}`);
    echo('🔐 Log in to join');
    say(`Log in (or create an account, it takes a minute) and I'll take you straight to **${activeChal.title}** so you can join. 🦏`);
    setInputMode('login_prompt');
  }

  async function showPastChallenges(label = '🏆 Past challenge winners') {
    if (thinking) return;
    setInputMode('none');
    echo(label);
    setThinking(true);
    let past: PastChallenge[] | null = null;
    try {
      const [res] = await Promise.all([fetch('/api/challenges/featured?past=1'), pause(900)]);
      past = (await res.json()).past || [];
    } catch { past = null; }
    setThinking(false);
    if (!past) { say("Hmm, couldn't load past challenges right now. Please try again! 🦏"); setInputMode('faqs'); return; }
    if (past.length === 0) {
      say("No featured challenge has finished yet, so no champions to crown... **yet**! 👑\n\nTap **🏁 Featured challenges** to jump into one that's running. 🦏");
      setInputMode('faqs');
      return;
    }
    const blocks = past.slice(0, 5).map(c => {
      const podium = c.podium.length
        ? c.podium.map((e, i) => `${MEDALS[i]} **${e.memberName}** · ${e.progressKm} km`).join('\n')
        : 'No distance logged, so no winner.';
      return `🏁 **${c.title}**\n${fmtShort(c.startDate)} – ${fmtShort(c.endDate)} · 🎯 ${c.goalKm} km · 👥 ${c.participantCount}\n${podium}`;
    });
    say(`Here's the hall of fame! 🏆\n\n${blocks.join('\n\n')}\n\nCongrats to all the finishers! 🎉🦏`);
    setInputMode('faqs');
  }

  // ── Log activity flow ─────────────────────────────────────────────────────

  async function startLogFlow(challenge?: LogDraft['challenge']) {
    if (thinking) return;
    setInputMode('none');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: challenge ? `📝 Log an activity for ${challenge.title}` : '📝 Log an activity for me' }]);
    setThinking(true);

    const res = await fetch('/api/auth/member/me');
    const data = await res.json();
    setThinking(false);

    if (!data.member) {
      setMessages(prev => [...prev, {
        id: `b-${Date.now()}`, role: 'bot',
        text: "You need to be **logged in** to log an activity! 🔐\n\nHead over to the login page, sign in, and come back — I'll be right here waiting to help you log! 🦏",
      }]);
      setLoginNext('/member');
      setInputMode('login_prompt');
      return;
    }

    const firstName = data.member.name.split(' ')[0];
    setLogDraft(challenge ? { challenge } : {});
    setOptionals({ distance: '', duration: '', steps: '', notes: '' });

    setMessages(prev => [...prev, {
      id: `b-${Date.now()}`, role: 'bot',
      text: challenge
        ? `Let's do it, **${firstName}**! 💪 This one counts toward **${challenge.title}**.\n\nWhat did you do?`
        : `Let's do it, **${firstName}**! 💪\n\nWhat type of activity did you do?`,
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
    if (logDraft.challenge && !(parseFloat(dist) > 0)) {
      say(`Add a **distance (km)** so it counts toward **${logDraft.challenge.title}**! 📏`);
      return;
    }
    const dur   = optionals.duration.trim();
    const stps  = optionals.steps.trim();
    const notes = optionals.notes.trim();

    setLogDraft(d => ({
      ...d,
      distance: dist  || undefined,
      duration: dur   || undefined,
      steps:    stps  || undefined,
      notes:    notes || undefined,
    }));

    const parts: string[] = [];
    if (dist)  parts.push(`${dist} km`);
    if (dur)   parts.push(`${dur} min`);
    if (stps)  parts.push(`${parseInt(stps).toLocaleString()} steps`);
    if (notes) parts.push(notes);
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`, role: 'user',
      text: parts.length ? parts.join(' · ') : 'No extra details',
    }]);
    setInputMode('none');
    setThinking(true);

    const { activityType, dateLabel } = logDraft;
    setTimeout(() => {
      setThinking(false);
      const type     = activityType!;
      const category = ACTIVITY_CATEGORY_MAP[type];
      const pts      = ACTIVITY_POINTS[category];
      const details: string[] = [];
      if (dist)  details.push(`📏 **${dist} km**`);
      if (dur)   details.push(`⏱️ **${dur} min**`);
      if (stps)  details.push(`👣 **${parseInt(stps).toLocaleString()} steps**`);
      if (notes) details.push(`📝 "${notes}"`);
      if (logDraft.challenge) details.push(`🏁 **Challenge:** ${logDraft.challenge.title}`);

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
          ...(logDraft.steps    && { steps: parseInt(logDraft.steps) }),
          ...(logDraft.notes    && { notes: logDraft.notes }),
          ...(logDraft.challenge && { challengeIds: [logDraft.challenge.id] }),
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
        text: `Done! 🎉 **+${pts} point${pts !== 1 ? 's' : ''}** added to your total!\n\n${ACTIVITY_LABELS[logDraft.activityType!]} logged for ${logDraft.dateLabel}. It's showing up in your activity log right now! 🦏${logDraft.challenge ? `\n\n🏁 **${logDraft.distance} km** counted toward **${logDraft.challenge.title}**. Tap **🏁 Featured challenges** to see your new position!` : ''}\n\nAnything else I can help with?`,
      }]);
      setLogDraft({});
      setOptionals({ distance: '', duration: '', steps: '', notes: '' });
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
    setLogDraft(d => (d.challenge ? { challenge: d.challenge } : {}));
    setOptionals({ distance: '', duration: '', steps: '', notes: '' });
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
  ].filter(o => !logDraft.challenge || (o.date >= logDraft.challenge.startDate && o.date <= logDraft.challenge.endDate));
  const activityChoices = logDraft.challenge
    ? ACTIVITY_TYPES.filter(([type]) => CHALLENGE_CATEGORY_ACTIVITY_TYPES[logDraft.challenge!.category].includes(type))
    : ACTIVITY_TYPES;
  const peerResults = peers
    .filter(p => !inviteIds.includes(p.id) && (!peerQuery.trim() || p.name.toLowerCase().includes(peerQuery.trim().toLowerCase())))
    .slice(0, 30);

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
                    {activityChoices.map(([type, label]) => (
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
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{logDraft.challenge ? 'Distance is required for the challenge' : 'Extra details — all optional'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Distance (km){logDraft.challenge ? ' *' : ''}</label>
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
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Steps 👣</label>
                    <input
                      type="number" min="0" step="1" placeholder="e.g. 8000"
                      value={optionals.steps}
                      onChange={e => setOptionals(o => ({ ...o, steps: e.target.value }))}
                      style={inp}
                    />
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

              {/* Featured challenge picker */}
              {inputMode === 'challenge_list' && (
                <div style={{ padding: '10px 13px 13px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 }}>Pick a challenge</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 190, overflowY: 'auto' }}>
                    {featured.map(c => (
                      <button key={c.id} onClick={() => selectChallenge(c)} style={{ ...btnPill(), borderRadius: 12, textAlign: 'left', whiteSpace: 'normal', padding: '8px 12px' }} onMouseOver={hoverGreen} onMouseOut={e => hoverReset(e)}>
                        ⭐ {c.title}{c.joined ? ' · ✅ joined' : ''}
                      </button>
                    ))}
                    <button onClick={() => setInputMode('faqs')} style={{ ...btnPill(), borderRadius: 12, color: '#6b7280' }}>Back to questions</button>
                  </div>
                </div>
              )}

              {/* Actions for the selected challenge */}
              {inputMode === 'challenge_actions' && activeChal && (
                <div style={{ padding: '10px 13px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {!featViewer && (
                    <button onClick={challengeLogin} style={{ padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,#f26522,#e0551a)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>🔐 Log in to join</button>
                  )}
                  {activeChal.canJoin && (
                    <button onClick={askJoin} style={{ padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,#f26522,#e0551a)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>{activeChal.invited ? '✓ Accept invite & join' : '➕ Join this challenge'}</button>
                  )}
                  {activeChal.joined && !activeChal.upcoming && !featViewer?.isAdmin && (
                    <button
                      onClick={() => startLogFlow({ id: activeChal.id, title: activeChal.title, category: activeChal.category, startDate: activeChal.startDate, endDate: activeChal.endDate })}
                      style={{ padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,#1a7a4a,#145c38)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}
                    >📝 Log an activity for this challenge</button>
                  )}
                  {activeChal.canInvite && (
                    <button onClick={startInvite} style={{ padding: '9px', borderRadius: 10, background: 'white', color: '#145c38', fontWeight: 700, fontSize: 13, border: '1.5px solid #1a7a4a', cursor: 'pointer' }}>📩 Invite people</button>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {featViewer && <a href={challengeHref(activeChal.id, featViewer)} style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'white', color: '#374151', fontWeight: 600, fontSize: 12, border: '1.5px solid #e5e7eb', textAlign: 'center', textDecoration: 'none' }}>🔗 Open page</a>}
                    {featured.length > 1 && <button onClick={() => setInputMode('challenge_list')} style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 12, border: '1.5px solid #e5e7eb', cursor: 'pointer' }}>← Other challenges</button>}
                    <button onClick={() => setInputMode('faqs')} style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 12, border: '1.5px solid #e5e7eb', cursor: 'pointer' }}>Questions</button>
                  </div>
                </div>
              )}

              {/* Join confirmation */}
              {inputMode === 'challenge_join_confirm' && (
                <div style={{ padding: '10px 13px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <button onClick={confirmJoin} style={{ padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,#1a7a4a,#145c38)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>✅ Yes, join</button>
                  <button onClick={() => { echo('Not now'); setInputMode('challenge_actions'); }} style={{ padding: '9px', borderRadius: 10, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 13, border: '1.5px solid #e5e7eb', cursor: 'pointer' }}>Not now</button>
                </div>
              )}

              {/* Invite people (owner / admin only) */}
              {inputMode === 'challenge_invite' && (
                <div style={{ padding: '10px 13px 13px' }}>
                  {inviteIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                      {inviteIds.map(id => (
                        <span key={id} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#14532d', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                          {peers.find(p => p.id === id)?.name}
                          <button onClick={() => setInviteIds(ids => ids.filter(x => x !== id))} style={{ background: 'none', border: 'none', color: '#1a7a4a', cursor: 'pointer', fontWeight: 900, marginLeft: 3, padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input value={peerQuery} onChange={e => setPeerQuery(e.target.value)} placeholder="Search people…" style={{ ...inp, marginBottom: 6 }} />
                  <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: 8, marginBottom: 8 }}>
                    {peerResults.length === 0
                      ? <div style={{ padding: 10, fontSize: 12, color: '#9ca3af' }}>No matches</div>
                      : peerResults.map(p => (
                        <button key={p.id} onClick={() => { setInviteIds(ids => [...ids, p.id]); setPeerQuery(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 12, background: 'white', border: 'none', borderBottom: '1px solid #fafafa', cursor: 'pointer', color: '#374151' }}>
                          + {p.name}
                        </button>
                      ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={sendChallengeInvites} disabled={inviteIds.length === 0} style={{ flex: 2, padding: '10px', borderRadius: 10, background: inviteIds.length === 0 ? '#9ca3af' : 'linear-gradient(135deg,#1a7a4a,#145c38)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: inviteIds.length === 0 ? 'not-allowed' : 'pointer' }}>
                      📩 Send {inviteIds.length > 0 ? plural(inviteIds.length, 'invite') : 'invites'}
                    </button>
                    <button onClick={() => setInputMode('challenge_actions')} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 12, border: '1.5px solid #e5e7eb', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Login prompt */}
              {inputMode === 'login_prompt' && (
                <div style={{ padding: '10px 13px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <a
                    href={loginNext === '/member' ? '/authenticate' : `/authenticate?next=${encodeURIComponent(loginNext)}`}
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

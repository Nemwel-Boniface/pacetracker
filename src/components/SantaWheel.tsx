'use client';
import { useEffect, useRef, useState } from 'react';

// The Secret Santa reveal wheel. The partner is already known before the spin: the wheel picks a handful of
// names from the list, slips the partner in at a random slot, then works out the exact angle that brings that
// slot under the pointer. It looks random to the person spinning, but always lands on the right name.

export interface WheelName { id: string; name: string; }

const SLICE_COLORS = ['#145c38', '#f26522', '#1a7a4a', '#dc2626', '#0f766e', '#ea580c'];
const MAX_SLICES = 14;
const FULL_TURNS = 7;
const R = 150;

let audio: AudioContext | null = null;
// Browsers only allow sound that starts from a tap, so the page calls this inside the Spin button's click.
export function unlockWheelAudio() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    audio?.resume();
  } catch { /* no sound, the wheel still works */ }
}
function tick() {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = 1400;
  gain.gain.setValueAtTime(0.06, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.04);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.05);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function label(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > 11 ? `${first.slice(0, 10)}…` : first;
}
// Angles run clockwise from the top, where the pointer sits.
function point(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
}

export default function SantaWheel({ pool, target, spinning, durationMs, muted, onDone }: {
  pool: WheelName[]; target: WheelName; spinning: boolean; durationMs: number; muted: boolean; onDone: () => void;
}) {
  // Picked once per mount, so "Spin again" (a remount) gets a fresh mix of names.
  const [slices] = useState(() => {
    const others = shuffle(pool.filter(p => p.id !== target.id)).slice(0, MAX_SLICES - 1);
    const at = Math.floor(Math.random() * (others.length + 1));
    return [...others.slice(0, at), target, ...others.slice(at)];
  });
  const seg = 360 / slices.length;
  const targetIndex = slices.findIndex(s => s.id === target.id);
  // Where the wheel comes to rest: several full turns, then back to the partner's slot. It lands somewhere
  // inside the slice rather than dead centre, so it doesn't look staged.
  const [finalRotation] = useState(() => 360 * FULL_TURNS - (targetIndex + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6);
  const rotation = spinning ? finalRotation : 0;
  const [landed, setLanded] = useState(false);
  const wheelRef = useRef<SVGGElement>(null);
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (!spinning) return;
    // Follow the wheel while it turns and tick each time a new name passes the pointer.
    let frame = 0, last = -1;
    const watch = () => {
      const el = wheelRef.current;
      if (el) {
        const m = getComputedStyle(el).transform;
        const v = m && m !== 'none' ? m.slice(m.indexOf('(') + 1, -1).split(',').map(Number) : [1, 0];
        const angle = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
        const under = Math.floor((((360 - angle) % 360) + 360) % 360 / seg);
        if (last !== -1 && under !== last && !mutedRef.current) tick();
        last = under;
      }
      frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(frame);
  }, [spinning, seg, targetIndex]);

  function finished() {
    setLanded(true);
    onDone();
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 320, margin: '0 auto', aspectRatio: '1 / 1' }}>
      <svg viewBox="-160 -170 320 330" style={{ width: '100%', height: '100%', overflow: 'visible' }} aria-label="Secret Santa wheel">
        <circle r={R + 8} fill="#145c38" />
        <g
          ref={wheelRef}
          onTransitionEnd={finished}
          style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${durationMs}ms cubic-bezier(0.12, 0.65, 0.08, 1)` : 'none' }}
        >
          {slices.map((s, i) => {
            const [x1, y1] = point(i * seg, R);
            const [x2, y2] = point((i + 1) * seg, R);
            const won = landed && i === targetIndex;
            // Names on the left half are turned the other way so none read upside down.
            return (
              <g key={s.id} opacity={landed && !won ? 0.45 : 1}>
                <path d={`M0,0 L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z`} fill={won ? '#facc15' : SLICE_COLORS[i % SLICE_COLORS.length]} stroke="white" strokeWidth={1.5} />
                <text
                  transform={`rotate(${(i + 0.5) * seg}) translate(0 ${-R * 0.56}) rotate(${(i + 0.5) * seg > 180 ? 90 : -90})`}
                  textAnchor="middle" dominantBaseline="central"
                  fill={won ? '#145c38' : 'white'} fontSize={12} fontWeight={800}
                >{label(s.name)}</text>
              </g>
            );
          })}
        </g>
        <circle r={26} fill="white" stroke="#facc15" strokeWidth={4} />
        <text textAnchor="middle" dominantBaseline="central" fontSize={24}>🎅</text>
        <path d="M-14,-166 L14,-166 L0,-136 Z" fill="#facc15" stroke="#145c38" strokeWidth={3} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// A burst of falling festive emoji for the reveal moment.
export function Confetti() {
  const [bits] = useState(() => Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.6,
    emoji: ['🎉', '🎁', '✨', '🎄', '⭐'][i % 5], size: 14 + Math.random() * 14,
  })));
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}>
      <style>{'@keyframes yef-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(105vh) rotate(540deg); opacity: 0.2; } }'}</style>
      {bits.map((b, i) => (
        <span key={i} style={{ position: 'absolute', top: 0, left: `${b.left}%`, fontSize: b.size, animation: `yef-fall ${b.dur}s ease-in ${b.delay}s forwards`, transform: 'translateY(-10vh)' }}>{b.emoji}</span>
      ))}
    </div>
  );
}

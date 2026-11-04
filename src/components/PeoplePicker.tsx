'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface PickerPerson { id: string; name: string; avatarInitials?: string; hint?: string; }

function initials(p: PickerPerson): string {
  return p.avatarInitials || p.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function Bubble({ person, size, bg }: { person: PickerPerson; size: number; bg: string }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: bg, color: 'white', fontSize: size * 0.38, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initials(person)}
    </span>
  );
}

// Matches every word of the query against the start of any word in the name, so "jo mw" finds "John Mwangi".
function matches(name: string, query: string): boolean {
  const words = name.toLowerCase().split(/\s+/);
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(q => words.some(w => w.startsWith(q)) || name.toLowerCase().includes(q));
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onOutside(); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);
  return ref;
}

const box = { display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 6, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 10, background: 'white', minHeight: 42, boxSizing: 'border-box' as const, cursor: 'text' };
const menu = { position: 'absolute' as const, top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 240, overflowY: 'auto' as const, marginTop: 4 };
const searchInput = { flex: 1, minWidth: 120, border: 'none', outline: 'none', fontSize: 13, padding: '4px 2px', background: 'transparent' };

// Searchable multi-select with removable chips. Type to filter; Enter picks the top match.
export default function PeoplePicker({ people, selected, onChange, placeholder = 'Search people…', emptyText = 'No one else available', accent = '#1a7a4a' }: {
  people: PickerPerson[]; selected: string[]; onChange: (ids: string[]) => void; placeholder?: string; emptyText?: string; accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useClickOutside(useMemo(() => () => setOpen(false), []));

  const selectedPeople = selected.map(id => people.find(p => p.id === id)).filter(Boolean) as PickerPerson[];
  const results = people.filter(p => !selected.includes(p.id) && (!query.trim() || matches(p.name, query)));

  function add(id: string) { onChange([...selected, id]); setQuery(''); inputRef.current?.focus(); }
  function remove(id: string) { onChange(selected.filter(x => x !== id)); }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={box} onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
        {selectedPeople.map(p => (
          <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 8px 2px 3px', fontSize: 12, fontWeight: 600, color: '#14532d' }}>
            <Bubble person={p} size={18} bg={accent} />
            {p.name}
            <button type="button" aria-label={`Remove ${p.name}`} onClick={e => { e.stopPropagation(); remove(p.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
          </span>
        ))}
        <input
          ref={inputRef} value={query} placeholder={selectedPeople.length ? 'Add more…' : placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); if (results[0]) add(results[0].id); }
            else if (e.key === 'Backspace' && !query && selected.length) remove(selected[selected.length - 1]);
            else if (e.key === 'Escape') setOpen(false);
          }}
          style={searchInput}
        />
      </div>
      {open && (
        <div style={menu}>
          {results.length === 0 ? (
            <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>{query.trim() ? `No one matches "${query.trim()}"` : emptyText}</div>
          ) : results.map(p => (
            <div key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => add(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #fafafa' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')} onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              <Bubble person={p} size={26} bg="#9ca3af" />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{p.name}</span>
              {p.hint && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>{p.hint}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Searchable single-select (e.g. picking which member an admin is logging for).
export function PersonSelect({ people, value, onChange, placeholder = 'Search member…' }: {
  people: PickerPerson[]; value: string; onChange: (id: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useClickOutside(useMemo(() => () => { setOpen(false); setQuery(''); }, []));

  const current = people.find(p => p.id === value);
  const results = people.filter(p => !query.trim() || matches(p.name, query));

  function pick(id: string) { onChange(id); setQuery(''); setOpen(false); inputRef.current?.blur(); }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={box} onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
        {current && !open && <Bubble person={current} size={22} bg="#1a7a4a" />}
        <input
          ref={inputRef} value={open ? query : current ? `${current.hint ? current.hint + ' ' : ''}${current.name}` : ''}
          placeholder={current && open ? current.name : placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); if (results[0]) pick(results[0].id); }
            else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
          }}
          style={{ ...searchInput, minWidth: 0 }}
        />
        <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>▾</span>
      </div>
      {open && (
        <div style={menu}>
          {results.length === 0 ? (
            <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>No one matches &quot;{query.trim()}&quot;</div>
          ) : results.map(p => (
            <div key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => pick(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #fafafa', background: p.id === value ? '#f0fdf4' : 'white' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')} onMouseLeave={e => (e.currentTarget.style.background = p.id === value ? '#f0fdf4' : 'white')}>
              <Bubble person={p} size={26} bg={p.id === value ? '#1a7a4a' : '#9ca3af'} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{p.hint ? `${p.hint} ` : ''}{p.name}</span>
              {p.id === value && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#16a34a' }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TriviaControlPanel from '@/components/TriviaControlPanel';
import DistanceChallengeDetail from '@/components/challenges/DistanceChallengeDetail';
import { actorInit } from '@/lib/actorClient';

export default function AdminChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [kind, setKind] = useState<'distance' | 'trivia' | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/member/challenges/${id}`, actorInit(true))
      .then(async r => {
        if (!r.ok) { setNotFound(true); return; }
        const d = await r.json();
        setKind(d.kind === 'trivia' ? 'trivia' : 'distance');
      })
      .catch(() => setNotFound(true));
  }, [id]);

  return (
    <div style={{ padding: '16px 12px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin-move2026/challenges" style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>← All Challenges</Link>
        {kind === 'trivia' && <h1 style={{ fontSize: 'clamp(21px,5vw,26px)', fontWeight: 900, color: '#1f2937', margin: '4px 0 0' }}>🏛️ Manage Trivia</h1>}
      </div>
      {notFound ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Challenge not found.</div>
      ) : !kind ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : kind === 'trivia' ? (
        <TriviaControlPanel challengeId={id} viewerIsAdmin />
      ) : (
        <DistanceChallengeDetail id={id} basePath="/admin-move2026/challenges" asAdmin />
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DistanceChallengeDetail from './DistanceChallengeDetail';
import TriviaControlPanel from '@/components/TriviaControlPanel';

export default function ChallengeDetailDispatcher() {
  const { id } = useParams<{ id: string }>();
  const [kind, setKind] = useState<'distance' | 'trivia' | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/member/challenges/${id}`)
      .then(async r => {
        if (!r.ok) { setNotFound(true); return; }
        const d = await r.json();
        setKind(d.kind === 'trivia' ? 'trivia' : 'distance');
      })
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) return <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Challenge not found, or you don&apos;t have access to it.</div>;
  if (!kind) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <div style={{ width: 32, height: 32, border: '4px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  );
  if (kind === 'trivia') return <TriviaControlPanel challengeId={id} viewerIsAdmin={false} />;
  return <DistanceChallengeDetail />;
}

'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TriviaControlPanel from '@/components/TriviaControlPanel';

export default function AdminTriviaManagePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div style={{ padding: '16px 12px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin-move2026/challenges" style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>← All Challenges</Link>
        <h1 style={{ fontSize: 'clamp(21px,5vw,26px)', fontWeight: 900, color: '#1f2937', margin: '4px 0 0' }}>🏛️ Manage Trivia</h1>
      </div>
      <TriviaControlPanel challengeId={id} viewerIsAdmin />
    </div>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import ChatBotProvider from './ChatBotProvider';
export const metadata: Metadata = { title: 'PaceTracker | #Move2026 Challenge', description: 'Eden Care #Move2026 – 8-Week Couch to 10K challenge leaderboard' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fafaf8' }}>{children}<ChatBotProvider /></body></html>);
}
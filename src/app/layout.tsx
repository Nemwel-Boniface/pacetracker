import type { Metadata, Viewport } from 'next';
import './globals.css';
import ChatBotProvider from './ChatBotProvider';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import { Toaster } from 'sonner';
export const metadata: Metadata = {
  title: 'PaceTracker | #Move2026 Challenge',
  description: 'Eden Care #Move2026 – 8-Week Couch to 10K challenge leaderboard',
  appleWebApp: { capable: true, title: 'PaceTracker', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#145c38' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fafaf8' }}>{children}<ChatBotProvider /><ServiceWorkerRegister /><Toaster position="top-center" richColors /></body></html>);
}

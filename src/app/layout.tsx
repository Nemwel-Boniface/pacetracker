import type { Metadata, Viewport } from 'next';
import './globals.css';
import ChatBotProvider from './ChatBotProvider';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import { Toaster } from 'sonner';
const DESCRIPTION = 'Ginja AI #Move2026: an 8-week Couch to 10K challenge. Ginja AI builds AI that connects the care hospitals deliver to the revenue they earn.';
export const metadata: Metadata = {
  title: 'PaceTracker | #Move2026 Challenge',
  description: DESCRIPTION,
  openGraph: { title: 'PaceTracker | #Move2026 Challenge', description: DESCRIPTION, siteName: 'PaceTracker by Ginja AI', type: 'website' },
  twitter: { card: 'summary', title: 'PaceTracker | #Move2026 Challenge', description: DESCRIPTION },
  appleWebApp: { capable: true, title: 'PaceTracker', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#145c38' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fafaf8' }}>{children}<ChatBotProvider /><ServiceWorkerRegister /><Toaster position="top-center" richColors /></body></html>);
}

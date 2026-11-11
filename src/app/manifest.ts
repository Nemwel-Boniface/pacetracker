import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/member',
    name: 'PaceTracker | #Move2026',
    short_name: 'PaceTracker',
    description: 'Log your #Move2026 activities and follow the leaderboard',
    // Opening the installed app goes straight to the member area; logged-out users are sent to sign in.
    start_url: '/member',
    scope: '/',
    display: 'standalone',
    background_color: '#fafaf8',
    theme_color: '#145c38',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

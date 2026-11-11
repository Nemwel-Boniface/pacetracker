'use client';
import { useEffect } from 'react';

// Registers /sw.js so the app is installable (and, later, can receive reminder notifications).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}

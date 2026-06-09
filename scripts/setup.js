#!/usr/bin/env node
const bcrypt = require('bcryptjs');
async function main() {
  const password = 'NemwelRuns254';
  const hash = await bcrypt.hash(password, 12);
  console.log('\n✅ PaceTracker Setup\n');
  console.log('Add these to your Vercel environment variables:\n');
  console.log('UPSTASH_REDIS_REST_URL=<your upstash redis REST URL>');
  console.log('UPSTASH_REDIS_REST_TOKEN=<your upstash redis REST token>');
  console.log('JWT_SECRET=<any random string, minimum 32 characters>');
  console.log('ADMIN_EMAIL=n.nyandoro@edencaremedical.com');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('NEXT_PUBLIC_APP_URL=https://your-app.vercel.app');
  console.log('\n🔐 Admin login URL: /admin-move2026/login');
  console.log('🌍 Public leaderboard: /leaderboard\n');
}
main().catch(console.error);
import { Redis } from '@upstash/redis';
let redis: Redis | null = null;
export function getRedis(): Redis {
  if (!redis) { redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! }); }
  return redis;
}
export const KEYS = {
  members: 'pt:members',
  member: (id: string) => `pt:member:${id}`,
  activities: 'pt:activities',
  activity: (id: string) => `pt:activity:${id}`,
  memberActivities: (id: string) => `pt:mact:${id}`,
  dailyActivities: (date: string) => `pt:daily:${date}`,
  prizes: 'pt:prizes',
  prize: (id: string) => `pt:prize:${id}`,
  winners: 'pt:winners',
  winner: (id: string) => `pt:winner:${id}`,
};
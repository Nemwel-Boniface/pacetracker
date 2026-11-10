import { getRedis } from './redis';
import { YefPerson, YefSantaState, YefAward, YefSettings, DEFAULT_YEF_SETTINGS, sameDepartment } from '@/types';

// YEF 2026 storage. Everything lives under pt:yef:* so the scoped admin purge still covers it.
// People, awards and votes are hashes keyed by id, so two people saving at once never overwrite each other.
const YEF_KEYS = {
  people: 'pt:yef:people',
  santa: 'pt:yef:santa',
  awards: 'pt:yef:awards',
  votes: (awardId: string) => `pt:yef:votes:${awardId}`,
  settings: 'pt:yef:settings',
};

// ─── People ──────────────────────────────────────────────────────────────────
export async function getYefPeople(): Promise<YefPerson[]> {
  const all = await getRedis().hgetall<Record<string, YefPerson>>(YEF_KEYS.people);
  return Object.values(all ?? {}).sort((a, b) => a.name.localeCompare(b.name));
}
export async function getYefPerson(id: string): Promise<YefPerson | null> {
  return (await getRedis().hget<YefPerson>(YEF_KEYS.people, id)) ?? null;
}
export async function saveYefPerson(p: YefPerson): Promise<void> {
  await getRedis().hset(YEF_KEYS.people, { [p.id]: p });
}
export async function removeYefPerson(id: string): Promise<void> {
  await getRedis().hdel(YEF_KEYS.people, id);
  const state = await getSantaState();
  const groups = removeFromGroups(state.groups, id);
  if (groups !== state.groups) await saveSantaState({ ...state, groups });
}
export async function getClaimedPerson(memberId: string): Promise<YefPerson | null> {
  return (await getYefPeople()).find(p => p.claimedBy === memberId) ?? null;
}

// ─── Secret Santa ────────────────────────────────────────────────────────────
export async function getSantaState(): Promise<YefSantaState> {
  return (await getRedis().get<YefSantaState>(YEF_KEYS.santa)) ?? { published: false, groups: [] };
}
export async function saveSantaState(s: YefSantaState): Promise<void> {
  await getRedis().set(YEF_KEYS.santa, s);
}

// Drops a person from their group. A pair that loses someone is broken up (the partner becomes unpaired);
// a trio that loses someone becomes a pair. Returns the same array when the person wasn't grouped.
export function removeFromGroups(groups: string[][], id: string): string[][] {
  const i = groups.findIndex(g => g.includes(id));
  if (i === -1) return groups;
  const rest = groups[i].filter(x => x !== id);
  return [...groups.slice(0, i), ...(rest.length >= 2 ? [rest] : []), ...groups.slice(i + 1)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// One random pass: always pair someone from the biggest remaining department with someone from the next
// biggest, which keeps same-department pairs to the unavoidable minimum. An odd person out joins the
// group that shares their department least, making the single trio.
function pairOnce(people: Pick<YefPerson, 'id' | 'department'>[]): string[][] {
  const byDept = new Map<string, string[]>();
  for (const p of shuffle(people)) {
    const k = p.department.trim().toLowerCase();
    byDept.set(k, [...(byDept.get(k) ?? []), p.id]);
  }
  const groups: string[][] = [];
  const remaining = () => [...byDept.values()].reduce((n, ids) => n + ids.length, 0);
  while (remaining() >= 2) {
    const depts = shuffle([...byDept.entries()].filter(([, ids]) => ids.length > 0)).sort((a, b) => b[1].length - a[1].length);
    const a = depts[0][1].pop()!;
    const from = depts[1] && depts[1][1].length > 0 ? depts[1][1] : depts[0][1];
    groups.push([a, from.pop()!]);
  }
  const leftover = [...byDept.values()].flat()[0];
  if (leftover && groups.length > 0) {
    const deptOf = new Map(people.map(p => [p.id, p.department]));
    const clashes = (g: string[]) => g.filter(id => sameDepartment(deptOf.get(id)!, deptOf.get(leftover)!)).length;
    const best = shuffle(groups).sort((x, y) => clashes(x) - clashes(y))[0];
    best.push(leftover);
  }
  return shuffle(groups);
}

export function countSameDepartmentGroups(groups: string[][], people: Pick<YefPerson, 'id' | 'department'>[]): number {
  const deptOf = new Map(people.map(p => [p.id, p.department]));
  return groups.filter(g => g.some((a, i) => g.some((b, j) => i < j && sameDepartment(deptOf.get(a) ?? '', deptOf.get(b) ?? '')))).length;
}

// Several random passes, keeping the one with the fewest same-department groups.
export function generateSantaGroups(people: Pick<YefPerson, 'id' | 'department'>[]): string[][] {
  let best: string[][] = [];
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 200 && bestScore > 0; attempt++) {
    const groups = pairOnce(people);
    const score = countSameDepartmentGroups(groups, people);
    if (score < bestScore) { best = groups; bestScore = score; }
  }
  return best;
}

// ─── Awards ──────────────────────────────────────────────────────────────────
export async function getYefAwards(): Promise<YefAward[]> {
  const all = await getRedis().hgetall<Record<string, YefAward>>(YEF_KEYS.awards);
  return Object.values(all ?? {}).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function getYefAward(id: string): Promise<YefAward | null> {
  return (await getRedis().hget<YefAward>(YEF_KEYS.awards, id)) ?? null;
}
export async function saveYefAward(a: YefAward): Promise<void> {
  await getRedis().hset(YEF_KEYS.awards, { [a.id]: a });
}

// One vote per member per award (re-voting replaces it), stored as memberId → nominee person id.
export async function castYefVote(awardId: string, memberId: string, personId: string): Promise<void> {
  await getRedis().hset(YEF_KEYS.votes(awardId), { [memberId]: personId });
}
export async function getYefVotes(awardId: string): Promise<Record<string, string>> {
  return (await getRedis().hgetall<Record<string, string>>(YEF_KEYS.votes(awardId))) ?? {};
}
export async function getMemberYefVotes(memberId: string, awardIds: string[]): Promise<Record<string, string>> {
  const picks = await Promise.all(awardIds.map(id => getRedis().hget<string>(YEF_KEYS.votes(id), memberId)));
  return Object.fromEntries(awardIds.map((id, i) => [id, picks[i]]).filter(([, p]) => p)) as Record<string, string>;
}
export function tallyVotes(votes: Record<string, string>): { personId: string; votes: number }[] {
  const counts = new Map<string, number>();
  for (const personId of Object.values(votes)) counts.set(personId, (counts.get(personId) ?? 0) + 1);
  return [...counts.entries()].map(([personId, n]) => ({ personId, votes: n })).sort((a, b) => b.votes - a.votes);
}

// ─── Settings ────────────────────────────────────────────────────────────────
export async function getYefSettings(): Promise<YefSettings> {
  return { ...DEFAULT_YEF_SETTINGS, ...((await getRedis().get<YefSettings>(YEF_KEYS.settings)) ?? {}) };
}
export async function saveYefSettings(s: YefSettings): Promise<void> {
  await getRedis().set(YEF_KEYS.settings, s);
}

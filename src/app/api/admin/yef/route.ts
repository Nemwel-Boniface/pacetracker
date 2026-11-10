import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAdminSession } from '@/lib/auth';
import {
  getYefPeople, getYefPerson, saveYefPerson, removeYefPerson, getSantaState, saveSantaState, generateSantaGroups,
  countSameDepartmentGroups, removeFromGroups, getYefAwards, getYefAward, saveYefAward, getYefVotes, tallyVotes,
  getYefSettings, saveYefSettings,
} from '@/lib/yef';
import { YefPerson, YefAwardStatus, YEF_LIKES_MAX, YEF_AWARD_TITLE_MAX, YEF_AWARD_DESC_MAX } from '@/types';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Everything the admin YEF page shows, including claims and live vote counts.
async function snapshot() {
  const [people, santa, awards, settings] = await Promise.all([getYefPeople(), getSantaState(), getYefAwards(), getYefSettings()]);
  const grouped = new Set(santa.groups.flat());
  const tallies = Object.fromEntries(await Promise.all(awards.filter(a => a.status === 'approved').map(async a => {
    const votes = await getYefVotes(a.id);
    return [a.id, { voters: Object.keys(votes).length, tally: tallyVotes(votes) }];
  })));
  return {
    people, santa, awards, settings, tallies,
    unpaired: people.filter(p => !grouped.has(p.id)).map(p => p.id),
    sameDepartmentGroups: countSameDepartmentGroups(santa.groups, people),
  };
}

export async function GET() {
  if (!await getAdminSession()) return bad('Unauthorized', 401);
  try { return NextResponse.json(await snapshot()); }
  catch { return bad('Failed to load YEF 2026', 500); }
}

export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return bad('Unauthorized', 401);
  try {
    const body = await req.json();
    const now = new Date().toISOString();

    switch (body.action) {
      // ── People ──
      case 'import': {
        // One person per line: "Name<TAB>Department" or "Name, Department". Names already on the list are skipped.
        const existing = new Set((await getYefPeople()).map(p => p.name.trim().toLowerCase()));
        const lines = String(body.text ?? '').split('\n').map(l => l.trim()).filter(Boolean);
        let added = 0;
        for (const line of lines) {
          const [name, department] = (line.includes('\t') ? line.split('\t') : line.split(',')).map(s => s.trim());
          if (!name || !department || name.toLowerCase() === 'name' || existing.has(name.toLowerCase())) continue;
          await saveYefPerson({ id: uuidv4(), name: name.slice(0, 80), department: department.slice(0, 60), addedAt: now });
          existing.add(name.toLowerCase()); added++;
        }
        return NextResponse.json({ ...(await snapshot()), message: `Added ${added} ${added === 1 ? 'person' : 'people'}` });
      }
      case 'add_person': {
        const name = clean(body.name, 80), department = clean(body.department, 60);
        if (!name || !department) return bad('Name and department are required');
        if ((await getYefPeople()).some(p => p.name.trim().toLowerCase() === name.toLowerCase())) return bad(`${name} is already on the list`, 409);
        await saveYefPerson({ id: uuidv4(), name, department, addedAt: now });
        return NextResponse.json(await snapshot());
      }
      case 'update_person': {
        const p = await getYefPerson(String(body.id ?? ''));
        if (!p) return bad('Person not found', 404);
        const next: YefPerson = { ...p };
        if (body.name !== undefined) { const n = clean(body.name, 80); if (!n) return bad('Name is required'); next.name = n; }
        if (body.department !== undefined) { const d = clean(body.department, 60); if (!d) return bad('Department is required'); next.department = d; }
        if (body.likes !== undefined) next.likes = clean(body.likes, YEF_LIKES_MAX) || undefined;
        if (body.unclaim) { delete next.claimedBy; delete next.claimedByName; }
        await saveYefPerson(next);
        return NextResponse.json(await snapshot());
      }
      case 'remove_person': {
        await removeYefPerson(String(body.id ?? ''));
        return NextResponse.json(await snapshot());
      }

      // ── Secret Santa pairs ──
      case 'generate': {
        const people = await getYefPeople();
        if (people.length < 2) return bad('Add at least 2 people first');
        const state = await getSantaState();
        await saveSantaState({ ...state, groups: generateSantaGroups(people), generatedAt: now });
        return NextResponse.json(await snapshot());
      }
      case 'swap': {
        // Swaps two people's places, e.g. to move someone away from a teammate.
        const a = String(body.a ?? ''), b = String(body.b ?? '');
        const state = await getSantaState();
        const groups = state.groups.map(g => g.map(id => (id === a ? b : id === b ? a : id)));
        if (!state.groups.flat().includes(a) || !state.groups.flat().includes(b)) return bad('Both people need to be in a pair to swap');
        await saveSantaState({ ...state, groups });
        return NextResponse.json(await snapshot());
      }
      case 'unpair': {
        const state = await getSantaState();
        const groups = state.groups.filter(g => !g.includes(String(body.id ?? '')));
        await saveSantaState({ ...state, groups });
        return NextResponse.json(await snapshot());
      }
      case 'pair': {
        // Groups 2 or 3 unpaired people by hand (3 makes the trio for an odd count).
        const ids: string[] = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))] as string[] : [];
        if (ids.length < 2 || ids.length > 3) return bad('Pick 2 or 3 people');
        const [state, people] = await Promise.all([getSantaState(), getYefPeople()]);
        const known = new Set(people.map(p => p.id)), grouped = new Set(state.groups.flat());
        if (ids.some(id => !known.has(id) || grouped.has(id))) return bad('Only unpaired people can be grouped');
        await saveSantaState({ ...state, groups: [...state.groups, ids] });
        return NextResponse.json(await snapshot());
      }
      case 'add_to_pair': {
        // Turns a pair into the trio: an unpaired person joins the group of `targetId`.
        const id = String(body.id ?? ''), target = String(body.targetId ?? '');
        const state = await getSantaState();
        if (state.groups.flat().includes(id)) return bad('That person is already in a pair');
        const i = state.groups.findIndex(g => g.includes(target));
        if (i === -1) return bad('Pick someone who is already in a pair');
        if (state.groups[i].length >= 3) return bad('That group already has 3 people');
        const groups = state.groups.map((g, j) => (j === i ? [...g, id] : g));
        await saveSantaState({ ...state, groups });
        return NextResponse.json(await snapshot());
      }
      case 'remove_from_pair': {
        const state = await getSantaState();
        await saveSantaState({ ...state, groups: removeFromGroups(state.groups, String(body.id ?? '')) });
        return NextResponse.json(await snapshot());
      }
      case 'publish': {
        const state = await getSantaState();
        await saveSantaState({ ...state, published: !!body.published });
        return NextResponse.json(await snapshot());
      }
      case 'reset_pairs': {
        await saveSantaState({ published: false, groups: [] });
        return NextResponse.json(await snapshot());
      }

      // ── Awards ──
      case 'save_award': {
        const title = clean(body.title, YEF_AWARD_TITLE_MAX);
        if (!title) return bad('Give the award a name');
        const existing = body.id ? await getYefAward(String(body.id)) : null;
        if (body.id && !existing) return bad('Award not found', 404);
        const status: YefAwardStatus = ['suggested', 'approved', 'rejected'].includes(body.status) ? body.status : existing?.status ?? 'approved';
        const description = body.description !== undefined ? clean(body.description, YEF_AWARD_DESC_MAX) : existing?.description;
        await saveYefAward({
          ...(existing ?? { id: uuidv4(), createdAt: now }),
          title, status, noSameDepartment: body.noSameDepartment !== undefined ? !!body.noSameDepartment : !!existing?.noSameDepartment,
          ...(description ? { description } : { description: undefined }),
        });
        return NextResponse.json(await snapshot());
      }
      case 'settings': {
        const current = await getYefSettings();
        await saveYefSettings({
          votingOpen: body.votingOpen !== undefined ? !!body.votingOpen : current.votingOpen,
          resultsRevealed: body.resultsRevealed !== undefined ? !!body.resultsRevealed : current.resultsRevealed,
        });
        return NextResponse.json(await snapshot());
      }
      default:
        return bad('Unknown action');
    }
  } catch { return bad('Something went wrong', 500); }
}

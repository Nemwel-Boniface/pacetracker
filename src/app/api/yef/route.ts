import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getYefPeople, getSantaState, getYefAwards, getYefSettings, getYefVotes, tallyVotes, saveYefAward } from '@/lib/yef';
import { YEF_AWARD_TITLE_MAX, YEF_AWARD_DESC_MAX } from '@/types';

const MAX_PENDING_SUGGESTIONS = 100;

// Public YEF 2026 page data (no login). Pairs only once the admin publishes; vote counts never, winners
// only once results are revealed. Member ids behind claims are never exposed, just whether a name is taken.
export async function GET() {
  try {
    const [people, santa, awards, settings] = await Promise.all([getYefPeople(), getSantaState(), getYefAwards(), getYefSettings()]);
    const ballot = awards.filter(a => a.status === 'approved');
    const results = settings.resultsRevealed
      ? await Promise.all(ballot.map(async a => {
          const tally = tallyVotes(await getYefVotes(a.id));
          const top = tally[0]?.votes ?? 0;
          return { awardId: a.id, winnerIds: top > 0 ? tally.filter(t => t.votes === top).map(t => t.personId) : [] };
        }))
      : null;
    return NextResponse.json({
      people: people.map(p => ({ id: p.id, name: p.name, department: p.department, likes: p.likes ?? '', claimed: !!p.claimedBy })),
      santa: { published: santa.published, groups: santa.published ? santa.groups : [] },
      awards: ballot.map(a => ({ id: a.id, title: a.title, description: a.description ?? '', noSameDepartment: !!a.noSameDepartment })),
      settings, results,
    });
  } catch { return NextResponse.json({ error: 'Failed to load YEF 2026' }, { status: 500 }); }
}

// Anyone can suggest an award; it waits for the admin to put it on the ballot.
export async function POST(req: NextRequest) {
  try {
    const { title, description, name } = await req.json();
    const t = typeof title === 'string' ? title.trim() : '';
    const d = typeof description === 'string' ? description.trim() : '';
    if (!t) return NextResponse.json({ error: 'Give the award a name' }, { status: 400 });
    if (t.length > YEF_AWARD_TITLE_MAX) return NextResponse.json({ error: `Keep the award name under ${YEF_AWARD_TITLE_MAX} characters` }, { status: 400 });
    if (d.length > YEF_AWARD_DESC_MAX) return NextResponse.json({ error: `Keep the description under ${YEF_AWARD_DESC_MAX} characters` }, { status: 400 });

    const awards = await getYefAwards();
    if (awards.some(a => a.title.trim().toLowerCase() === t.toLowerCase())) return NextResponse.json({ error: 'That award has already been suggested' }, { status: 409 });
    if (awards.filter(a => a.status === 'suggested').length >= MAX_PENDING_SUGGESTIONS) return NextResponse.json({ error: 'Lots of suggestions are waiting for review, try again later' }, { status: 429 });

    await saveYefAward({
      id: uuidv4(), title: t, ...(d && { description: d }), status: 'suggested',
      ...(typeof name === 'string' && name.trim() && { suggestedByName: name.trim().slice(0, 60) }),
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to send suggestion' }, { status: 500 }); }
}

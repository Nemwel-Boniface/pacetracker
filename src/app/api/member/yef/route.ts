import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getMember } from '@/lib/data';
import { getYefPerson, saveYefPerson, getClaimedPerson, getYefAwards, getYefAward, getYefSettings, castYefVote, getMemberYefVotes } from '@/lib/yef';
import { YEF_LIKES_MAX, sameDepartment } from '@/types';

// The signed-in member's side of YEF 2026: which name on the list is theirs, their likes, their votes.
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [me, member, awards] = await Promise.all([getClaimedPerson(actor.memberId), getMember(actor.memberId), getYefAwards()]);
    const ballot = awards.filter(a => a.status === 'approved').map(a => a.id);
    return NextResponse.json({ me, memberName: member?.name ?? '', votes: await getMemberYefVotes(actor.memberId, ballot) });
  } catch { return NextResponse.json({ error: 'Failed to load your YEF details' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const mine = await getClaimedPerson(actor.memberId);

    if (body.action === 'claim') {
      if (mine) return NextResponse.json({ error: `You've already said you're ${mine.name}. Ask the admin if that's wrong.` }, { status: 409 });
      const person = await getYefPerson(String(body.personId ?? ''));
      if (!person) return NextResponse.json({ error: 'Name not found on the list' }, { status: 404 });
      if (person.claimedBy) return NextResponse.json({ error: 'Someone has already claimed this name. Ask the admin if it\'s yours.' }, { status: 409 });
      const member = await getMember(actor.memberId);
      const claimed = { ...person, claimedBy: actor.memberId, claimedByName: member?.name ?? '' };
      await saveYefPerson(claimed);
      return NextResponse.json({ me: claimed });
    }

    if (!mine) return NextResponse.json({ error: 'Pick your name from the list first' }, { status: 400 });

    if (body.action === 'likes') {
      const likes = typeof body.likes === 'string' ? body.likes.trim() : '';
      if (likes.length > YEF_LIKES_MAX) return NextResponse.json({ error: `Keep it under ${YEF_LIKES_MAX} characters` }, { status: 400 });
      const updated = { ...mine, likes: likes || undefined };
      await saveYefPerson(updated);
      return NextResponse.json({ me: updated });
    }

    if (body.action === 'vote') {
      const [settings, award, nominee] = await Promise.all([getYefSettings(), getYefAward(String(body.awardId ?? '')), getYefPerson(String(body.personId ?? ''))]);
      if (!settings.votingOpen) return NextResponse.json({ error: 'Voting is closed' }, { status: 403 });
      if (!award || award.status !== 'approved') return NextResponse.json({ error: 'Award not found' }, { status: 404 });
      if (!nominee) return NextResponse.json({ error: 'Nominee not found' }, { status: 404 });
      if (nominee.id === mine.id) return NextResponse.json({ error: "You can't vote for yourself" }, { status: 400 });
      if (award.noSameDepartment && sameDepartment(nominee.department, mine.department)) {
        return NextResponse.json({ error: `For "${award.title}", vote for someone outside ${mine.department}` }, { status: 400 });
      }
      await castYefVote(award.id, actor.memberId, nominee.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch { return NextResponse.json({ error: 'Something went wrong' }, { status: 500 }); }
}

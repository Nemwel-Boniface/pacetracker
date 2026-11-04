import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getLoggableChallenges } from '@/lib/data';

// Challenges an activity on ?date= can be tagged with. Admins may pass ?memberId= to look up the
// challenges of the member they are logging for; everyone else always gets their own.
export async function GET(req: NextRequest) {
  const session = await getActor();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sp = new URL(req.url).searchParams;
    const date = sp.get('date') || new Date().toISOString().slice(0, 10);
    const memberId = session.isAdmin && sp.get('memberId') ? sp.get('memberId')! : session.memberId;
    const challenges = (await getLoggableChallenges(memberId, date)).map(c => ({ id: c.id, title: c.title, category: c.category, goalKm: c.goalKm, endDate: c.endDate }));
    return NextResponse.json({ challenges });
  } catch { return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 }); }
}

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import {
  getBbGame, saveBbGame, publishBbUpdate, nextUpPreview, setPhase, nominateLeader, startRound, resolveRound,
  cancelRound, resetGame, setTimer, addMember, removeMember, BbGame, BbTeamId, BbPhase, BbOutcome, BbCategory,
} from '@/lib/bibleBodmas';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const game = await getBbGame();
  return NextResponse.json({ game, nextUp: nextUpPreview(game) });
}

type Body = {
  action: string; phase?: BbPhase; teamId?: BbTeamId; outcome?: BbOutcome; choiceIndex?: number | null;
  category?: BbCategory; seconds?: number; name?: string; memberId?: string;
};

// One endpoint for every host action, so the control panel and the game logic stay in step.
export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as Body;
  try {
    const g = await getBbGame();
    let game: BbGame;
    switch (body.action) {
      case 'phase': game = setPhase(g, body.phase!); break;
      case 'nominate': game = nominateLeader(g, { teamId: body.teamId }); break;
      case 'start': game = startRound(g, { teamId: body.teamId }); break;
      case 'resolve': game = resolveRound(g, { outcome: body.outcome, choiceIndex: body.choiceIndex }); break;
      case 'cancel': game = cancelRound(g); break;
      case 'reset': game = resetGame(g); break;
      case 'timer': game = setTimer(g, body.category!, Number(body.seconds)); break;
      case 'addMember':
        if (!body.teamId || !body.name?.trim()) throw new Error('Team and name are required');
        game = addMember(g, body.teamId, body.name.trim()); break;
      case 'removeMember':
        if (!body.teamId || !body.memberId) throw new Error('Team and member are required');
        game = removeMember(g, body.teamId, body.memberId); break;
      default: throw new Error('Unknown action');
    }
    await saveBbGame(game);
    await publishBbUpdate(game);
    return NextResponse.json({ game, nextUp: nextUpPreview(game) });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMemberSession } from '@/lib/auth';
import { getMember, getMemberFeedback, saveFeedback } from '@/lib/data';
import { Feedback, FeedbackCategory } from '@/types';

const VALID_CATEGORIES: FeedbackCategory[] = ['suggestion', 'bug', 'question', 'other'];

export async function GET() {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const feedbacks = await getMemberFeedback(session.memberId);
    return NextResponse.json({ feedbacks });
  } catch { return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const member = await getMember(session.memberId);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (!member.isActive) return NextResponse.json({ error: 'Account inactive' }, { status: 403 });

    const { message, category } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    if (message.trim().length > 1000) return NextResponse.json({ error: 'Message too long (max 1000 characters)' }, { status: 400 });

    const fb: Feedback = {
      id: uuidv4(), memberId: member.id, memberName: member.name,
      message: message.trim(),
      category: VALID_CATEGORIES.includes(category) ? category : 'suggestion',
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    await saveFeedback(fb);
    return NextResponse.json({ feedback: fb }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 }); }
}

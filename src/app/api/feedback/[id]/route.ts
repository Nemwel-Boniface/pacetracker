import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { updateFeedback } from '@/lib/data';
import { FeedbackStatus } from '@/types';

const VALID_STATUSES: FeedbackStatus[] = ['pending', 'acknowledged', 'in_progress', 'done'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const { status, adminComment } = await req.json();
    if (status && !VALID_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    const patch: { status?: FeedbackStatus; adminComment?: string; updatedAt: string } = { updatedAt: new Date().toISOString() };
    if (status) patch.status = status;
    if (adminComment !== undefined) patch.adminComment = adminComment.trim() || undefined;
    const updated = await updateFeedback(id, patch);
    if (!updated) return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    return NextResponse.json({ feedback: updated });
  } catch { return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 }); }
}

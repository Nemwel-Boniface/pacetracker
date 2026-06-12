import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getAllFeedback } from '@/lib/data';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const feedbacks = await getAllFeedback();
    return NextResponse.json({ feedbacks });
  } catch { return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 }); }
}

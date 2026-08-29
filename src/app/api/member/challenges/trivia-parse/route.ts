import { NextRequest, NextResponse } from 'next/server';
import { getMemberSession } from '@/lib/auth';
import { parseQuestionWorkbook } from '@/lib/trivia';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB is plenty for a question sheet

export async function POST(req: NextRequest) {
  if (!await getMemberSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File is too large (max 2MB)' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseQuestionWorkbook(buffer);
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 }); }
}

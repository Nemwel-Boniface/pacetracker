import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { buildQuestionTemplateWorkbook } from '@/lib/trivia';

export async function GET() {
  if (!await getActor()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const buffer = buildQuestionTemplateWorkbook();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="trivia-questions-template.xlsx"',
    },
  });
}

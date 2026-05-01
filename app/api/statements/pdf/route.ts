import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');
  if (!file) return NextResponse.json({ error: 'Missing file param' }, { status: 400 });

  // Convert `xyz_unlocked.csv` to `xyz_unlocked.pdf`
  const pdfName = file.replace('.csv', '.pdf').replace('.json', '.pdf');
  const pdfPath = join(process.cwd(), 'data', 'card_statements_unlocked', pdfName);

  if (!existsSync(pdfPath)) {
    return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
  }

  const pdfBuffer = readFileSync(pdfPath);
  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdfName}"`,
    },
  });
}

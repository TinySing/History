import { NextResponse } from 'next/server';
import { getDynasties } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDynasties();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/dynasties]', err);
    return NextResponse.json({ error: 'Failed to load dynasties' }, { status: 500 });
  }
}

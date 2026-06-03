import { NextResponse } from 'next/server';
import { search } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    if (!q.trim()) {
      return NextResponse.json({ items: [] });
    }
    const items = await search(q.trim());
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[api/search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

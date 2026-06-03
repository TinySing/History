import { NextResponse } from 'next/server';
import { getGraphBundle } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { dynastySlug: string } }
) {
  try {
    const bundle = await getGraphBundle(params.dynastySlug);
    if (!bundle) {
      return NextResponse.json({ error: 'Dynasty not found' }, { status: 404 });
    }
    return NextResponse.json(bundle, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
    });
  } catch (err) {
    console.error('[api/graph]', err);
    return NextResponse.json({ error: 'Failed to load graph' }, { status: 500 });
  }
}

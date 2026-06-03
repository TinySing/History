import { NextResponse } from 'next/server';
import { getEntityDetail } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { entityType: string; entitySlug: string } }
) {
  try {
    const { entityType, entitySlug } = params;
    if (entityType !== 'person' && entityType !== 'event') {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }
    const detail = await getEntityDetail(entityType, entitySlug);
    if (!detail) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
    });
  } catch (err) {
    console.error('[api/entities]', err);
    return NextResponse.json({ error: 'Failed to load entity' }, { status: 500 });
  }
}

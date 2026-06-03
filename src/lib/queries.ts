import pool from './db';
import type {
  DynastyGraphBundle,
  EntityDetailProjection,
  DynastyListItem,
  DynastiesResponse,
  SearchResult,
} from './types';

export async function getDynasties(): Promise<DynastiesResponse> {
  const { rows } = await pool.query(
    `SELECT id, slug, name, start_year, end_year, summary FROM dynasties WHERE status = 'active' ORDER BY start_year`
  );

  const dynasties: DynastyListItem[] = rows.map(r => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    startYear: r.start_year,
    endYear: r.end_year,
    summary: r.summary || '',
  }));

  const featured = [
    { label: '从曹操开始', description: '三国枭雄，横扫北方', targetRoute: '/dynasty/san-guo?focus=person:cao-cao' },
    { label: '赤壁之战', description: '决定三国格局的以少胜多传奇', targetRoute: '/dynasty/san-guo?focus=event:battle-of-red-cliffs' },
    { label: '诸葛亮北伐', description: '鞠躬尽瘁，死而后已', targetRoute: '/dynasty/san-guo?focus=event:northern-expeditions' },
    { label: '秦始皇一统天下', description: '中国第一位皇帝的传奇', targetRoute: '/dynasty/qin?focus=person:qin-shi-huang' },
  ];

  return { dynasties, featured };
}

export async function getGraphBundle(dynastySlug: string): Promise<DynastyGraphBundle | null> {
  const { rows } = await pool.query(
    `SELECT p.bundle FROM dynasty_graph_projections p
     JOIN dynasties d ON d.id = p.dynasty_id
     WHERE d.slug = $1`,
    [dynastySlug]
  );
  if (!rows.length) return null;
  return rows[0].bundle as DynastyGraphBundle;
}

export async function getEntityDetail(
  entityType: string,
  entitySlug: string
): Promise<EntityDetailProjection | null> {
  const table = entityType === 'person' ? 'persons' : 'events';
  const { rows } = await pool.query(
    `SELECT p.detail FROM entity_detail_projections p
     JOIN ${table} e ON e.id = p.entity_id
     WHERE p.entity_type = $1 AND e.slug = $2`,
    [entityType, entitySlug]
  );
  if (!rows.length) return null;
  return rows[0].detail as EntityDetailProjection;
}

export async function search(query: string, limit = 12): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const { rows } = await pool.query(
    `SELECT entity_type, entity_id, entity_slug, display_name, aliases, dynasty_slug, subtitle, target_route, weight
     FROM search_documents
     WHERE display_name ILIKE $1 OR $2 = ANY(aliases)
     ORDER BY weight DESC
     LIMIT $3`,
    [`%${query}%`, query, limit]
  );

  return rows.map(r => ({
    entityType: r.entity_type,
    entitySlug: r.entity_slug,
    displayName: r.display_name,
    subtitle: r.subtitle || '',
    dynastySlug: r.dynasty_slug,
    targetRoute: r.target_route,
    focusNodeId: r.entity_type !== 'dynasty' ? `${r.entity_type}:${r.entity_slug}` : null,
    weight: r.weight,
  }));
}

import type { EntityDetailProjection } from '@/lib/types';
import { basePath } from './basePath';

export async function fetchEntityDetail(
  entityType: string,
  entitySlug: string,
  signal?: AbortSignal
): Promise<EntityDetailProjection> {
  const res = await fetch(`${basePath}/api/entities/${entityType}/${entitySlug}`, { signal });
  if (!res.ok) throw new Error(`Failed to load entity: ${res.statusText}`);
  return res.json() as Promise<EntityDetailProjection>;
}

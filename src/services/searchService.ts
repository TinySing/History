import type { SearchResult } from '@/lib/types';
import { basePath } from './basePath';

export async function searchEntities(
  query: string,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const res = await fetch(`${basePath}/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
  const data = (await res.json()) as { items?: SearchResult[] };
  return data.items ?? [];
}

import type { GraphNode, DynastyGraphBundle, DynastyBand } from '@/lib/types';

export interface LayoutNode extends GraphNode {
  lx: number;
  ly: number;
  displaySize: number;
  tier: number;
}

export const RELATION_COLOR: Record<string, string> = {
  blood: '#ef4444',
  political: '#60a5fa',
  conflict: '#f97316',
  participation: '#94a3b8',
  subordinate: '#a78bfa',
};

export const ROLE_GLOW: Record<string, string> = {
  emperor: '#F59E0B',
  warlord: '#FB923C',
  strategist: '#A78BFA',
  minister: '#60A5FA',
  general: '#34D399',
  royalty: '#F472B6',
  rebel: '#EF4444',
  consort: '#F472B6',
  other: '#94a3b8',
};

const EMPEROR_ROLES = new Set(['emperor', 'warlord']);
const ADVISOR_ROLES = new Set(['strategist', 'minister']);

export function getNodeTier(node: GraphNode): number {
  if (node.entityType === 'event') return 3;
  if (node.personRole && EMPEROR_ROLES.has(node.personRole)) return 0;
  if (node.personRole && ADVISOR_ROLES.has(node.personRole)) return 1;
  return 2;
}

// LOD: zoom scale → minimum importance score to show
export function lodMinImportance(scale: number): number {
  if (scale < 0.35) return 85;
  if (scale < 0.6) return 65;
  return 0;
}


// ── Multi-dynasty concentric layout ──────────────────────────────────────────

export function computeLayout(
  nodes: GraphNode[],
  _edges: DynastyGraphBundle['edges'],
  w: number,
  h: number,
  zoomScale = 1,
  dynastyBands?: DynastyBand[]
): LayoutNode[] {
  const minImportance = lodMinImportance(zoomScale);
  const visible = minImportance > 0
    ? nodes.filter(n => (n.importanceScore ?? 50) >= minImportance)
    : nodes;

  if (dynastyBands && dynastyBands.length > 0) {
    return computeMultiDynastyLayout(visible, w, h, dynastyBands);
  }
  return computeConcentricLayout(visible, _edges, w, h);
}

const SIZE_MULTIPLIERS = [2.0, 1.8, 1.65, 1.5];

const MIN_NODE_GAP = 20; // minimum pixel gap between node edges

function nodeDisplaySize(node: GraphNode, tier: number): number {
  return Math.min(node.size, 16) * SIZE_MULTIPLIERS[tier];
}

function safeTierRadius(
  tier: GraphNode[],
  tierIdx: number,
  prevR: number,
  prevMaxNodeR: number
): number {
  if (!tier.length) return prevR;
  const maxNodeR = Math.max(...tier.map(n => nodeDisplaySize(n, tierIdx)));
  const count = tier.length;

  // Must clear the previous tier
  const minFromPrev = prevR + prevMaxNodeR + maxNodeR + MIN_NODE_GAP;

  // Must not overlap within same tier
  let minFromSelf = minFromPrev;
  if (count > 1) {
    // chord = 2r*sin(π/count) >= 2*maxNodeR + MIN_NODE_GAP
    minFromSelf = (maxNodeR + MIN_NODE_GAP / 2) / Math.sin(Math.PI / count);
  }

  return Math.max(minFromPrev, minFromSelf);
}

function computeMultiDynastyLayout(
  nodes: GraphNode[],
  w: number,
  h: number,
  dynastyBands: DynastyBand[]
): LayoutNode[] {
  const sorted = [...dynastyBands].sort((a, b) => a.startYear - b.startYear);
  const n = sorted.length || 1;

  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const key = node.dynastySlug;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  const stripW = w / n;
  // Offset each tier's start angle so 2-node tiers don't stack vertically
  const TIER_START_ANGLE = [-Math.PI / 2, -Math.PI / 3, -Math.PI / 2.5, -Math.PI / 2];

  const result: LayoutNode[] = [];

  sorted.forEach((dynasty, di) => {
    const cx = stripW * di + stripW / 2;
    const cy = h / 2;
    const dynNodes = groups.get(dynasty.slug) ?? [];

    const tiers: GraphNode[][] = [[], [], [], []];
    for (const node of dynNodes) tiers[getNodeTier(node)].push(node);
    for (const tier of tiers) tier.sort((a, b) => b.size - a.size);

    // Compute safe radii for each tier
    let prevR = 0;
    let prevMaxNodeR = 0;

    const tierRadii: number[] = [];
    for (let t = 0; t < 4; t++) {
      const tier = tiers[t];
      if (!tier.length) { tierRadii.push(prevR); continue; }

      if (t === 0 && tier.length === 1) {
        // Single center node
        prevMaxNodeR = nodeDisplaySize(tier[0], 0);
        tierRadii.push(0);
      } else {
        const r = safeTierRadius(tier, t, prevR, prevMaxNodeR);
        const maxNodeR = Math.max(...tier.map(nd => nodeDisplaySize(nd, t)));
        prevR = r;
        prevMaxNodeR = maxNodeR;
        tierRadii.push(r);
      }
    }

    for (let t = 0; t < 4; t++) {
      const tier = tiers[t];
      if (!tier.length) continue;
      const r = tierRadii[t];
      const startAngle = TIER_START_ANGLE[t];

      tier.forEach((node, j) => {
        const angle = r === 0 ? 0 : startAngle + (2 * Math.PI * j) / tier.length;
        result.push({
          ...node,
          lx: cx + (r === 0 ? 0 : r * Math.cos(angle)),
          ly: cy + (r === 0 ? 0 : r * Math.sin(angle)),
          displaySize: nodeDisplaySize(node, t),
          tier: t,
        });
      });
    }
  });

  return result;
}

function computeConcentricLayout(
  nodes: GraphNode[],
  edges: DynastyGraphBundle['edges'],
  w: number,
  h: number
): LayoutNode[] {
  const cx = w / 2;
  const cy = h / 2;
  const minDim = Math.min(w, h);

  const tiers: GraphNode[][] = [[], [], [], []];
  for (const n of nodes) tiers[getNodeTier(n)].push(n);
  for (const tier of tiers) {
    tier.sort((a, b) => b.size - a.size);
  }

  const t0 = tiers[0];
  const RADII = [
    t0.length === 1 ? 0 : minDim * 0.13,
    minDim * 0.28,
    minDim * 0.40,
    minDim * 0.52,
  ];
  const result: LayoutNode[] = [];

  for (let t = 0; t < 4; t++) {
    const tier = tiers[t];
    if (tier.length === 0) continue;
    const r = RADII[t];
    tier.forEach((n, i) => {
      const angle = r === 0 ? 0 : -Math.PI / 2 + (2 * Math.PI * i) / tier.length;
      result.push({
        ...n,
        lx: r === 0 ? cx : cx + r * Math.cos(angle),
        ly: r === 0 ? cy : cy + r * Math.sin(angle),
        displaySize: Math.min(n.size, 16) * SIZE_MULTIPLIERS[t],
        tier: t,
      });
    });
  }
  return result;
}

export function edgePath(
  x1: number, y1: number,
  x2: number, y2: number,
  cx: number, cy: number,
  tier1: number, tier2: number
): string {
  // For time-based layout just use a gentle quadratic curve
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Curve perpendicular to the line, scaled by distance
  const curvature = Math.min(len * 0.25, 80);
  const perpX = -dy / len * curvature;
  const perpY = dx / len * curvature;
  return `M ${x1} ${y1} Q ${midX + perpX} ${midY + perpY} ${x2} ${y2}`;
}

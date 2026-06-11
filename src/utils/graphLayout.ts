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

// Positions are computed from the full node set so they stay deterministic across
// zoom levels. LOD (hiding low-importance nodes) is applied as a render filter by
// the caller via `lodMinImportance`, never here — otherwise cluster widths would
// shift with zoom and break focus/centering.
export function computeLayout(
  nodes: GraphNode[],
  _edges: DynastyGraphBundle['edges'],
  w: number,
  h: number,
  dynastyBands?: DynastyBand[]
): LayoutNode[] {
  if (dynastyBands && dynastyBands.length > 0) {
    return computeMultiDynastyLayout(nodes, w, h, dynastyBands);
  }
  return computeConcentricLayout(nodes, _edges, w, h);
}

const SIZE_MULTIPLIERS = [2.0, 1.8, 1.65, 1.5];

// World-space gap between adjacent dynasty time-strips (prevents overlap at any count)
const CLUSTER_GAP = 180;

// Time-strip tuning
const STRIP_PX_PER_YEAR = 6;   // horizontal pixels per year inside a dynasty
const STRIP_MIN_WIDTH = 440;   // minimum strip width (short dynasties)
const LANE_GAP_Y = 40;         // vertical gap between stacked lanes
const AXIS_GAP = 34;           // gap from the central emperor axis to the first lane
const NODE_GAP_X = 24;         // minimum horizontal gap between nodes in the same lane

function nodeDisplaySize(node: GraphNode, tier: number): number {
  return Math.min(node.size, 16) * SIZE_MULTIPLIERS[tier];
}

type LocalNode = { node: GraphNode; localX: number; localY: number; size: number; tier: number };

// Lay one dynasty's nodes out as a left→right time strip:
//   emperors (tier 0) sit on the central time axis (localY 0),
//   other persons stack upward, events stack downward — each by activeYear.
// Returns local coords (origin = strip center) plus the strip's half-width for packing.
function layoutTimeStrip(dynNodes: GraphNode[], fixedWidth?: number): { locals: LocalNode[]; halfWidth: number } {
  if (!dynNodes.length) return { locals: [], halfWidth: 0 };

  const years = dynNodes.map(n => n.activeYear);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const span = maxYear - minYear || 1;
  const width = fixedWidth ?? Math.max(span * STRIP_PX_PER_YEAR, STRIP_MIN_WIDTH);
  const xOf = (year: number) => ((year - minYear) / span) * width - width / 2;

  const sized = dynNodes.map(n => {
    const tier = getNodeTier(n);
    return { node: n, tier, size: nodeDisplaySize(n, tier), localX: xOf(n.activeYear) };
  });
  const maxR = Math.max(...sized.map(s => s.size));
  const rowH = maxR * 2 + LANE_GAP_Y;

  const locals: LocalNode[] = [];
  let extentX = width / 2;

  // Emperors on the central axis, de-collided horizontally
  const emperors = sized.filter(s => s.tier === 0).sort((a, b) => a.localX - b.localX);
  let lastRight = -Infinity;
  for (const s of emperors) {
    let x = s.localX;
    if (x - s.size < lastRight + NODE_GAP_X) x = lastRight + NODE_GAP_X + s.size;
    lastRight = x + s.size;
    locals.push({ node: s.node, localX: x, localY: 0, size: s.size, tier: s.tier });
    extentX = Math.max(extentX, Math.abs(x) + s.size);
  }

  // Greedy lane packing: place each node in the first lane whose last node clears it
  const pack = (items: typeof sized, dir: -1 | 1) => {
    const ordered = [...items].sort((a, b) => a.localX - b.localX);
    const laneRight: number[] = [];
    for (const s of ordered) {
      const left = s.localX - s.size;
      let lane = laneRight.findIndex(r => r + NODE_GAP_X <= left);
      if (lane === -1) { lane = laneRight.length; laneRight.push(s.localX + s.size); }
      else laneRight[lane] = s.localX + s.size;
      const y = dir * (AXIS_GAP + lane * rowH + rowH / 2);
      locals.push({ node: s.node, localX: s.localX, localY: y, size: s.size, tier: s.tier });
      extentX = Math.max(extentX, Math.abs(s.localX) + s.size);
    }
  };

  pack(sized.filter(s => s.tier === 1 || s.tier === 2), -1); // persons stack upward
  pack(sized.filter(s => s.tier === 3), 1);                  // events stack downward

  return { locals, halfWidth: extentX };
}

function computeMultiDynastyLayout(
  nodes: GraphNode[],
  w: number,
  h: number,
  dynastyBands: DynastyBand[]
): LayoutNode[] {
  const sorted = [...dynastyBands].sort((a, b) => a.startYear - b.startYear);

  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const key = node.dynastySlug;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  const cy = h / 2;

  // 1. Build each dynasty as a time strip and measure its half-width.
  const clusters = sorted.map(dynasty => layoutTimeStrip(groups.get(dynasty.slug) ?? []));

  // 2. Pack strips left-to-right by their actual extents.
  const result: LayoutNode[] = [];
  let prevCenter = 0;
  let prevHalf = 0;
  clusters.forEach((cluster, i) => {
    const centerX = i === 0
      ? cluster.halfWidth
      : prevCenter + prevHalf + CLUSTER_GAP + cluster.halfWidth;

    for (const lc of cluster.locals) {
      result.push({
        ...lc.node,
        lx: centerX + lc.localX,
        ly: cy + lc.localY,
        displaySize: lc.size,
        tier: lc.tier,
      });
    }

    prevCenter = centerX;
    prevHalf = cluster.halfWidth;
  });

  return result;
}

function computeConcentricLayout(
  nodes: GraphNode[],
  _edges: DynastyGraphBundle['edges'],
  w: number,
  h: number
): LayoutNode[] {
  // Single-dynasty view: one time strip filling most of the viewport width.
  const cx = w / 2;
  const cy = h / 2;
  const { locals } = layoutTimeStrip(nodes, w * 0.78);
  return locals.map(lc => ({
    ...lc.node,
    lx: cx + lc.localX,
    ly: cy + lc.localY,
    displaySize: lc.size,
    tier: lc.tier,
  }));
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

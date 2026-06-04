'use client';

import { useRef, useState, useCallback, useMemo, useImperativeHandle, forwardRef, useEffect } from 'react';
import type { DynastyGraphBundle, DynastyBand } from '@/lib/types';
import { computeLayout, edgePath, lodMinImportance, RELATION_COLOR, ROLE_GLOW, type LayoutNode } from '@/utils/graphLayout';
import { formatYear } from '@/utils/format';

export interface GraphCanvasHandle {
  resetView: () => void;
  focusNode: (nodeId: string) => void;
}

// 暴露给父组件的状态
export interface GraphCanvasState {
  visibleDynastySlugs: string[];  // 当前视口内可见的朝代
}

interface Props {
  bundle: DynastyGraphBundle;
  focusedNodeId: string | null;
  onNodeClick: (nodeId: string, entityType: string, entitySlug: string) => void;
  onStateChange?: (state: GraphCanvasState) => void;  // 状态变化回调
}

type Transform = { x: number; y: number; scale: number };

const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas(
  { bundle, focusedNodeId, onNodeClick, onStateChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0, scale: 1 });
  const gRef = useRef<SVGGElement>(null);
  const liveTransform = useRef<Transform>({ x: 0, y: 0, scale: 1 });

  const dynastyBands: DynastyBand[] = bundle.dynastyBands ?? [];
  const isGlobal = dynastyBands.length > 1;

  // Compute the initial transform using actual layout positions
  const focusTransform = useCallback((w: number, h: number, currentLayout: typeof layout): Transform => {
    if (!isGlobal || dynastyBands.length < 2) return { x: 0, y: 0, scale: 1 };

    // Get actual extent from layout nodes belonging to focused dynasty
    const focusNodes = currentLayout.filter(nd => nd.dynastySlug === bundle.dynasty.slug);
    if (!focusNodes.length) return { x: 0, y: 0, scale: 1 };

    const minX = Math.min(...focusNodes.map(nd => nd.lx - nd.displaySize));
    const maxX = Math.max(...focusNodes.map(nd => nd.lx + nd.displaySize));
    const worldCx = (minX + maxX) / 2;
    const worldCy = h / 2;

    const maxR = Math.max(...focusNodes.map(nd =>
      Math.sqrt((nd.lx - worldCx) ** 2 + (nd.ly - worldCy) ** 2) + nd.displaySize
    ));

    // Fit cluster in ~85% of the shorter viewport dimension
    const scale = Math.min(w, h) * 0.42 / (maxR || 1);
    return {
      x: w / 2 - worldCx * scale,
      y: h / 2 - worldCy * scale,
      scale,
    };
  }, [isGlobal, dynastyBands, bundle.dynasty.slug]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () => computeLayout(bundle.nodes, bundle.edges, size.w, size.h, isGlobal ? dynastyBands : undefined),
    [bundle.nodes, bundle.edges, size, dynastyBands, isGlobal]
  );
  const posMap = useMemo(() => new Map(layout.map(n => [n.id, n])), [layout]);

  // Per-dynasty cluster geometry derived from actual layout positions
  const bandGeometry = useMemo(() => {
    const m = new Map<string, { minX: number; maxX: number; minY: number; maxY: number; cx: number }>();
    for (const nd of layout) {
      const left = nd.lx - nd.displaySize;
      const right = nd.lx + nd.displaySize;
      const top = nd.ly - nd.displaySize;
      const bottom = nd.ly + nd.displaySize;
      const g = m.get(nd.dynastySlug);
      if (!g) m.set(nd.dynastySlug, { minX: left, maxX: right, minY: top, maxY: bottom, cx: 0 });
      else {
        g.minX = Math.min(g.minX, left); g.maxX = Math.max(g.maxX, right);
        g.minY = Math.min(g.minY, top); g.maxY = Math.max(g.maxY, bottom);
      }
    }
    for (const g of m.values()) g.cx = (g.minX + g.maxX) / 2;
    return m;
  }, [layout]);

  useImperativeHandle(ref, () => ({
    resetView: () => setTransform(focusTransform(size.w, size.h, layout)),
    focusNode: (nodeId: string) => {
      const node = posMap.get(nodeId);
      if (!node) return;
      // 聚焦到节点位置，缩放比例设为1.2
      const scale = 1.2;
      setTransform({
        x: size.w / 2 - node.lx * scale,
        y: size.h / 2 - node.ly * scale,
        scale,
      });
    },
  }), [focusTransform, size, layout, posMap]);

  const cx = size.w / 2;
  const cy = size.h / 2;

  const activeNeighbors = useMemo(() => {
    const id = focusedNodeId || hoveredId;
    if (!id) return null;
    const set = new Set<string>();
    for (const e of bundle.edges) {
      if (e.source === id) set.add(e.target);
      if (e.target === id) set.add(e.source);
    }
    return set;
  }, [focusedNodeId, hoveredId, bundle.edges]);

  const activeId = focusedNodeId || hoveredId;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y, scale: transform.scale };
    liveTransform.current = transform;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [transform]);

  // While dragging, write the transform straight to the DOM instead of triggering
  // a React re-render of every node/edge each frame; commit to state on release.
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const { tx, ty, scale } = dragStart.current;
    const x = tx + (e.clientX - dragStart.current.x);
    const y = ty + (e.clientY - dragStart.current.y);
    liveTransform.current = { x, y, scale };
    gRef.current?.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setTransform(liveTransform.current);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.11;
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setTransform(t => {
      const newScale = Math.max(0.18, Math.min(5, t.scale * factor));
      return {
        scale: newScale,
        x: mx + (t.x - mx) * (newScale / t.scale),
        y: my + (t.y - my) * (newScale / t.scale),
      };
    });
  }, []);

  // On dynasty switch or size ready: zoom to focused dynasty
  useEffect(() => {
    setTransform(focusTransform(size.w, size.h, layout));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.dynasty.slug, size.w, size.h]);

  // 当 focusedNodeId 变化时，聚焦到对应节点
  useEffect(() => {
    if (!focusedNodeId) return;
    const node = posMap.get(focusedNodeId);
    if (!node) return;
    const scale = 1.2;
    setTransform({
      x: size.w / 2 - node.lx * scale,
      y: size.h / 2 - node.ly * scale,
      scale,
    });
  }, [focusedNodeId, posMap, size.w, size.h]);

  // 节点过滤：先按缩放等级做 LOD 过滤（隐藏低重要度节点），再做视口裁剪（虚拟列表）
  const { visibleNodes, visibleEdges } = useMemo(() => {
    // LOD：缩放越小，只显示越重要的节点
    const lodMin = lodMinImportance(transform.scale);
    const lodNodes = lodMin > 0
      ? layout.filter(n => (n.importanceScore ?? 50) >= lodMin)
      : layout;
    const lodIds = new Set(lodNodes.map(n => n.id));

    if (!isGlobal) {
      const edges = bundle.edges.filter(e => lodIds.has(e.source) && lodIds.has(e.target));
      return { visibleNodes: lodNodes, visibleEdges: edges };
    }

    // 计算视口在世界坐标中的范围（含缓冲边距）
    const padding = 200 / transform.scale;
    const expandedLeft = -transform.x / transform.scale - padding;
    const expandedTop = -transform.y / transform.scale - padding;
    const expandedRight = (size.w - transform.x) / transform.scale + padding;
    const expandedBottom = (size.h - transform.y) / transform.scale + padding;

    const visibleNodeIds = new Set<string>();
    const filteredNodes = lodNodes.filter(node => {
      const inView = node.lx >= expandedLeft && node.lx <= expandedRight &&
                     node.ly >= expandedTop && node.ly <= expandedBottom;
      if (inView) visibleNodeIds.add(node.id);
      return inView;
    });

    // 只渲染两端均在 LOD 集合中、且至少一端在视口内的边
    const filteredEdges = bundle.edges.filter(edge =>
      lodIds.has(edge.source) && lodIds.has(edge.target) &&
      (visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target))
    );

    return { visibleNodes: filteredNodes, visibleEdges: filteredEdges };
  }, [layout, bundle.edges, transform, size, isGlobal]);

  // 计算可见的朝代并通知父组件
  useEffect(() => {
    if (!onStateChange || !isGlobal) return;
    
    const viewLeft = -transform.x / transform.scale;
    const viewRight = (size.w - transform.x) / transform.scale;

    const visibleSlugs = dynastyBands.filter(band => {
      const g = bandGeometry.get(band.slug);
      if (!g) return false;
      return g.maxX >= viewLeft && g.minX <= viewRight;
    }).map(b => b.slug);

    onStateChange({ visibleDynastySlugs: visibleSlugs });
  }, [transform, size.w, dynastyBands, isGlobal, onStateChange, bandGeometry]);

  const lodLevel = transform.scale < 0.35 ? '概览' : transform.scale < 0.6 ? '标准' : '详细';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      style={{ cursor: 'grab', background: 'radial-gradient(ellipse at 50% 45%, #0d1f3c 0%, #050a14 100%)' }}
    >
      <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="glow-soft" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-strong" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="node-shine" cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          {visibleNodes.map(node => (
            <clipPath key={`clip-${node.id}`} id={`clip-${node.id.replace(/[^a-zA-Z0-9-]/g, '-')}`}>
              <circle r={node.displaySize} cx="0" cy="0" />
            </clipPath>
          ))}
        </defs>

        <g ref={gRef} transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

          {/* Dynasty cluster separators (global mode) */}
          {isGlobal && (() => {
            const sorted = [...dynastyBands].sort((a, b) => a.startYear - b.startYear);
            let prevMaxX: number | null = null;
            return sorted.map(band => {
              const g = bandGeometry.get(band.slug);
              if (!g) return null;
              const cx = g.cx;
              const focused = band.slug === bundle.dynasty.slug;
              const color = band.color || '#64748b';
              const sepX = prevMaxX != null ? (prevMaxX + g.minX) / 2 : null;
              prevMaxX = g.maxX;
              const labelY = g.minY - 24;
              return (
                <g key={band.slug}>
                  {/* Vertical separator between dynasties */}
                  {sepX != null && (
                    <line
                      x1={sepX} y1={size.h * 0.1}
                      x2={sepX} y2={size.h * 0.9}
                      stroke="#1e3a5f" strokeWidth={1} strokeDasharray="6 10" opacity={0.5}
                    />
                  )}
                  {/* Dynasty name label with glow */}
                  <text
                    x={cx} y={labelY}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={focused ? '700' : '500'}
                    fill={focused ? '#f1f5f9' : color}
                    opacity={focused ? 1 : 0.7}
                    fontFamily='"Noto Serif SC", serif'
                    letterSpacing="3"
                    filter={focused ? 'url(#glow-soft)' : undefined}
                  >
                    {band.name}
                  </text>
                  {/* Year range below name */}
                  <text
                    x={cx} y={labelY + 16}
                    textAnchor="middle"
                    fontSize={9}
                    fill={focused ? '#94a3b8' : '#475569'}
                    fontFamily='monospace'
                  >
                    {formatYear(band.startYear)} — {formatYear(band.endYear)}
                  </text>
                </g>
              );
            });
          })()}

          {/* Outer guide ellipse per dynasty (global mode) — extent from actual layout */}
          {isGlobal && dynastyBands.map(band => {
            const g = bandGeometry.get(band.slug);
            if (!g) return null;
            const rx = (g.maxX - g.minX) / 2 + 14;
            const ry = (g.maxY - g.minY) / 2 + 14;
            return (
              <ellipse key={band.slug}
                cx={g.cx} cy={(g.minY + g.maxY) / 2} rx={rx} ry={ry}
                fill="none" stroke="#1e3a5f" strokeWidth={1}
                strokeDasharray="4 10" opacity={0.2} />
            );
          })}

          {/* Concentric rings (single dynasty mode) */}
          {!isGlobal && [0.28, 0.40, 0.52].map((ratio, i) => {
            const r = Math.min(size.w, size.h) * ratio;
            if (!layout.some(n => n.tier === i + 1)) return null;
            return (
              <circle key={i} cx={cx} cy={cy} r={r}
                fill="none" stroke="#1e3a5f" strokeWidth={1}
                strokeDasharray="4 8" opacity={0.35} />
            );
          })}

          {/* Edges — base pass (dimmed when something is active) */}
          {visibleEdges.map(edge => {
            // Highlighted edges are drawn in the top pass below so they never get
            // covered by dimmed ones.
            if (activeId && (edge.source === activeId || edge.target === activeId)) return null;
            const src = posMap.get(edge.source);
            const tgt = posMap.get(edge.target);
            if (!src || !tgt) return null;

            const color = RELATION_COLOR[edge.relationType] || '#94a3b8';
            return (
              <path
                key={`${edge.source}--${edge.target}--${edge.relationType}`}
                d={edgePath(src.lx, src.ly, tgt.lx, tgt.ly, cx, cy, src.tier, tgt.tier)}
                stroke={color}
                strokeWidth={1}
                fill="none"
                opacity={activeId ? 0.03 : 0.25}
                strokeLinecap="round"
                style={{ transition: 'opacity 0.2s' }}
              />
            );
          })}

          {/* Edges — highlighted pass (always rendered, even if a neighbor is culled) */}
          {activeId && bundle.edges.map(edge => {
            if (edge.source !== activeId && edge.target !== activeId) return null;
            const src = posMap.get(edge.source);
            const tgt = posMap.get(edge.target);
            if (!src || !tgt) return null;

            const color = RELATION_COLOR[edge.relationType] || '#94a3b8';
            return (
              <path
                key={`hl-${edge.source}--${edge.target}--${edge.relationType}`}
                d={edgePath(src.lx, src.ly, tgt.lx, tgt.ly, cx, cy, src.tier, tgt.tier)}
                stroke={color}
                strokeWidth={2.5}
                fill="none"
                opacity={0.8}
                strokeLinecap="round"
                style={{ transition: 'opacity 0.2s' }}
              />
            );
          })}

          {/* Nodes */}
          {visibleNodes.map(node => {
            const isFocused = focusedNodeId === node.id;
            const isHovered = hoveredId === node.id;
            const isNeighbor = activeNeighbors?.has(node.id) ?? false;
            const isDimmed = !!activeId && !isFocused && !isHovered && !isNeighbor;
            const isInFocusDynasty = node.dynastySlug === bundle.dynasty.slug;

            const r = node.displaySize * (isFocused ? 1.45 : isHovered ? 1.25 : 1);
            const glowColor = (node.personRole && ROLE_GLOW[node.personRole]) || node.color;
            const isEmperor = node.tier === 0;
            const opacity = isDimmed ? (isGlobal && isInFocusDynasty ? 0.15 : 0.07) : 1;

            return (
              <g
                key={node.id}
                transform={`translate(${node.lx},${node.ly})`}
                data-node="true"
                style={{ cursor: 'pointer', opacity, transition: 'opacity 0.2s' }}
                onClick={() => onNodeClick(node.id, node.entityType, node.entitySlug)}
                onPointerEnter={() => setHoveredId(node.id)}
                onPointerLeave={() => setHoveredId(null)}
              >
                <circle r={r * 2} fill={glowColor}
                  opacity={isFocused ? 0.18 : isHovered ? 0.12 : isEmperor ? 0.08 : 0.04}
                  style={{ filter: 'blur(8px)' }} />

                {node.entityType === 'event' && (
                  <circle r={r + 4} fill="none" stroke={node.color}
                    strokeWidth={1.2} strokeDasharray="4 3" opacity={0.5} />
                )}

                {(isFocused || isHovered) && (
                  <circle r={r + 3} fill="none" stroke={glowColor}
                    strokeWidth={2} opacity={0.7} filter="url(#glow-soft)" />
                )}

                <circle r={r} fill={node.color}
                  filter={isEmperor || isFocused ? 'url(#glow-strong)' : 'url(#glow-soft)'}
                  style={{ transition: 'r 0.2s' }} />

                <image
                  href={node.imageUrl || (node.entityType === 'event' ? '/images/default-event.svg' : '/images/default-person.svg')}
                  x={-r} y={-r} width={r * 2} height={r * 2}
                  clipPath={`url(#clip-${node.id.replace(/[^a-zA-Z0-9-]/g, '-')})`}
                  preserveAspectRatio="xMidYMid slice"
                />

                <circle r={r} fill="url(#node-shine)" opacity={node.imageUrl ? 0.3 : 0.9} />

                <text
                  y={r + 13}
                  textAnchor="middle"
                  fontSize={isEmperor ? 12 : 10}
                  fontWeight={isFocused || isEmperor ? '700' : '500'}
                  fill={isDimmed ? '#1e3a5f' : isNeighbor || isFocused ? '#f1f5f9' : '#cbd5e1'}
                  fontFamily='"Noto Serif SC", Georgia, serif'
                  letterSpacing="0.5"
                  style={{ pointerEvents: 'none', transition: 'fill 0.2s' }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* LOD indicator */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-slate-600 pointer-events-none select-none">
        <span className="bg-slate-900/70 px-2 py-1 rounded border border-slate-800 backdrop-blur-sm">
          {lodLevel} · {visibleNodes.length}/{layout.length} 节点
        </span>
        <span className="bg-slate-900/70 px-2 py-1 rounded border border-slate-800 backdrop-blur-sm">
          拖动 · 滚轮缩放 · 点击
        </span>
      </div>
    </div>
  );
});

export default GraphCanvas;

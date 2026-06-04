'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SearchBox from '@/components/SearchBox';
import DetailPanel from './DetailPanel';
import Timeline from './Timeline';
import GraphCanvas, { type GraphCanvasHandle, type GraphCanvasState } from './GraphCanvas';
import type { DynastyGraphBundle, DynastyListItem, SearchResult } from '@/lib/types';
import { useDynastyFocus } from '@/hooks/useDynastyFocus';
import { formatYear } from '@/utils/format';

const NODE_LEGEND = [
  { color: '#F59E0B', label: '帝王' },
  { color: '#A78BFA', label: '谋士' },
  { color: '#34D399', label: '将领' },
  { color: '#60A5FA', label: '臣子' },
  { color: '#FB923C', label: '诸侯' },
  { color: '#EF4444', label: '义军' },
  { color: '#F472B6', label: '宗室' },
  { color: '#E2E8F0', label: '事件' },
];

const EDGE_LEGEND = [
  { color: '#DC2626', label: '血缘' },
  { color: '#2563EB', label: '政治' },
  { color: '#EA580C', label: '冲突' },
  { color: '#64748B', label: '事件参与' },
];

interface Props {
  bundle: DynastyGraphBundle;
  dynasties: DynastyListItem[];
}

export default function DynastyGraphPage({ bundle, dynasties }: Props) {
  const router = useRouter();
  const [showLegend, setShowLegend] = useState(false);
  const [dynastySelectorOpen, setDynastySelectorOpen] = useState(false);
  const [canvasState, setCanvasState] = useState<GraphCanvasState>({ visibleDynastySlugs: [] });
  const graphRef = useRef<GraphCanvasHandle>(null);

  const {
    focusedNodeId,
    detail,
    detailLoading,
    detailError,
    focusEntity,
    clearFocus,
    handleNodeFocus,
  } = useDynastyFocus(graphRef);

  const handleNodeClick = useCallback((nodeId: string, entityType: string, entitySlug: string) => {
    focusEntity(nodeId, entityType, entitySlug);
  }, [focusEntity]);

  const handleTimelineClick = useCallback((nodeId: string, eventSlug: string) => {
    focusEntity(nodeId, 'event', eventSlug);
  }, [focusEntity]);

  const handleSearchSelect = useCallback((result: SearchResult): boolean => {
    if (result.dynastySlug === bundle.dynasty.slug && result.focusNodeId) {
      focusEntity(result.focusNodeId, result.entityType, result.entitySlug);
      return true;
    }
    return false;
  }, [bundle.dynasty.slug, focusEntity]);

  const handleDynastySwitch = useCallback((slug: string) => {
    setDynastySelectorOpen(false);
    if (slug === bundle.dynasty.slug) return;
    router.push(`/dynasty/${slug}`);
  }, [bundle.dynasty.slug, router]);

  useEffect(() => {
    if (!dynastySelectorOpen) return;
    const handler = () => setDynastySelectorOpen(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [dynastySelectorOpen]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-4 px-5 py-2.5 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md z-30">
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-900 font-serif font-bold text-sm shadow-lg shadow-amber-500/20">
            史
          </div>
          <span className="font-serif text-base text-slate-100 group-hover:text-amber-400 transition-colors">史迹</span>
        </Link>

        <div className="text-slate-700">/</div>

        {/* Dynasty selector */}
        <div className="relative shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setDynastySelectorOpen(v => !v); }}
            className="flex items-center gap-1.5 px-2 py-1 -mx-2 rounded text-sm text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <span className="font-medium">{bundle.dynasty.name}</span>
            <span className="text-xs text-slate-500 font-mono">
              {formatYear(bundle.dynasty.startYear)}–{formatYear(bundle.dynasty.endYear)}
            </span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {dynastySelectorOpen && (
            <div
              className="absolute top-full mt-2 left-0 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-50 min-w-[240px]"
              onClick={(e) => e.stopPropagation()}
            >
              {dynasties.map(d => (
                <button
                  key={d.slug}
                  onClick={() => handleDynastySwitch(d.slug)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-800 transition-colors flex items-baseline justify-between gap-3
                    ${d.slug === bundle.dynasty.slug ? 'bg-slate-800/50 text-amber-400' : 'text-slate-200'}`}
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-slate-500 font-mono shrink-0">{formatYear(d.startYear)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 max-w-lg ml-auto">
          <SearchBox onSelect={handleSearchSelect} compact />
        </div>

        {focusedNodeId && (
          <button
            onClick={clearFocus}
            className="shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-amber-500/40 transition-colors"
            title="ESC 关闭"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            全景
          </button>
        )}

        <button
          onClick={() => setShowLegend(v => !v)}
          className={`shrink-0 text-xs px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1
            ${showLegend
              ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
              : 'text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-200'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          图例
        </button>
      </header>

      {/* Graph area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph canvas — left column */}
        <div className="flex-1 relative overflow-hidden">
          <GraphCanvas
            ref={graphRef}
            bundle={bundle}
            focusedNodeId={focusedNodeId}
            onNodeClick={handleNodeClick}
            onStateChange={setCanvasState}
          />

          {/* Stats card (top-left) - 根据可见朝代数量决定显示内容 */}
          {!focusedNodeId && bundle.dynastyBands && bundle.dynastyBands.length > 1 && (() => {
            const visibleSlugs = canvasState.visibleDynastySlugs;
            const isSingleDynasty = visibleSlugs.length === 1;
            
            // 如果只看到一个朝代，显示该朝代详情
            if (isSingleDynasty) {
              const visibleDynasty = bundle.dynastyBands.find(b => b.slug === visibleSlugs[0]);
              if (visibleDynasty) {
                // 从 dynasties 列表获取完整信息
                const dynastyInfo = dynasties.find(d => d.slug === visibleSlugs[0]);
                const dynastyNodes = bundle.nodes.filter(n => n.dynastySlug === visibleSlugs[0]);
                const nodeDynasty = new Map(bundle.nodes.map(n => [n.id, n.dynastySlug]));
                const dynastyEdges = bundle.edges.filter(e =>
                  nodeDynasty.get(e.source) === visibleSlugs[0] || nodeDynasty.get(e.target) === visibleSlugs[0]
                );
                
                return (
                  <div className="absolute top-4 left-4 max-w-sm bg-slate-900/85 border border-slate-700/60 rounded-xl p-4 backdrop-blur-md shadow-xl pointer-events-none">
                    <div className="flex items-baseline gap-2 mb-2">
                      <h2 className="font-serif text-xl text-amber-400">{visibleDynasty.name}</h2>
                      <span className="text-xs text-slate-500 font-mono">
                        {formatYear(visibleDynasty.startYear)} — {formatYear(visibleDynasty.endYear)}
                      </span>
                    </div>
                    {dynastyInfo && (
                      <p className="text-slate-300 text-xs leading-relaxed line-clamp-4 mb-3">{dynastyInfo.summary}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        {dynastyNodes.filter(n => n.entityType === 'person').length} 人物
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                        {dynastyNodes.filter(n => n.entityType === 'event').length} 事件
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                        {dynastyEdges.length} 关系
                      </span>
                    </div>
                  </div>
                );
              }
            }
            
            // 看到多个朝代，显示全局统计
            return (
              <div className="absolute top-4 left-4 bg-slate-900/85 border border-slate-700/60 rounded-xl p-4 backdrop-blur-md shadow-xl pointer-events-none">
                <div className="flex items-baseline gap-2 mb-2">
                  <h2 className="font-serif text-lg text-amber-400">中国历史</h2>
                  <span className="text-xs text-slate-500 font-mono">
                    {bundle.dynastyBands.length} 个朝代
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    {bundle.nodes.filter(n => n.entityType === 'person').length} 人物
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                    {bundle.nodes.filter(n => n.entityType === 'event').length} 事件
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                    {bundle.edges.length} 关系
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Dynasty summary card (top-left, single dynasty mode) */}
          {!focusedNodeId && (!bundle.dynastyBands || bundle.dynastyBands.length <= 1) && (
            <div className="absolute top-4 left-4 max-w-sm bg-slate-900/85 border border-slate-700/60 rounded-xl p-4 backdrop-blur-md shadow-xl pointer-events-none">
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="font-serif text-xl text-amber-400">{bundle.dynasty.name}</h2>
                <span className="text-xs text-slate-500 font-mono">
                  {formatYear(bundle.dynasty.startYear)} — {formatYear(bundle.dynasty.endYear)}
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed line-clamp-4">{bundle.dynasty.summary}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  {bundle.nodes.filter(n => n.entityType === 'person').length} 人物
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                  {bundle.nodes.filter(n => n.entityType === 'event').length} 事件
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                  {bundle.edges.length} 关系
                </span>
              </div>
            </div>
          )}

          {/* Legend */}
          {showLegend && (
            <div className="absolute bottom-4 left-4 bg-slate-900/95 border border-slate-700 rounded-xl p-4 backdrop-blur-md shadow-2xl max-w-[280px]">
              <div className="text-xs text-slate-400 mb-3 font-semibold uppercase tracking-wider">节点类型</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
                {NODE_LEGEND.map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/10" style={{ background: item.color }} />
                    <span className="text-xs text-slate-300">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-400 mb-2 mt-3 font-semibold uppercase tracking-wider border-t border-slate-800 pt-3">关系类型</div>
              <div className="flex flex-col gap-1.5">
                {EDGE_LEGEND.map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-6 h-0.5 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-slate-300">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interaction hint */}
          {!focusedNodeId && !showLegend && (
            <div className="absolute bottom-4 right-4 text-xs text-slate-500 bg-slate-900/70 px-3 py-1.5 rounded-full backdrop-blur-sm border border-slate-800 pointer-events-none">
              拖动平移 · 滚轮缩放 · 点击节点 · ESC 退出
            </div>
          )}
        </div>

        {/* Detail panel — right column */}
        <DetailPanel
          detail={detail}
          loading={detailLoading}
          error={detailError}
          currentDynastySlug={bundle.dynasty.slug}
          bundleNodeIds={new Set(bundle.nodes.map(n => n.id))}
          onClose={clearFocus}
          onNodeFocus={handleNodeFocus}
        />
      </div>

      {/* Timeline */}
      <Timeline
        entries={bundle.timeline}
        dynastyBands={bundle.dynastyBands ?? []}
        currentDynastySlug={bundle.dynasty.slug}
        focusedNodeId={focusedNodeId}
        onEventClick={handleTimelineClick}
      />
    </div>
  );
}

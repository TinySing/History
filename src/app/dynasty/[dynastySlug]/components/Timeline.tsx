'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { TimelineEntry, DynastyBand } from '@/lib/types';

interface Props {
  entries: TimelineEntry[];
  dynastyBands: DynastyBand[];
  currentDynastySlug: string;
  focusedNodeId: string | null;
  onEventClick: (nodeId: string, eventSlug: string) => void;
}

function formatYear(year: number | null | undefined): string {
  if (year == null) return '';
  return year < 0 ? `前${Math.abs(year)}` : `${year}`;
}

const DYNASTY_COLORS: Record<string, string> = {
  qin: '#F59E0B',
  'chu-han': '#EF4444',
  han: '#34D399',
  xin: '#8B5CF6',
  'dong-han': '#10B981',
  'san-guo': '#60A5FA',
  tang: '#F472B6',
  song: '#A78BFA',
  ming: '#FB923C',
  qing: '#EF4444',
};

function dynastyColor(slug: string): string {
  return DYNASTY_COLORS[slug] || '#94A3B8';
}

// 每个条目的预估宽度（px）
const ITEM_WIDTH = 120;
// 容器 padding
const PADDING = 80;

export default function Timeline({ entries, dynastyBands, currentDynastySlug, focusedNodeId, onEventClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [scrollLeft, setScrollLeft] = useState(0);

  // Group entries by dynastySlug for visual separation
  function entryDynastySlug(entry: TimelineEntry): string {
    const year = entry.year;
    for (const band of dynastyBands) {
      if (year >= band.startYear && year <= band.endYear) return band.slug;
    }
    return currentDynastySlug;
  }

  // 计算可见范围
  const updateVisibleRange = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    
    const { scrollLeft, clientWidth } = container;
    setScrollLeft(scrollLeft);
    
    // 计算可见范围，多渲染一些缓冲区
    const buffer = 10;
    const start = Math.max(0, Math.floor((scrollLeft - PADDING) / ITEM_WIDTH) - buffer);
    const end = Math.min(entries.length, Math.ceil((scrollLeft + clientWidth - PADDING) / ITEM_WIDTH) + buffer);
    
    setVisibleRange({ start, end });
  }, [entries.length]);

  // 监听滚动事件
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      requestAnimationFrame(updateVisibleRange);
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    // 初始化
    updateVisibleRange();
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updateVisibleRange]);

  // 当 focusedNodeId 变化时，滚动到对应位置
  useEffect(() => {
    if (!focusedNodeId || !scrollRef.current) return;
    
    const index = entries.findIndex(e => e.nodeId === focusedNodeId);
    if (index < 0) return;
    
    const targetScroll = PADDING + index * ITEM_WIDTH - scrollRef.current.clientWidth / 2 + ITEM_WIDTH / 2;
    scrollRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }, [focusedNodeId, entries]);

  if (entries.length === 0) return null;

  // 计算总宽度
  const totalWidth = PADDING * 2 + entries.length * ITEM_WIDTH;

  // 渲染可见条目
  const visibleEntries = entries.slice(visibleRange.start, visibleRange.end).map((entry, i) => {
    const index = visibleRange.start + i;
    const dynSlug = entryDynastySlug(entry);
    const color = dynastyColor(dynSlug);
    const isActive = focusedNodeId === entry.nodeId;
    const isCurrentDynasty = dynSlug === currentDynastySlug;
    
    // 检查是否是新朝代的开始
    const prevEntry = index > 0 ? entries[index - 1] : null;
    const showDynastyLabel = !prevEntry || entryDynastySlug(prevEntry) !== dynSlug;

    return (
      <div 
        key={entry.nodeId || index}
        className="flex items-center absolute"
        style={{ 
          left: PADDING + index * ITEM_WIDTH,
          width: ITEM_WIDTH,
        }}
      >
        {/* Dynasty separator label */}
        {showDynastyLabel && index > 0 && (
          <div className="w-px h-8 bg-slate-700 mx-1 shrink-0" />
        )}

        <button
          onClick={() => entry.nodeId && entry.eventSlug && onEventClick(entry.nodeId, entry.eventSlug)}
          className={`group flex flex-col items-center px-2.5 py-1.5 rounded-lg transition-all shrink-0 relative border
            ${isActive
              ? 'scale-105 shadow-lg'
              : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800'
            }`}
          style={isActive ? {
            background: color + '1a',
            borderColor: color + '80',
            boxShadow: `0 0 12px ${color}20`,
          } : {}}
        >
          <span className="text-[10px] font-mono leading-none"
            style={{ color: isActive ? color : '#64748b' }}>
            {formatYear(entry.year)}
          </span>
          <span className="text-xs mt-0.5 max-w-[100px] text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ color: isActive ? '#f1f5f9' : isCurrentDynasty ? '#94a3b8' : '#64748b' }}>
            {entry.label}
          </span>
          {/* Color dot */}
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
            style={{ background: isActive ? color : (isCurrentDynasty ? '#475569' : '#1e293b') }} />
        </button>
      </div>
    );
  });

  return (
    <div className="shrink-0 bg-gradient-to-t from-slate-950 to-slate-900/90 border-t border-slate-800">
      <div
        ref={scrollRef}
        className="relative overflow-x-auto overflow-y-hidden"
        style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: '#475569 transparent',
        }}
      >
        {/* 时间轴标签 */}
        <div className="sticky left-0 z-10 inline-flex items-center px-5 py-2.5">
          <span className="text-[10px] text-slate-500 shrink-0 mr-4 uppercase tracking-[0.2em] font-semibold">
            时间轴
          </span>
        </div>
        
        {/* 虚拟列表容器 */}
        <div 
          className="relative h-[60px]"
          style={{ width: totalWidth }}
        >
          {/* Continuous line */}
          <div className="absolute left-[40px] right-[40px] top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent pointer-events-none" />
          
          {visibleEntries}
        </div>
      </div>

      {/* Dynasty legend strip */}
      {dynastyBands.length > 1 && (
        <div className="flex items-center gap-3 px-5 pb-2">
          {dynastyBands.map(band => (
            <div key={band.slug} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ background: dynastyColor(band.slug) + '80' }} />
              <span className="text-[10px] font-serif"
                style={{ color: band.slug === currentDynastySlug ? dynastyColor(band.slug) : '#475569' }}>
                {band.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

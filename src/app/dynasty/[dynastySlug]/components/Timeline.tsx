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

const ITEM_WIDTH = 120;

export default function Timeline({ entries, dynastyBands, currentDynastySlug, focusedNodeId, onEventClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  function entryDynastySlug(entry: TimelineEntry): string {
    const year = entry.year;
    for (const band of dynastyBands) {
      if (year >= band.startYear && year <= band.endYear) return band.slug;
    }
    return currentDynastySlug;
  }

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    
    const buffer = 10;
    const start = Math.max(0, Math.floor(scrollLeft / ITEM_WIDTH) - buffer);
    const end = Math.min(entries.length, Math.ceil((scrollLeft + clientWidth) / ITEM_WIDTH) + buffer);
    setVisibleRange({ start, end });
  }, [entries.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => requestAnimationFrame(updateScrollState);
    container.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollState();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updateScrollState]);

  // 鼠标滚轮横向滚动
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      container.scrollLeft += e.deltaY || e.deltaX;
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // 聚焦时滚动到对应位置
  useEffect(() => {
    if (!focusedNodeId || !scrollRef.current) return;
    const index = entries.findIndex(e => e.nodeId === focusedNodeId);
    if (index < 0) return;
    const target = index * ITEM_WIDTH - scrollRef.current.clientWidth / 2 + ITEM_WIDTH / 2;
    scrollRef.current.scrollTo({ left: target, behavior: 'smooth' });
  }, [focusedNodeId, entries]);

  const scrollPage = useCallback((direction: 'left' | 'right') => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({ left: direction === 'left' ? -container.clientWidth * 0.7 : container.clientWidth * 0.7, behavior: 'smooth' });
  }, []);

  if (entries.length === 0) return null;

  const totalWidth = entries.length * ITEM_WIDTH;

  const visibleEntries = entries.slice(visibleRange.start, visibleRange.end).map((entry, i) => {
    const index = visibleRange.start + i;
    const dynSlug = entryDynastySlug(entry);
    const color = dynastyColor(dynSlug);
    const isActive = focusedNodeId === entry.nodeId;
    const isCurrentDynasty = dynSlug === currentDynastySlug;

    return (
      <div 
        key={entry.nodeId || index}
        className="flex items-center absolute"
        style={{ left: index * ITEM_WIDTH, width: ITEM_WIDTH }}
      >
        <button
          onClick={() => entry.nodeId && entry.eventSlug && onEventClick(entry.nodeId, entry.eventSlug)}
          className={`group flex flex-col items-center px-2.5 py-1.5 rounded-lg transition-all shrink-0 relative border
            ${isActive ? 'scale-105 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800'}`}
          style={isActive ? { background: color + '1a', borderColor: color + '80', boxShadow: `0 0 12px ${color}20` } : {}}
        >
          <span className="text-[10px] font-mono leading-none" style={{ color: isActive ? color : '#64748b' }}>
            {formatYear(entry.year)}
          </span>
          <span className="text-xs mt-0.5 max-w-[100px] text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ color: isActive ? '#f1f5f9' : isCurrentDynasty ? '#94a3b8' : '#64748b' }}>
            {entry.label}
          </span>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
            style={{ background: isActive ? color : (isCurrentDynasty ? '#475569' : '#1e293b') }} />
        </button>
      </div>
    );
  });

  return (
    <div className="shrink-0 bg-gradient-to-t from-slate-950 to-slate-900/90 border-t border-slate-800 relative px-10">
      {/* 左切换按钮 */}
      {canScrollLeft && (
        <button
          onClick={() => scrollPage('left')}
          className="absolute left-0 z-20 w-10 flex items-center justify-center group"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          <div className="w-8 h-8 rounded-full bg-slate-800/90 flex items-center justify-center group-hover:bg-slate-700 transition-colors shadow-lg shadow-black/50">
            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </button>
      )}

      {/* 滚动容器 */}
      <div ref={scrollRef} className="overflow-x-hidden py-2.5">
        <div className="relative h-[52px]" style={{ width: totalWidth }}>
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent pointer-events-none" />
          {visibleEntries}
        </div>
      </div>

      {/* 右切换按钮 */}
      {canScrollRight && (
        <button
          onClick={() => scrollPage('right')}
          className="absolute right-0 z-20 w-10 flex items-center justify-center group"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          <div className="w-8 h-8 rounded-full bg-slate-800/90 flex items-center justify-center group-hover:bg-slate-700 transition-colors shadow-lg shadow-black/50">
            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}

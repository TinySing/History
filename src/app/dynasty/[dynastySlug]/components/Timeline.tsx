'use client';

import { useRef, useEffect } from 'react';
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

export default function Timeline({ entries, dynastyBands, currentDynastySlug, focusedNodeId, onEventClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [focusedNodeId]);

  if (entries.length === 0) return null;

  // Group entries by dynastySlug for visual separation
  // Find which dynasty an entry belongs to by looking at dynastyBands year ranges
  function entryDynastySlug(entry: TimelineEntry): string {
    const year = entry.year;
    for (const band of dynastyBands) {
      if (year >= band.startYear && year <= band.endYear) return band.slug;
    }
    return currentDynastySlug;
  }

  return (
    <div className="shrink-0 bg-gradient-to-t from-slate-950 to-slate-900/90 border-t border-slate-800">
      <div
        ref={scrollRef}
        className="flex items-stretch overflow-x-auto px-5 py-2.5 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        <span className="text-[10px] text-slate-500 shrink-0 mr-4 uppercase tracking-[0.2em] font-semibold flex items-center">
          时间轴
        </span>

        <div className="flex items-center relative gap-0">
          {/* Continuous line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent pointer-events-none" />

          {(() => {
            let lastDynasty = '';
            return entries.map((entry, i) => {
              const dynSlug = entryDynastySlug(entry);
              const color = dynastyColor(dynSlug);
              const isActive = focusedNodeId === entry.nodeId;
              const isCurrentDynasty = dynSlug === currentDynastySlug;
              const showDynastyLabel = dynSlug !== lastDynasty;
              lastDynasty = dynSlug;

              return (
                <div key={i} className="flex items-center relative shrink-0">
                  {/* Dynasty separator label */}
                  {showDynastyLabel && i > 0 && (
                    <div className="w-px h-8 bg-slate-700 mx-1 shrink-0" />
                  )}
                  {showDynastyLabel && (
                    <div className="mr-1 text-[9px] font-serif shrink-0 -rotate-90 w-4"
                      style={{ color: color + '99' }}>
                    </div>
                  )}

                  <button
                    ref={isActive ? activeBtnRef : undefined}
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

                  {i < entries.length - 1 && <div className="w-4 shrink-0" />}
                </div>
              );
            });
          })()}
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

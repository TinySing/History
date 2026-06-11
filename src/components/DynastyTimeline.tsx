'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

type Dynasty = { slug: string; name: string; startYear: number; endYear: number };

function fmtYear(y: number): string {
  return y < 0 ? `前${Math.abs(y)}年` : `${y}年`;
}

export default function DynastyTimeline({ dynasties }: { dynasties: Dynasty[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  // Vertical wheel → horizontal scroll (non-passive so we can preventDefault)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (dynasties.length === 0) return null;

  const minYear = Math.min(...dynasties.map(d => d.startYear));
  const maxYear = Math.max(...dynasties.map(d => d.endYear));
  const span = maxYear - minYear || 1;

  // Proportional pixel width so the full span is scrollable horizontally
  const PX_PER_YEAR = 0.75;
  const MIN_BAR_PX = 48;
  const trackWidth = Math.max(span * PX_PER_YEAR, 1200);
  const x = (year: number) => ((year - minYear) / span) * trackWidth;

  // Color palette per dynasty index
  const COLORS = [
    { bar: '#F59E0B', text: 'text-amber-300' },
    { bar: '#60A5FA', text: 'text-blue-300' },
    { bar: '#34D399', text: 'text-emerald-300' },
    { bar: '#F472B6', text: 'text-pink-300' },
    { bar: '#A78BFA', text: 'text-violet-300' },
    { bar: '#FB923C', text: 'text-orange-300' },
  ];

  // Greedy lane assignment so overlapping (simultaneous) dynasties never collide
  const sorted = dynasties
    .map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => a.startYear - b.startYear);
  const laneEnds: number[] = [];
  const placed = sorted.map(d => {
    let lane = laneEnds.findIndex(end => end <= d.startYear);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(d.endYear);
    } else {
      laneEnds[lane] = d.endYear;
    }
    return { ...d, lane };
  });
  const laneCount = laneEnds.length;

  const LANE_H = 30;
  const LANE_GAP = 6;
  const tracksHeight = laneCount * LANE_H + (laneCount - 1) * LANE_GAP;

  // 200-year dashed gridlines for orientation
  const gridStep = 200;
  const gridStart = Math.ceil(minYear / gridStep) * gridStep;
  const grid: number[] = [];
  for (let y = gridStart; y <= maxYear; y += gridStep) grid.push(y);

  // Drag-to-scroll
  const onDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { down: true, startX: e.pageX, startLeft: el.scrollLeft, moved: false };
  };
  const onMove = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const onUp = () => {
    drag.current.down = false;
  };
  // Suppress click navigation if the user was dragging
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      ref={scrollRef}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onClickCapture={onClickCapture}
      className="relative mb-12 overflow-x-auto scrollbar-hide rounded-xl bg-slate-900 border border-slate-800 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="relative px-4 py-4" style={{ width: trackWidth + 32 }}>
        <div className="relative" style={{ height: tracksHeight }}>
          {grid.map(y => (
            <div
              key={`g${y}`}
              className="absolute top-0 bottom-0 w-px border-l border-dashed border-slate-700/50 pointer-events-none"
              style={{ left: x(y) }}
            >
              <span className="absolute -top-3 -translate-x-1/2 text-[10px] font-mono text-slate-600 whitespace-nowrap">
                {fmtYear(y)}
              </span>
            </div>
          ))}

          {placed.map(d => {
            const left = x(d.startYear);
            const width = Math.max(x(d.endYear) - left, MIN_BAR_PX);
            return (
              <Link
                key={d.slug}
                href={`/dynasty/${d.slug}`}
                draggable={false}
                className="absolute rounded-lg flex items-center justify-center text-xs font-serif font-medium transition-all duration-200 hover:brightness-125 ring-1 ring-white/10 hover:ring-2 hover:z-10"
                style={{
                  left,
                  width,
                  top: d.lane * (LANE_H + LANE_GAP),
                  height: LANE_H,
                  background: `${d.color.bar}22`,
                  borderColor: `${d.color.bar}44`,
                }}
                title={`${d.name} ${fmtYear(d.startYear)}–${fmtYear(d.endYear)}`}
              >
                <span className={`${d.color.text} truncate px-1.5`}>{d.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

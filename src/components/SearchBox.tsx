'use client';

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchResult } from '@/lib/types';
import { searchEntities } from '@/services/searchService';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const TYPE_LABEL: Record<string, string> = {
  person: '人物',
  event: '事件',
  dynasty: '朝代',
};

const TYPE_PILL: Record<string, string> = {
  person: 'bg-blue-900/50 text-blue-300 border border-blue-700/40',
  event: 'bg-rose-900/50 text-rose-300 border border-rose-700/40',
  dynasty: 'bg-amber-900/50 text-amber-300 border border-amber-700/40',
};

interface Props {
  placeholder?: string;
  onSelect?: (result: SearchResult) => boolean | void;
  compact?: boolean;
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-500/30 text-amber-200 px-0.5 rounded">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchBox({ placeholder = '搜索人物、事件、朝代…', onSelect, compact = false }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debouncedQuery = useDebounce(query, 200);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    searchEntities(debouncedQuery, controller.signal)
      .then(items => {
        setResults(items);
        setOpen(true);
        setActiveIdx(-1);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    inputRef.current?.blur();
    if (onSelect) {
      const handled = onSelect(result);
      if (handled !== false) return;
    }
    router.push(result.targetRoute);
  }, [router, onSelect]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') {
        setQuery('');
        inputRef.current?.blur();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = activeIdx >= 0 ? results[activeIdx] : results[0];
      if (target) handleSelect(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`w-full bg-slate-800/70 border border-slate-700 text-slate-100 placeholder-slate-500
                     rounded-lg ${compact ? 'py-2 text-sm' : 'py-2.5 text-sm'} pl-10 pr-10 outline-none
                     focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 focus:bg-slate-800
                     transition-all`}
        />
        {loading ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-400/60 border-t-transparent rounded-full animate-spin" />
        ) : query ? (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
            aria-label="清空"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute top-full mt-2 left-0 right-0 z-50 bg-slate-900/98 border border-slate-700 rounded-lg shadow-2xl shadow-black/50 overflow-hidden max-h-96 overflow-y-auto backdrop-blur-sm"
          role="listbox"
        >
          {results.map((r, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={`${r.entityType}-${r.entitySlug}`}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setActiveIdx(i)}
                role="option"
                aria-selected={isActive}
                className={`w-full px-4 py-2.5 text-left transition-colors flex items-center gap-3 border-b border-slate-800 last:border-0
                  ${isActive ? 'bg-slate-800' : 'hover:bg-slate-800/60'}`}
              >
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wider ${TYPE_PILL[r.entityType] || ''}`}>
                  {TYPE_LABEL[r.entityType] || r.entityType}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-slate-100 text-sm font-medium truncate">{highlight(r.displayName, query)}</div>
                  {r.subtitle && <div className="text-slate-500 text-xs truncate">{r.subtitle}</div>}
                </div>
                <svg className="w-3.5 h-3.5 text-slate-600 shrink-0 opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      {open && query.trim() && results.length === 0 && !loading && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-slate-900/98 border border-slate-700 rounded-lg shadow-xl px-4 py-3 backdrop-blur-sm">
          <p className="text-slate-400 text-sm">未找到 &ldquo;{query}&rdquo;</p>
          <p className="text-slate-600 text-xs mt-1">试试 &ldquo;曹操&rdquo; &ldquo;赤壁&rdquo; 或 &ldquo;秦朝&rdquo;</p>
        </div>
      )}
    </div>
  );
}

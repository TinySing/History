'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { EntityDetailProjection } from '@/lib/types';
import type { GraphCanvasHandle } from '@/app/dynasty/[dynastySlug]/components/GraphCanvas';
import { fetchEntityDetail } from '@/services/entityService';

export interface FocusState {
  focusedNodeId: string | null;
  detail: EntityDetailProjection | null;
  detailLoading: boolean;
  detailError: string | null;
  focusEntity: (nodeId: string, entityType: string, entitySlug: string) => void;
  clearFocus: () => void;
  handleNodeFocus: (nodeId: string) => void;
}

export function useDynastyFocus(graphRef: React.RefObject<GraphCanvasHandle | null>): FocusState {
  const searchParams = useSearchParams();
  const initialFocus = searchParams.get('focus');

  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(initialFocus);
  const [detail, setDetail] = useState<EntityDetailProjection | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Use AbortController to cancel in-flight requests on rapid focus change
  const abortRef = useRef<AbortController | null>(null);

  const loadDetail = useCallback((entityType: string, entitySlug: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setDetailLoading(true);
    setDetailError(null);

    fetchEntityDetail(entityType, entitySlug, controller.signal)
      .then(data => setDetail(data))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setDetailError('详情加载失败，请重试');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
  }, []);

  // Load initial focus from URL on mount
  useEffect(() => {
    if (!initialFocus) return;
    const [type, slug] = initialFocus.split(':');
    if (type && slug) loadDetail(type, slug);
    // Only run on mount — initialFocus is stable from searchParams snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync focus state with browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const focus = new URL(window.location.href).searchParams.get('focus');
      if (focus) {
        setFocusedNodeId(focus);
        const [type, slug] = focus.split(':');
        if (type && slug) loadDetail(type, slug);
      } else {
        setFocusedNodeId(null);
        setDetail(null);
        setDetailError(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadDetail]);

  // ESC key closes detail
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusedNodeId) clearFocus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // clearFocus captures graphRef — include focusedNodeId to re-bind when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedNodeId]);

  const focusEntity = useCallback((nodeId: string, entityType: string, entitySlug: string) => {
    setFocusedNodeId(nodeId);
    setDetail(null);
    setDetailError(null);
    loadDetail(entityType, entitySlug);
    const url = new URL(window.location.href);
    url.searchParams.set('focus', nodeId);
    window.history.pushState({}, '', url.toString());
    // 聚焦图谱到对应节点
    graphRef.current?.focusNode(nodeId);
  }, [loadDetail, graphRef]);

  const clearFocus = useCallback(() => {
    abortRef.current?.abort();
    setFocusedNodeId(null);
    setDetail(null);
    setDetailError(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('focus');
    window.history.pushState({}, '', url.toString());
    graphRef.current?.resetView();
  }, [graphRef]);

  const handleNodeFocus = useCallback((nodeId: string) => {
    const [type, slug] = nodeId.split(':');
    if (!type || !slug) return;
    focusEntity(nodeId, type, slug);
  }, [focusEntity]);

  return {
    focusedNodeId,
    detail,
    detailLoading,
    detailError,
    focusEntity,
    clearFocus,
    handleNodeFocus,
  };
}

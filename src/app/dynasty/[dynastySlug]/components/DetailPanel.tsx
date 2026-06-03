'use client';

import { useRouter } from 'next/navigation';
import type { EntityDetailProjection, PersonDetailProjection, EventDetailProjection } from '@/lib/types';
import { formatYear } from '@/utils/format';

const ROLE_LABEL: Record<string, string> = {
  emperor: '帝王', strategist: '谋士', general: '将领', minister: '臣子',
  royalty: '宗室', warlord: '诸侯', consort: '后妃', rebel: '义军', other: '其他',
};

const ROLE_COLOR: Record<string, string> = {
  emperor: 'from-amber-500/30 to-amber-700/10 border-amber-500/40 text-amber-300',
  strategist: 'from-violet-500/30 to-violet-700/10 border-violet-500/40 text-violet-300',
  general: 'from-emerald-500/30 to-emerald-700/10 border-emerald-500/40 text-emerald-300',
  minister: 'from-blue-500/30 to-blue-700/10 border-blue-500/40 text-blue-300',
  royalty: 'from-pink-500/30 to-pink-700/10 border-pink-500/40 text-pink-300',
  warlord: 'from-orange-500/30 to-orange-700/10 border-orange-500/40 text-orange-300',
  rebel: 'from-red-500/30 to-red-700/10 border-red-500/40 text-red-300',
  other: 'from-slate-500/30 to-slate-700/10 border-slate-500/40 text-slate-300',
};

const ROLE_AVATAR_BG: Record<string, string> = {
  emperor: 'from-amber-500 to-amber-700', strategist: 'from-violet-500 to-violet-700',
  general: 'from-emerald-500 to-emerald-700', minister: 'from-blue-500 to-blue-700',
  royalty: 'from-pink-500 to-pink-700', warlord: 'from-orange-500 to-orange-700',
  rebel: 'from-red-500 to-red-700', other: 'from-slate-500 to-slate-700',
};

const RELATION_LABEL: Record<string, string> = {
  blood: '血缘', political: '政治', conflict: '冲突',
  participation: '参与', subordinate: '从属',
};

const RELATION_STYLE: Record<string, string> = {
  blood: 'bg-red-500/15 text-red-300 border-red-500/30',
  political: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  conflict: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  participation: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  subordinate: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

interface Props {
  detail: EntityDetailProjection | null;
  loading: boolean;
  error: string | null;
  currentDynastySlug: string;
  bundleNodeIds: Set<string>;
  onClose: () => void;
  onNodeFocus: (nodeId: string) => void;
}

function ContentBlock({ content }: { content: string }) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-800">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">详细介绍</div>
      <div className="text-slate-400 text-xs leading-relaxed whitespace-pre-line">{content}</div>
    </div>
  );
}

function PersonPanel({
  detail, currentDynastySlug, bundleNodeIds, onNodeFocus,
}: {
  detail: PersonDetailProjection;
  currentDynastySlug: string;
  bundleNodeIds: Set<string>;
  onNodeFocus: (id: string) => void;
}) {
  const router = useRouter();
  const avatarGrad = ROLE_AVATAR_BG[detail.primaryRole] || ROLE_AVATAR_BG.other;
  const roleBadge = ROLE_COLOR[detail.primaryRole] || ROLE_COLOR.other;

  function handleRelatedPersonClick(slug: string, nodeId: string, dynastySlug: string) {
    if (dynastySlug === currentDynastySlug && bundleNodeIds.has(nodeId)) {
      onNodeFocus(nodeId);
    } else {
      router.push(`/dynasty/${dynastySlug}?focus=${nodeId}`);
    }
  }

  function handleRelatedEventClick(slug: string, nodeId: string, dynastySlug: string) {
    if (dynastySlug === currentDynastySlug && bundleNodeIds.has(nodeId)) {
      onNodeFocus(nodeId);
    } else {
      router.push(`/dynasty/${dynastySlug}?focus=${nodeId}`);
    }
  }

  return (
    <>
      <div className="flex items-start gap-3 mb-5">
        <div className={`shrink-0 w-16 h-20 rounded-xl overflow-hidden bg-gradient-to-br ${avatarGrad} flex items-center justify-center font-serif text-2xl text-white shadow-lg ring-1 ring-white/10`}>
          <img
            src={detail.imageUrl || '/images/default-person.svg'}
            alt={detail.name}
            className="w-full h-full object-cover object-top"
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/images/default-person.svg'; }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-gradient-to-r ${roleBadge} border font-medium`}>
              {ROLE_LABEL[detail.primaryRole] || detail.primaryRole}
            </span>
            <span className="text-xs text-slate-400">{detail.dynastyName}</span>
          </div>
          <h2 className="text-2xl font-serif text-slate-100 leading-tight">{detail.name}</h2>
          {(detail.birthYear || detail.deathYear) && (
            <p className="text-xs text-slate-500 font-mono mt-1">
              {detail.birthYear ? formatYear(detail.birthYear) : '?'}
              {' — '}
              {detail.deathYear ? formatYear(detail.deathYear) : '?'}
            </p>
          )}
        </div>
      </div>

      <p className="text-slate-300 text-sm leading-relaxed mb-5 border-l-2 border-amber-500/30 pl-3">
        {detail.summary || '资料持续补充中…'}
      </p>

      {detail.relatedPeople.length > 0 && (
        <div className="mb-5">
          <h3 className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            <span className="w-3 h-px bg-slate-600" />
            关联人物
            <span className="text-slate-600 font-normal">{detail.relatedPeople.length}</span>
          </h3>
          <div className="flex flex-col gap-1">
            {detail.relatedPeople.map(p => {
              const isCross = p.dynastySlug !== currentDynastySlug || !bundleNodeIds.has(p.nodeId);
              return (
                <button
                  key={p.slug}
                  onClick={() => handleRelatedPersonClick(p.slug, p.nodeId, p.dynastySlug)}
                  className="group flex items-center gap-2.5 text-left hover:bg-slate-800/60 rounded-lg px-2 py-2 -mx-2 transition-colors"
                >
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${RELATION_STYLE[p.relationType] || RELATION_STYLE.participation}`}>
                    {RELATION_LABEL[p.relationType]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200 text-sm group-hover:text-amber-300 transition-colors truncate">{p.name}</div>
                    {p.roleDescription && (
                      <div className="text-slate-500 text-xs truncate">{p.roleDescription}</div>
                    )}
                  </div>
                  {isCross && (
                    <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      跨朝代
                    </span>
                  )}
                  <svg className="w-3.5 h-3.5 text-slate-700 group-hover:text-amber-500 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {detail.relatedEvents.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            <span className="w-3 h-px bg-slate-600" />
            相关事件
            <span className="text-slate-600 font-normal">{detail.relatedEvents.length}</span>
          </h3>
          <div className="flex flex-col gap-1">
            {detail.relatedEvents.map(e => {
              const isCross = e.dynastySlug !== currentDynastySlug || !bundleNodeIds.has(e.nodeId);
              return (
                <button
                  key={e.slug}
                  onClick={() => handleRelatedEventClick(e.slug, e.nodeId, e.dynastySlug)}
                  className="group flex items-start gap-3 text-left hover:bg-slate-800/60 rounded-lg px-2 py-2 -mx-2 transition-colors"
                >
                  <span className="text-[10px] text-slate-500 font-mono shrink-0 mt-1 w-10">{formatYear(e.year)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200 text-sm group-hover:text-amber-300 transition-colors truncate">{e.name}</div>
                    {e.description && <div className="text-slate-500 text-xs truncate">{e.description}</div>}
                  </div>
                  {isCross && (
                    <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      跨朝代
                    </span>
                  )}
                  <svg className="w-3.5 h-3.5 text-slate-700 group-hover:text-amber-500 shrink-0 transition-colors mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {detail.content && <ContentBlock content={detail.content} />}
    </>
  );
}

function EventPanel({
  detail, currentDynastySlug, bundleNodeIds, onNodeFocus,
}: {
  detail: EventDetailProjection;
  currentDynastySlug: string;
  bundleNodeIds: Set<string>;
  onNodeFocus: (id: string) => void;
}) {
  const router = useRouter();

  function handleParticipantClick(nodeId: string, dynastySlug: string) {
    if (dynastySlug === currentDynastySlug && bundleNodeIds.has(nodeId)) {
      onNodeFocus(nodeId);
    } else {
      router.push(`/dynasty/${dynastySlug}?focus=${nodeId}`);
    }
  }

  return (
    <>
      <div className="flex items-start gap-3 mb-5">
        <div className="shrink-0 w-16 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-rose-500 to-rose-800 flex items-center justify-center shadow-lg ring-1 ring-white/10">
          <img
            src={detail.imageUrl || '/images/default-event.svg'}
            alt={detail.name}
            className="w-full h-full object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/images/default-event.svg'; }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-rose-500/30 to-rose-700/10 border border-rose-500/40 text-rose-300 font-medium">
              历史事件
            </span>
            <span className="text-xs text-slate-400">{detail.dynastyName}</span>
          </div>
          <h2 className="text-2xl font-serif text-slate-100 leading-tight">{detail.name}</h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            {formatYear(detail.timeStart)}
            {detail.timeEnd && detail.timeEnd !== detail.timeStart && ` – ${formatYear(detail.timeEnd)}`}
          </p>
        </div>
      </div>

      <p className="text-slate-300 text-sm leading-relaxed mb-5 border-l-2 border-rose-500/30 pl-3">
        {detail.summary || '资料持续补充中…'}
      </p>

      {detail.participants.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            <span className="w-3 h-px bg-slate-600" />
            核心人物
            <span className="text-slate-600 font-normal">{detail.participants.length}</span>
          </h3>
          <div className="flex flex-col gap-1">
            {detail.participants.map(p => {
              const isCross = p.dynastySlug !== currentDynastySlug || !bundleNodeIds.has(p.nodeId);
              return (
                <button
                  key={p.slug}
                  onClick={() => handleParticipantClick(p.nodeId, p.dynastySlug)}
                  className="group flex items-center gap-2 text-left hover:bg-slate-800/60 rounded-lg px-2 py-2 -mx-2 transition-colors"
                >
                  <span className="shrink-0 w-7 h-7 rounded-full bg-slate-800 ring-1 ring-slate-700 flex items-center justify-center text-xs font-serif text-slate-300 group-hover:text-amber-300 group-hover:ring-amber-500/40 transition-colors">
                    {p.name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200 text-sm group-hover:text-amber-300 transition-colors truncate">{p.name}</div>
                    {p.roleDescription && <div className="text-slate-500 text-xs truncate">{p.roleDescription}</div>}
                  </div>
                  {isCross && (
                    <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      跨朝代
                    </span>
                  )}
                  <svg className="w-3.5 h-3.5 text-slate-700 group-hover:text-amber-500 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {detail.content && <ContentBlock content={detail.content} />}
    </>
  );
}

export default function DetailPanel({ detail, loading, error, currentDynastySlug, bundleNodeIds, onClose, onNodeFocus }: Props) {
  const visible = loading || error !== null || detail !== null;
  if (!visible) return null;

  return (
    <aside className="w-[26rem] shrink-0 h-full bg-slate-900/95 border-r border-slate-800 flex flex-col shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-semibold">详情</span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          aria-label="关闭"
          title="关闭 (ESC)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {loading && (
          <div className="flex items-center gap-3 text-slate-400 py-4">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">加载详情…</span>
          </div>
        )}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
        {detail && !loading && (
          detail.entityType === 'person'
            ? <PersonPanel
                detail={detail as PersonDetailProjection}
                currentDynastySlug={currentDynastySlug}
                bundleNodeIds={bundleNodeIds}
                onNodeFocus={onNodeFocus}
              />
            : <EventPanel
                detail={detail as EventDetailProjection}
                currentDynastySlug={currentDynastySlug}
                bundleNodeIds={bundleNodeIds}
                onNodeFocus={onNodeFocus}
              />
        )}
      </div>
    </aside>
  );
}

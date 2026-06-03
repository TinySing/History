import Link from 'next/link';
import { getDynasties } from '@/lib/queries';
import SearchBox from '@/components/SearchBox';

export const dynamic = 'force-dynamic';

function fmtYear(y: number): string {
  return y < 0 ? `前${Math.abs(y)}年` : `${y}年`;
}

function DynastyTimeline({ dynasties }: { dynasties: { slug: string; name: string; startYear: number; endYear: number }[] }) {
  if (dynasties.length === 0) return null;

  const minYear = Math.min(...dynasties.map(d => d.startYear));
  const maxYear = Math.max(...dynasties.map(d => d.endYear));
  const span = maxYear - minYear || 1;

  // Color palette per dynasty index
  const COLORS = [
    { bar: '#F59E0B', glow: 'shadow-amber-500/20', ring: 'hover:ring-amber-400/50', text: 'text-amber-300' },
    { bar: '#60A5FA', glow: 'shadow-blue-500/20', ring: 'hover:ring-blue-400/50', text: 'text-blue-300' },
    { bar: '#34D399', glow: 'shadow-emerald-500/20', ring: 'hover:ring-emerald-400/50', text: 'text-emerald-300' },
    { bar: '#F472B6', glow: 'shadow-pink-500/20', ring: 'hover:ring-pink-400/50', text: 'text-pink-300' },
    { bar: '#A78BFA', glow: 'shadow-violet-500/20', ring: 'hover:ring-violet-400/50', text: 'text-violet-300' },
    { bar: '#FB923C', glow: 'shadow-orange-500/20', ring: 'hover:ring-orange-400/50', text: 'text-orange-300' },
  ];

  return (
    <div className="relative mb-12">
      <div className="flex items-center justify-between mb-2 text-xs text-slate-600 font-mono">
        <span>{fmtYear(minYear)}</span>
        <span>{fmtYear(maxYear)}</span>
      </div>

      {/* Timeline track */}
      <div className="relative h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        {/* Axis line */}
        <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none px-0">
          <div className="w-full h-px bg-slate-700/50" />
        </div>

        {dynasties.map((d, i) => {
          const left = ((d.startYear - minYear) / span) * 100;
          const width = Math.max(((d.endYear - d.startYear) / span) * 100, 2);
          const color = COLORS[i % COLORS.length];

          return (
            <Link
              key={d.slug}
              href={`/dynasty/${d.slug}`}
              className={`absolute top-1 bottom-1 rounded-lg flex items-center justify-center text-xs font-serif font-medium transition-all duration-200 hover:brightness-125 ring-1 ring-white/10 ${color.ring} hover:ring-2`}
              style={{ left: `${left}%`, width: `${width}%`, background: `${color.bar}22`, borderColor: `${color.bar}44` }}
              title={`${d.name} ${fmtYear(d.startYear)}–${fmtYear(d.endYear)}`}
            >
              <span className={`${color.text} truncate px-1.5`}>{d.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Year markers */}
      <div className="relative h-4 mt-1">
        {dynasties.map((d, i) => {
          const left = ((d.startYear - minYear) / span) * 100;
          const color = COLORS[i % COLORS.length];
          return (
            <span
              key={d.slug}
              className="absolute text-[10px] font-mono -translate-x-1/2"
              style={{ left: `${left}%`, color: color.bar + 'aa' }}
            >
              {fmtYear(d.startYear)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default async function HomePage() {
  let data;
  try {
    data = await getDynasties();
  } catch {
    data = { dynasties: [], featured: [] };
  }
  const { dynasties, featured } = data;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-x-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-1/4 w-[40rem] h-[40rem] bg-amber-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-[30rem] h-[30rem] bg-rose-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-[50rem] h-[30rem] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative px-6 py-4 flex items-center justify-between border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/60 sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-900 font-serif font-bold shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-shadow">
            史
          </div>
          <div>
            <div className="font-serif text-lg text-slate-100 leading-none">史迹</div>
            <div className="text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">Historical Atlas</div>
          </div>
        </Link>
        <div className="w-80 hidden sm:block">
          <SearchBox placeholder="搜索人物、事件、朝代…" compact />
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 py-16 sm:py-24 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 select-none pointer-events-none">
          <span className="font-serif text-[20rem] sm:text-[28rem] leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-400/[0.07] to-transparent">
            史
          </span>
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-amber-400/80 text-xs tracking-[0.25em] uppercase">探索 · 连接 · 理解</p>
          </div>
          <h1 className="text-4xl sm:text-6xl font-serif text-slate-100 mb-4 tracking-wide leading-tight">
            中国历史
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500"> 人物关系 </span>
            图谱
          </h1>
          <p className="text-slate-400 text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            从朝代进入，沿关系探索。<br className="sm:hidden" />
            搜索任意人物或事件，立刻置身其历史网络。
          </p>
          <div className="max-w-xl mx-auto">
            <SearchBox placeholder={'输入人物名、事件名或朝代名 — 试试 "曹操" "赤壁" "秦朝"'} />
          </div>
        </div>
      </section>

      {/* Timeline + Dynasties */}
      <section className="relative px-6 py-12 max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-serif text-2xl text-slate-100 flex items-center gap-3">
            <span className="w-8 h-px bg-amber-500/40" />
            历史时间轴
          </h2>
          <span className="text-xs text-slate-500">共 {dynasties.length} 个时期</span>
        </div>

        {dynasties.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
            <div className="inline-block w-8 h-8 border-2 border-amber-400/60 border-t-transparent rounded-full animate-spin mb-3" />
            <div className="text-slate-400 text-sm mb-1">数据初始化中</div>
            <div className="text-slate-600 text-xs">首次启动需要导入种子数据，请稍候</div>
          </div>
        ) : (
          <>
            <DynastyTimeline dynasties={dynasties} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {dynasties.map((d, i) => {
                const ACCENT = ['amber', 'blue', 'emerald', 'pink', 'violet', 'orange'];
                const accent = ACCENT[i % ACCENT.length];
                return (
                  <Link
                    key={d.slug}
                    href={`/dynasty/${d.slug}`}
                    className="group relative block bg-gradient-to-br from-slate-900 to-slate-900/60 hover:from-slate-800 hover:to-slate-900
                               border border-slate-800 hover:border-slate-700
                               rounded-2xl p-6 transition-all duration-300
                               hover:shadow-2xl hover:-translate-y-0.5 overflow-hidden"
                  >
                    <div className={`absolute -top-12 -right-12 w-40 h-40 bg-${accent}-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />

                    <div className="relative flex items-start justify-between mb-3">
                      <div>
                        <h3 className={`text-2xl font-serif text-slate-100 group-hover:text-${accent}-300 transition-colors mb-1`}>
                          {d.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">
                          {fmtYear(d.startYear)} — {fmtYear(d.endYear)}
                          <span className="ml-2 text-slate-700">·</span>
                          <span className="ml-2 text-slate-600">约 {Math.abs(d.endYear - d.startYear)} 年</span>
                        </p>
                      </div>
                      <div className="shrink-0 w-9 h-9 rounded-lg border border-slate-700 group-hover:border-slate-600 flex items-center justify-center transition-all">
                        <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                    <p className="relative text-slate-400 text-sm line-clamp-3 leading-relaxed">{d.summary}</p>

                    <div className="relative mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        进入图谱探索
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="relative px-6 py-12 max-w-6xl mx-auto">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-serif text-2xl text-slate-100 flex items-center gap-3">
              <span className="w-8 h-px bg-amber-500/40" />
              推荐入口
            </h2>
            <span className="text-xs text-slate-500">从一个具体故事进入</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {featured.map((item, i) => (
              <Link
                key={i}
                href={item.targetRoute}
                className="group relative block bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/30 rounded-xl p-4 transition-all duration-200"
              >
                <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2 font-semibold">
                  #{String(i + 1).padStart(2, '0')}
                </div>
                <div className="text-sm text-slate-100 group-hover:text-amber-300 font-medium mb-1.5 transition-colors leading-tight">
                  {item.label}
                </div>
                <div className="text-xs text-slate-500 leading-snug">{item.description}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="relative px-6 py-12 text-center border-t border-slate-800/50 mt-8">
        <p className="text-slate-600 text-xs leading-relaxed">
          资料持续补充中 · 当前收录秦朝、三国时期<br />
          <span className="text-slate-700">缩小画板可查看概览，放大可查看更多节点详情</span>
        </p>
      </footer>
    </div>
  );
}

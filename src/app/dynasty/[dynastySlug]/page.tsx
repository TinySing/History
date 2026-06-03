import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getGraphBundle, getDynasties } from '@/lib/queries';
import DynastyGraphPage from './components/DynastyGraphPage';

export const dynamic = 'force-dynamic';

interface Props {
  params: { dynastySlug: string };
}

export default async function DynastyPage({ params }: Props) {
  const [bundle, dynastiesData] = await Promise.all([
    getGraphBundle(params.dynastySlug).catch(() => null),
    getDynasties().catch(() => ({ dynasties: [], featured: [] })),
  ]);

  if (!bundle) {
    notFound();
  }

  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>加载图谱中…</span>
        </div>
      </div>
    }>
      <DynastyGraphPage
        bundle={bundle}
        dynasties={dynastiesData.dynasties}
      />
    </Suspense>
  );
}

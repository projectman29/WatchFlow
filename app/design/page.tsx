import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DESIGN_STATUSES, designQueue, getDesignSummary, type DesignStatus } from '@/lib/design';

const ORDER_STATUS_TO_DESIGN: Record<string, DesignStatus> = {
  NEW: 'NEW',
  WAITING_DESIGN: 'NEW',
  DESIGN_IN_PROGRESS: 'IN_PROGRESS',
  WAITING_CLIENT_APPROVAL: 'READY_FOR_REVIEW',
  DESIGN_APPROVED: 'APPROVED',
};

const NEXT_DESIGN_STATUS: Partial<Record<DesignStatus, string>> = {
  NEW: 'DESIGN_IN_PROGRESS',
  IN_PROGRESS: 'WAITING_CLIENT_APPROVAL',
  READY_FOR_REVIEW: 'DESIGN_APPROVED',
};

type DesignWork = {
  id: string;
  orderId?: string;
  order: string;
  client: string;
  artist: string;
  asset: string;
  version: number;
  status: DesignStatus;
};

export default async function DesignPage({
  searchParams,
}: {
  searchParams?: { updated?: string } | Promise<{ updated?: string }>;
}) {
  const user = await getCurrentUserFromCookies();
  if (!user) redirect('/login');
  if (!canAccessSection(user.role, 'design')) redirect('/dashboard');

  let work: DesignWork[] = designQueue.map((job) => ({ ...job }));
  let databaseAvailable = false;
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: Object.keys(ORDER_STATUS_TO_DESIGN) } },
      include: { client: true, items: { take: 1 } },
      orderBy: { updatedAt: 'asc' },
    });
    work = orders.map((order) => ({
      id: order.id,
      orderId: order.id,
      order: order.number,
      client: order.client?.name ?? 'Неизвестный клиент',
      artist: user.name,
      asset: order.items[0]?.productName ?? 'Макет часов',
      version: 1,
      status: ORDER_STATUS_TO_DESIGN[order.status],
    }));
    databaseAvailable = true;
  } catch (error) {
    console.error('Unable to load design orders:', error);
  }

  const params = searchParams ? await searchParams : {};
  const summary = getDesignSummary(work);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Design</p><h1 className="mt-2 text-3xl font-bold">Очередь дизайнеров</h1></div>
          <div className="flex items-center gap-3"><Link href="/dashboard" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Dashboard</Link><Link href="/production" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">Производство</Link></div>
        </header>

        {params.updated ? <p className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Этап дизайна сохранён в заказе.</p> : null}
        {!databaseAvailable ? <p className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Показаны демо-макеты: база недоступна, изменения не сохраняются.</p> : null}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Всего" value={summary.total} accent="text-cyan-300" />
          <MetricCard label="В работе" value={summary.inProgress} accent="text-violet-300" />
          <MetricCard label="На согласовании" value={work.filter((job) => job.status === 'READY_FOR_REVIEW').length} accent="text-amber-300" />
          <MetricCard label="На доработке" value={summary.revision} accent="text-rose-300" />
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          {DESIGN_STATUSES.map((status) => {
            const items = work.filter((job) => job.status === status);
            return <div key={status} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3"><span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">{status}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{items.length}</span></div>
              <div className="space-y-3">
                {items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">Пусто</div> : items.map((job) => <article key={job.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold text-white">{job.client}</p><span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase text-slate-300">v{job.version}</span></div>
                  <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">{job.order}</p><p className="mt-2 text-sm text-cyan-300">Дизайнер: {job.artist}</p><p className="mt-2 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200">{job.asset}</p>
                  {databaseAvailable && job.orderId && NEXT_DESIGN_STATUS[status] ? <form className="mt-3" action="/api/orders/workflow" method="POST"><input type="hidden" name="orderId" value={job.orderId} /><input type="hidden" name="status" value={NEXT_DESIGN_STATUS[status]} /><button type="submit" className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950">{status === 'READY_FOR_REVIEW' ? 'Подтвердить дизайн' : 'Перевести на следующий этап'}</button></form> : null}
                  {databaseAvailable && job.orderId && status === 'READY_FOR_REVIEW' ? <form className="mt-2" action="/api/orders/workflow" method="POST"><input type="hidden" name="orderId" value={job.orderId} /><input type="hidden" name="status" value="DESIGN_IN_PROGRESS" /><button type="submit" className="w-full rounded-lg border border-amber-500/50 px-3 py-2 text-xs font-semibold text-amber-200">Вернуть на доработку</button></form> : null}
                </article>)}
              </div>
            </div>;
          })}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm uppercase tracking-[0.15em] text-slate-400">{label}</p><p className={`mt-3 text-3xl font-bold ${accent}`}>{value}</p></div>;
}

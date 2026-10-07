import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getProductionStatusIndex,
  getProductionSummary,
  productionQueue,
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABELS,
  type ProductionStatus,
} from '@/lib/production';

const ORDER_STATUS_TO_PRODUCTION: Record<string, ProductionStatus> = {
  DESIGN_APPROVED: 'WAITING_PRODUCTION',
  WAITING_PRODUCTION: 'WAITING_PRODUCTION',
  IN_PRODUCTION: 'IN_PROGRESS',
  QUALITY_CONTROL: 'QUALITY_CONTROL',
  READY_FOR_PACKING: 'READY_FOR_PACKING',
  READY_FOR_SHIPMENT: 'READY_FOR_SHIPMENT',
};
const NEXT_ORDER_STATUS: Partial<Record<ProductionStatus, string>> = {
  WAITING_PRODUCTION: 'IN_PRODUCTION',
  IN_PROGRESS: 'QUALITY_CONTROL',
  QUALITY_CONTROL: 'READY_FOR_PACKING',
  READY_FOR_PACKING: 'READY_FOR_SHIPMENT',
};

type ProductionWork = {
  id: string;
  orderId?: string;
  order: string;
  client: string;
  model: string;
  master: string;
  status: ProductionStatus;
  progress: number;
  deadline: string;
  note: string;
};

export default async function ProductionPage({
  searchParams,
}: {
  searchParams?: { updated?: string } | Promise<{ updated?: string }>;
}) {
  const user = await getCurrentUserFromCookies();
  if (!user) redirect('/login');
  if (!canAccessSection(user.role, 'production')) redirect('/dashboard');

  let tasks: ProductionWork[] = productionQueue.map((task) => ({ ...task }));
  let databaseAvailable = false;
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: Object.keys(ORDER_STATUS_TO_PRODUCTION) } },
      include: { client: true, items: { take: 1 } },
      orderBy: { updatedAt: 'asc' },
    });
    tasks = orders.map((order) => {
      const status = ORDER_STATUS_TO_PRODUCTION[order.status];
      return {
        id: order.id,
        orderId: order.id,
        order: order.number,
        client: order.client?.name ?? 'Неизвестный клиент',
        model: order.items[0]?.model ?? order.items[0]?.productName ?? 'Модель не указана',
        master: user.name,
        status,
        progress: Math.round(((getProductionStatusIndex(status) + 1) / PRODUCTION_STATUSES.length) * 100),
        deadline: 'Не указан',
        note: 'Статус сохраняется в карточке заказа.',
      };
    });
    databaseAvailable = true;
  } catch (error) {
    console.error('Unable to load production orders:', error);
  }

  const params = searchParams ? await searchParams : {};
  const summary = getProductionSummary(tasks);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Production</p><h1 className="mt-2 text-3xl font-bold">Производство</h1></div>
          <div className="flex items-center gap-3"><Link href="/design" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Дизайн</Link><Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">Dashboard</Link></div>
        </header>

        {params.updated ? <p className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Производственный этап сохранён в заказе.</p> : null}
        {!databaseAvailable ? <p className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Показаны демо-заказы: база недоступна, изменения не сохраняются.</p> : null}

        <section className="mb-8 grid gap-4 md:grid-cols-4"><MetricCard label="Всего" value={summary.total} accent="text-cyan-300" /><MetricCard label="В работе" value={summary.inProgress} accent="text-violet-300" /><MetricCard label="Готовы" value={summary.ready} accent="text-emerald-300" /><MetricCard label="На доработке" value={summary.revision} accent="text-rose-300" /></section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm uppercase tracking-[0.15em] text-slate-400">В производственной очереди</p><h2 className="mt-2 text-2xl font-semibold text-white">{tasks.length} заказов</h2></div><span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-amber-300">{tasks.filter((task) => task.status === 'WAITING_PRODUCTION').length} ожидают запуска</span></div></section>

        <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {PRODUCTION_STATUSES.map((status) => {
            const items = tasks.filter((task) => task.status === status);
            return <div key={status} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3"><span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">{PRODUCTION_STATUS_LABELS[status] ?? status}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{items.length}</span></div>
              <div className="space-y-3">{items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">Пусто</div> : items.map((task) => <article key={task.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <div className="flex items-center justify-between gap-2"><p className="font-semibold text-cyan-300">{task.order}</p><span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">{task.model}</span></div>
                <p className="mt-2 text-sm text-slate-100">{task.client}</p><p className="mt-2 text-xs text-slate-400">Мастер: {task.master}</p><p className="mt-2 text-xs text-slate-400">Дедлайн: {task.deadline}</p>
                <div className="mt-3"><div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-slate-400"><span>Прогресс</span><span>{task.progress}%</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-cyan-400" style={{ width: `${task.progress}%` }} /></div></div>
                <p className="mt-3 rounded-lg bg-slate-800 px-2 py-1 text-[11px] text-slate-200">{task.note}</p><div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-slate-500"><span>Этап</span><span>{getProductionStatusIndex(task.status) + 1}/{PRODUCTION_STATUSES.length}</span></div>
                {databaseAvailable && task.orderId && NEXT_ORDER_STATUS[status] ? <form className="mt-3" action="/api/orders/workflow" method="POST"><input type="hidden" name="orderId" value={task.orderId} /><input type="hidden" name="status" value={NEXT_ORDER_STATUS[status]} /><button type="submit" className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950">{status === 'WAITING_PRODUCTION' ? 'Начать производство' : 'Завершить этап'}</button></form> : null}
              </article>)}</div>
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

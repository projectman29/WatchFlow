import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import {
  getProductionQueueByPriority,
  getProductionStatusIndex,
  getProductionSummary,
  productionQueue,
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABELS,
} from '@/lib/production';

export default async function ProductionPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user.role, 'production')) {
    redirect('/dashboard');
  }

  const summary = getProductionSummary(productionQueue);
  const orderedTasks = getProductionQueueByPriority(productionQueue);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Production</p>
            <h1 className="mt-2 text-3xl font-bold">Производство</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/design" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Дизайн
            </Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <MetricCard label="Всего" value={summary.total} accent="text-cyan-300" />
          <MetricCard label="В работе" value={summary.inProgress} accent="text-violet-300" />
          <MetricCard label="Готовы" value={summary.ready} accent="text-emerald-300" />
          <MetricCard label="На доработке" value={summary.revision} accent="text-rose-300" />
          <MetricCard label="Просрочено" value={summary.overdue} accent="text-amber-300" />
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Сегодня необходимо изготовить</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{summary.total} заказов</h2>
            </div>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-amber-300">
              {summary.overdue > 0 ? `${summary.overdue} просрочено` : 'Все в срок'}
            </span>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {PRODUCTION_STATUSES.map((status) => {
            const items = orderedTasks.filter((task) => task.status === status);

            return (
              <div key={status} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
                    {PRODUCTION_STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{items.length}</span>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">Пусто</div>
                  ) : (
                    items.map((task) => (
                      <article key={task.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-cyan-300">{task.order}</p>
                          <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                            {task.model}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-100">{task.client}</p>
                        <p className="mt-2 text-xs text-slate-400">Мастер: {task.master}</p>
                        <p className="mt-2 text-xs text-slate-400">Дедлайн: {task.deadline}</p>
                        {task.deadline && new Date(`${task.deadline}T00:00:00`) < new Date() && task.status !== 'COMPLETED' && task.status !== 'READY_FOR_SHIPMENT' && task.status !== 'CANCELLED' ? (
                          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-amber-300">Просрочен</p>
                        ) : null}
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-slate-400">
                            <span>Прогресс</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800">
                            <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${task.progress}%` }} />
                          </div>
                        </div>
                        <p className="mt-3 rounded-lg bg-slate-800 px-2 py-1 text-[11px] text-slate-200">{task.note}</p>
                        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          <span>Этап</span>
                          <span>{getProductionStatusIndex(task.status) + 1}/{PRODUCTION_STATUSES.length}</span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

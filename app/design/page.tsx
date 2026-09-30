import Link from 'next/link';
import { DESIGN_STATUSES, designQueue, getDesignSummary } from '@/lib/design';

export default function DesignPage() {
  const summary = getDesignSummary(Array.from(designQueue) as unknown as Array<{ status: (typeof DESIGN_STATUSES)[number] }>);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Design</p>
            <h1 className="mt-2 text-3xl font-bold">Очередь дизайнеров</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Dashboard
            </Link>
            <Link href="/production" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Производство
            </Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Всего" value={summary.total} accent="text-cyan-300" />
          <MetricCard label="В работе" value={summary.inProgress} accent="text-violet-300" />
          <MetricCard label="На согласовании" value={summary.total - summary.approved - summary.revision} accent="text-amber-300" />
          <MetricCard label="На доработке" value={summary.revision} accent="text-rose-300" />
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          {DESIGN_STATUSES.map((status) => {
            const items = designQueue.filter((job) => job.status === status);

            return (
              <div key={status} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">{status}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{items.length}</span>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">Пусто</div>
                  ) : (
                    items.map((job) => (
                      <article key={job.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-white">{job.client}</p>
                          <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase text-slate-300">
                            v{job.version}
                          </span>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">{job.order}</p>
                        <p className="mt-2 text-sm text-cyan-300">{job.artist}</p>
                        <p className="mt-2 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200">{job.asset}</p>
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

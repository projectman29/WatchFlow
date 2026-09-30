import Link from 'next/link';
import { LEAD_SOURCES, LEAD_STAGES, getLeadSourceSummary, getPipelineSummary } from '@/lib/crm';
import { demoLeads, demoOrders } from '@/lib/demo-data';

export default function CRMPage() {
  const pipelineSummary = getPipelineSummary(demoLeads);
  const sourceSummary = getLeadSourceSummary(demoLeads);
  const stageGroups = LEAD_STAGES.map((stage) => ({
    stage,
    leads: demoLeads.filter((lead) => lead.status === stage),
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">CRM</p>
            <h1 className="mt-2 text-3xl font-bold">Воронка продаж</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Dashboard
            </Link>
            <Link href="/orders" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Заказы
            </Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Всего лидов" value={pipelineSummary.total} accent="text-cyan-300" />
          <MetricCard label="В работе" value={pipelineSummary.inProgress} accent="text-violet-300" />
          <MetricCard label="WON" value={pipelineSummary.won} accent="text-emerald-300" />
          <MetricCard label="LOST" value={pipelineSummary.lost} accent="text-rose-300" />
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Источники лидов</h2>
              <span className="text-sm text-slate-400">{sourceSummary.length} каналов</span>
            </div>

            <div className="space-y-3">
              {sourceSummary.map(({ source, count }) => (
                <div key={source} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                  <span className="text-sm text-slate-300">{source}</span>
                  <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-semibold">Новая заявка</h2>
            <form className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">
                Клиент
                <input defaultValue="Елизавета Ковалева" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  Телефон
                  <input defaultValue="+7 701 234 56 78" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" />
                </label>

                <label className="block text-sm text-slate-300">
                  Сумма
                  <input defaultValue="2650" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" />
                </label>
              </div>

              <label className="block text-sm text-slate-300">
                Источник
                <select defaultValue="Instagram" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Менеджер
                <select defaultValue="Марина" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                  <option>Марина</option>
                  <option>Иван</option>
                  <option>Ольга</option>
                </select>
              </label>

              <button type="button" className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400">
                Сохранить лид
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-6">
          {stageGroups.map(({ stage, leads }) => (
            <div key={stage} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">{stage}</span>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{leads.length}</span>
              </div>

              <div className="space-y-3">
                {leads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">
                    Нет лидов
                  </div>
                ) : (
                  leads.map((lead) => (
                    <div key={lead.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                      <p className="font-semibold text-white">{lead.client}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{lead.source}</p>
                      <p className="mt-2 text-sm text-cyan-300">€{lead.value}</p>
                      {lead.reasonLost ? (
                        <p className="mt-2 text-xs text-rose-300">Причина: {lead.reasonLost}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Заказы в работе</h2>
            <span className="text-sm text-slate-400">{demoOrders.length} записей</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {demoOrders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-300">{order.number}</span>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                    {order.status}
                  </span>
                </div>
                <p className="mt-3 text-lg font-semibold">{order.client}</p>
                <p className="text-sm text-slate-400">{order.product}</p>
                <p className="mt-2 text-xl font-bold text-emerald-300">€{order.total}</p>
                <p className="mt-3 text-xs text-slate-400">Ответственный: {order.assignee}</p>
              </article>
            ))}
          </div>
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

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getReadyForShipmentOrders, getShipmentSummary, LOGISTICS_STATUS_LABELS, LOGISTICS_STATUSES, readyShipments } from '@/lib/logistics';

export default async function LogisticsPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user.role, 'logistics')) {
    redirect('/dashboard');
  }

  const summary = getShipmentSummary(readyShipments);
  const readyQueue = getReadyForShipmentOrders(readyShipments);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Logistics</p>
            <h1 className="mt-2 text-3xl font-bold">Готовые к отправке</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/warehouse" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Склад
            </Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Готовы" value={summary.ready} accent="text-cyan-300" />
          <MetricCard label="Отправлены" value={summary.shipped} accent="text-violet-300" />
          <MetricCard label="Доставлены" value={summary.delivered} accent="text-emerald-300" />
          <MetricCard label="Всего" value={summary.total} accent="text-amber-300" />
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Очередь отправки</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{readyQueue.length} заказов</h2>
            </div>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-emerald-300">
              ready to ship
            </span>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {readyShipments.map((shipment) => (
            <article key={shipment.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{shipment.order}</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">{shipment.client}</h3>
                </div>
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-cyan-300">
                  {LOGISTICS_STATUS_LABELS[shipment.status] ?? shipment.status}
                </span>
              </div>

              <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                <InfoRow label="Телефон" value={shipment.phone} />
                <InfoRow label="Город" value={shipment.city} />
                <InfoRow label="Адрес" value={shipment.address} />
                <InfoRow label="Служба" value={shipment.service} />
                <InfoRow label="Тип доставки" value={shipment.deliveryType} />
                <InfoRow label="Трек" value={shipment.tracking} />
                <InfoRow label="Сумма" value={`€${shipment.amount}`} />
                <InfoRow label="Наложенный" value={`€${shipment.cashOnDelivery}`} />
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Комментарий</p>
                <p className="mt-2 text-sm text-slate-200">{shipment.note}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Статусы доставки</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {LOGISTICS_STATUSES.map((status) => (
              <span
                key={status}
                className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] text-slate-200"
              >
                {LOGISTICS_STATUS_LABELS[status] ?? status}
              </span>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}

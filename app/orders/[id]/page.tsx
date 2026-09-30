import Link from 'next/link';
import { notFound } from 'next/navigation';
import { demoOrders } from '@/lib/demo-data';
import { getOrderProgressPercent, getOrderStatusIndex, ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from '@/lib/orders';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = demoOrders.find((item) => item.id === id);

  if (!order) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Заказ</p>
            <h1 className="mt-2 text-3xl font-bold">{order.number}</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/orders" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Назад к заказам
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Клиент</p>
                <h2 className="mt-2 text-2xl font-semibold">{order.client}</h2>
              </div>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                <span>Прогресс заказа</span>
                <span>{getOrderProgressPercent(order.status)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-linear-to-r from-cyan-400 to-emerald-400" style={{ width: `${getOrderProgressPercent(order.status)}%` }} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard label="Товар" value={order.product} />
              <InfoCard label="Модель" value={order.model} />
              <InfoCard label="Размер" value={order.size} />
              <InfoCard label="Цвет" value={order.color} />
              <InfoCard label="Ремешок" value={order.strap} />
              <InfoCard label="Гравировка" value={order.engraving} />
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Финансы</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span>Итого</span><strong className="text-emerald-300">€{order.total}</strong></div>
              <div className="flex justify-between"><span>Предоплата</span><span>€{order.deposit}</span></div>
              <div className="flex justify-between"><span>Остаток</span><span>€{order.balance}</span></div>
              <div className="flex justify-between"><span>Способ оплаты</span><span>{order.payment}</span></div>
            </div>
          </aside>
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Логистика</p>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <InfoRow label="Город" value={order.city} />
              <InfoRow label="Адрес" value={order.address} />
              <InfoRow label="Менеджер" value={order.manager} />
              <InfoRow label="Дизайнер" value={order.designer} />
              <InfoRow label="Мастер" value={order.master} />
              <InfoRow label="Логистика" value={order.logistics} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.15em] text-slate-400">История статусов</p>
            <div className="mt-4 space-y-4">
              {order.history.map((entry) => (
                <div key={`${entry.label}-${entry.date}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <strong className="text-slate-100">{entry.label}</strong>
                    <span className="text-xs text-slate-400">{entry.date}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{entry.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Этапы заказа</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {ORDER_STATUS_FLOW.map((status) => {
              const active = getOrderStatusIndex(order.status) >= getOrderStatusIndex(status);
              return (
                <span
                  key={status}
                  className={`rounded-full border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] ${
                    active ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-950 text-slate-500'
                  }`}
                >
                  {ORDER_STATUS_LABELS[status] ?? status}
                </span>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2 last:border-none last:pb-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-100">{value}</span>
    </div>
  );
}

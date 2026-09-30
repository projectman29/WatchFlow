import Link from 'next/link';
import { demoOrders } from '@/lib/demo-data';
import { ORDER_STATUS_LABELS } from '@/lib/orders';

export default function OrdersPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Продажи</p>
            <h1 className="mt-2 text-3xl font-bold">Заказы</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/crm" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              CRM
            </Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <StatBox label="Всего" value={demoOrders.length} accent="text-cyan-300" />
          <StatBox label="В работе" value={demoOrders.filter((order) => order.status !== 'COMPLETED').length} accent="text-violet-300" />
          <StatBox label="Доставлены" value={demoOrders.filter((order) => order.status === 'SHIPPED' || order.status === 'DELIVERED' || order.status === 'COMPLETED').length} accent="text-emerald-300" />
          <StatBox label="План" value="€18.4k" accent="text-amber-300" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-300">
              <tr>
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Товар</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Ответственный</th>
              </tr>
            </thead>
            <tbody>
              {demoOrders.map((order) => (
                <tr key={order.id} className="border-t border-slate-800 transition hover:bg-slate-800/70">
                  <td className="px-4 py-3 text-cyan-300">
                    <Link href={`/orders/${order.id}`} className="hover:text-cyan-200">{order.number}</Link>
                  </td>
                  <td className="px-4 py-3">{order.client}</td>
                  <td className="px-4 py-3">{order.product}</td>
                  <td className="px-4 py-3 text-emerald-300">€{order.total}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-200">
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{order.assignee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

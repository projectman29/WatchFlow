import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getOrdersFromDb, getRecordScope } from '@/lib/db-data';
import { prisma } from '@/lib/prisma';
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from '@/lib/orders';

type OrderSearchParams = {
  status?: string;
  managerId?: string;
  city?: string;
  from?: string;
  to?: string;
  overdue?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<OrderSearchParams>;
}) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user, 'orders')) {
    redirect('/dashboard');
  }

  const query = searchParams ? await searchParams : {};
  const filters = {
    status: ORDER_STATUS_FLOW.includes(query.status as (typeof ORDER_STATUS_FLOW)[number]) ? query.status : undefined,
    managerId: query.managerId || undefined,
    city: query.city?.trim() || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
    overdue: query.overdue === 'on',
  };
  const [orders, scope] = await Promise.all([getOrdersFromDb(user, filters), getRecordScope(user)]);
  const managers = await prisma.employee.findMany({
    where: {
      isActive: true,
      user: { role: { name: { in: ['manager', 'sales'] } } },
      ...(scope ? { id: { in: scope.managerId.in } } : {}),
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  });
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Продажи</p>
            <h1 className="mt-2 text-3xl font-bold">Заказы</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/search" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-cyan-500 hover:bg-slate-800">
              Глобальный поиск
            </Link>
            <Link href="/crm" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              CRM
            </Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <StatBox label="Всего" value={orders.length} accent="text-cyan-300" />
          <StatBox label="В работе" value={orders.filter((order) => order.status !== 'COMPLETED').length} accent="text-violet-300" />
          <StatBox label="Доставлены" value={orders.filter((order) => order.status === 'SHIPPED' || order.status === 'DELIVERED' || order.status === 'COMPLETED').length} accent="text-emerald-300" />
          <StatBox label="План" value="€18.4k" accent="text-amber-300" />
        </section>

        <form method="GET" className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-400">
            Статус
            <select name="status" defaultValue={filters.status ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="">Все статусы</option>
              {ORDER_STATUS_FLOW.map((status) => (
                <option key={status} value={status}>{ORDER_STATUS_LABELS[status] ?? status}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Менеджер
            <select name="managerId" defaultValue={filters.managerId ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="">Все доступные</option>
              {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.fullName}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Город
            <input name="city" defaultValue={filters.city ?? ''} maxLength={100} placeholder="Например, Алматы" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              С даты
              <input type="date" name="from" defaultValue={filters.from ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-400">
              По дату
              <input type="date" name="to" defaultValue={filters.to ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="overdue" value="on" defaultChecked={filters.overdue} className="rounded border-slate-700 bg-slate-950" />
            Просрочен срок дизайна
          </label>
          <div className="flex items-center gap-2 lg:col-span-3">
            <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Применить фильтры</button>
            <Link href="/orders" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Сбросить</Link>
            <span className="ml-auto text-sm text-slate-400">Найдено: {orders.length}</span>
          </div>
        </form>

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
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-800 transition hover:bg-slate-800/70">
                  <td className="px-4 py-3 text-cyan-300">
                    <Link href={`/orders/${order.id}`} className="hover:text-cyan-200">{order.number}</Link>
                  </td>
                  <td className="px-4 py-3">{order.client}</td>
                  <td className="px-4 py-3">{order.product}</td>
                  <td className="px-4 py-3 text-emerald-300">
                    {order.total.toLocaleString('ru-RU')} {order.currency ?? '(валюта не подтверждена)'}
                  </td>
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

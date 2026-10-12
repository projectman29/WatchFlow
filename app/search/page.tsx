import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getRecordScope } from '@/lib/db-data';
import { ORDER_STATUS_LABELS } from '@/lib/orders';
import { normalizePhoneSearch } from '@/lib/search';
import { prisma } from '@/lib/prisma';

type SearchParams = { q?: string };

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await getCurrentUserFromCookies();
  if (!user) redirect('/login');

  const query = searchParams ? await searchParams : {};
  const term = query.q?.trim().slice(0, 100) ?? '';
  const phoneDigits = normalizePhoneSearch(term);
  const canSearchOrders = canAccessSection(user, 'orders');
  const canSearchLeads = canAccessSection(user, 'leads') || canAccessSection(user, 'crm');
  const canSearchInventory = canAccessSection(user, 'warehouse');
  const scope = canSearchOrders || canSearchLeads ? await getRecordScope(user) : null;

  const matchingClientIds = phoneDigits.length >= 4
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Client"
        WHERE regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g') LIKE ${`%${phoneDigits}%`}
          OR regexp_replace(COALESCE("whatsapp", ''), '[^0-9]', '', 'g') LIKE ${`%${phoneDigits}%`}
        LIMIT 100
      `
    : [];
  const clientIds = matchingClientIds.map(({ id }) => id);

  const [orders, leads, inventory] = await Promise.all([
    canSearchOrders && term.length >= 2
      ? prisma.order.findMany({
          where: {
            ...(scope ?? {}),
            OR: [
              { id: { contains: term, mode: 'insensitive' } },
              { number: { contains: term, mode: 'insensitive' } },
              { client: { is: { name: { contains: term, mode: 'insensitive' } } } },
              { client: { is: { phone: { contains: term, mode: 'insensitive' } } } },
              { client: { is: { whatsapp: { contains: term, mode: 'insensitive' } } } },
              ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
              { shipments: { some: { trackingNumber: { contains: term, mode: 'insensitive' } } } },
            ],
          },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            clientId: true,
            createdAt: true,
            client: { select: { name: true, phone: true, city: true } },
            shipments: { select: { id: true, trackingNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [],
    canSearchLeads && term.length >= 2
      ? prisma.lead.findMany({
          where: {
            ...(scope ?? {}),
            OR: [
              { title: { contains: term, mode: 'insensitive' } },
              { client: { is: { name: { contains: term, mode: 'insensitive' } } } },
              { client: { is: { phone: { contains: term, mode: 'insensitive' } } } },
              { client: { is: { whatsapp: { contains: term, mode: 'insensitive' } } } },
              ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
            ],
          },
          include: { client: { select: { name: true, phone: true, city: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [],
    canSearchInventory && term.length >= 2
      ? prisma.inventoryItem.findMany({
          where: {
            OR: [
              { sku: { contains: term, mode: 'insensitive' } },
              { name: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: { id: true, sku: true, name: true, stock: true, reorderLevel: true },
          orderBy: { sku: 'asc' },
          take: 20,
        })
      : [],
  ]);

  const resultCount = orders.length + leads.length + inventory.length;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">WatchFlow</p>
            <h1 className="mt-2 text-3xl font-bold">Глобальный поиск</h1>
            <p className="mt-2 text-sm text-slate-400">Заказы, клиенты, телефоны, трек-номера и складские SKU.</p>
          </div>
          <Link href="/dashboard" className="self-start rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Dashboard
          </Link>
        </header>

        <form method="GET" className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row">
          <label htmlFor="global-search" className="sr-only">Поисковый запрос</label>
          <input
            id="global-search"
            name="q"
            type="search"
            minLength={2}
            maxLength={100}
            required
            autoFocus
            defaultValue={term}
            placeholder="Номер заказа, ФИО, телефон, трек-номер или SKU"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
          />
          <button type="submit" className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            Найти
          </button>
        </form>

        {term.length < 2 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-6 text-sm text-slate-400">
            Введите не менее двух символов. Поиск учитывает доступные вам разделы.
          </p>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-slate-400">Результатов: {resultCount}</p>

            {canSearchOrders ? (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-xl font-semibold">Заказы и отправления ({orders.length})</h2>
                <div className="mt-4 space-y-2">
                  {orders.length === 0 ? <p className="text-sm text-slate-500">Совпадений нет.</p> : orders.map((order) => (
                    <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-xl border border-slate-800 bg-slate-950 p-4 hover:border-cyan-500/50">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-cyan-300">{order.number}</p>
                          <p className="mt-1 text-sm text-white">{order.client?.name ?? 'Клиент не указан'}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {[order.client?.phone, order.client?.city].filter(Boolean).join(' · ') || 'Контакты не указаны'}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm text-emerald-300">{Number(order.total).toLocaleString('ru-RU')}</p>
                          <p className="mt-1 text-xs text-slate-400">{ORDER_STATUS_LABELS[order.status] ?? order.status}</p>
                        </div>
                      </div>
                      {order.shipments.some((shipment) => shipment.trackingNumber?.toLocaleLowerCase().includes(term.toLocaleLowerCase())) ? (
                        <p className="mt-3 border-t border-slate-800 pt-2 text-xs text-slate-400">
                          Трек-номер: {order.shipments.map((shipment) => shipment.trackingNumber).filter(Boolean).join(', ')}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {canSearchLeads ? (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-xl font-semibold">Лиды и клиенты ({leads.length})</h2>
                <div className="mt-4 space-y-2">
                  {leads.length === 0 ? <p className="text-sm text-slate-500">Совпадений нет.</p> : leads.map((lead) => (
                    <Link key={lead.id} href={`/crm?editLead=${lead.id}`} className="block rounded-xl border border-slate-800 bg-slate-950 p-4 hover:border-cyan-500/50">
                      <p className="font-semibold text-white">{lead.client?.name ?? lead.title}</p>
                      <p className="mt-1 text-sm text-slate-300">{lead.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {[lead.client?.phone, lead.client?.city, lead.status].filter(Boolean).join(' · ')}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {canSearchInventory ? (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-xl font-semibold">Складские позиции ({inventory.length})</h2>
                <div className="mt-4 space-y-2">
                  {inventory.length === 0 ? <p className="text-sm text-slate-500">Совпадений нет.</p> : inventory.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold text-cyan-300">{item.sku} <span className="font-normal text-white">· {item.name}</span></p>
                      <p className={`text-sm ${item.stock <= item.reorderLevel ? 'text-amber-300' : 'text-slate-300'}`}>
                        Остаток: {item.stock} / минимум: {item.reorderLevel}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

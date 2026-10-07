import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getReadyForShipmentOrders, getShipmentSummary, LOGISTICS_STATUS_LABELS, LOGISTICS_STATUSES, readyShipments, type ReadyShipment } from '@/lib/logistics';

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams?: { updated?: string } | Promise<{ updated?: string }>;
}) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user.role, 'logistics')) {
    redirect('/dashboard');
  }

  let shipments: ReadyShipment[] = readyShipments;
  let databaseAvailable = false;

  try {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { status: { in: ['READY_FOR_SHIPMENT', 'SHIPPED', 'DELIVERED'] } },
          { shipments: { some: { status: { in: ['SHIPPED', 'DELIVERED', 'RETURNED'] } } } },
        ],
      },
      include: {
        client: true,
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    shipments = orders.map((order) => {
      const shipment = order.shipments[0];
      const status = shipment?.status === 'PREPARING'
        ? 'READY_FOR_SHIPMENT'
        : shipment?.status ?? order.status;

      return {
        id: shipment?.id ?? order.id,
        orderId: order.id,
        persisted: true,
        order: order.number,
        client: order.client?.name ?? 'Неизвестный клиент',
        phone: order.client?.phone ?? 'Не указан',
        city: order.client?.city ?? 'Не указан',
        address: order.client?.company ?? 'Адрес не указан',
        amount: Number(order.total),
        deliveryType: 'Доставка клиенту',
        cashOnDelivery: Math.max(0, Number(order.total) - Number(order.deposit)),
        status: (status === 'RETURNED' ? status : status) as ReadyShipment['status'],
        courier: shipment?.courierName ?? 'Не назначен',
        service: shipment?.courierName ?? 'Не назначена',
        tracking: shipment?.trackingNumber ?? 'Не указан',
        note: shipment ? `Обновлено: ${shipment.updatedAt.toLocaleString('ru-RU')}` : 'Готов к оформлению отправки',
      };
    });
    databaseAvailable = true;
  } catch (error) {
    console.error('Unable to load shipments:', error);
  }

  const params = searchParams ? await searchParams : {};
  const updatedMessage = params.updated
    ? ({ shipped: 'Отправление сохранено, заказ отмечен как отправленный.', delivered: 'Доставка отмечена как выполненная.', returned: 'Возврат зарегистрирован.' } as Record<string, string>)[params.updated]
    : '';
  const summary = getShipmentSummary(shipments);
  const readyQueue = getReadyForShipmentOrders(shipments);

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

        {updatedMessage ? <p className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{updatedMessage}</p> : null}
        {!databaseAvailable ? <p className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Показаны демо-отправления: подключение к базе недоступно, изменения не будут сохранены.</p> : null}

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
          {shipments.map((shipment) => (
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

              {shipment.persisted && shipment.orderId && shipment.status === 'READY_FOR_SHIPMENT' ? (
                <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" action="/api/logistics/shipments" method="POST">
                  <input type="hidden" name="orderId" value={shipment.orderId} />
                  <input type="hidden" name="status" value="SHIPPED" />
                  <input name="courierName" aria-label="Служба или курьер" placeholder="Служба / курьер" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input name="trackingNumber" aria-label="Трек-номер" placeholder="Трек-номер" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <button type="submit" className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Отметить отправку</button>
                </form>
              ) : null}

              {shipment.persisted && shipment.orderId && shipment.status === 'SHIPPED' ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action="/api/logistics/shipments" method="POST">
                    <input type="hidden" name="orderId" value={shipment.orderId} />
                    <input type="hidden" name="status" value="DELIVERED" />
                    <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">Подтвердить доставку</button>
                  </form>
                  <form action="/api/logistics/shipments" method="POST">
                    <input type="hidden" name="orderId" value={shipment.orderId} />
                    <input type="hidden" name="status" value="RETURNED" />
                    <button type="submit" className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10">Зарегистрировать возврат</button>
                  </form>
                </div>
              ) : null}
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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { canAccessSection, hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getOrderByIdFromDb } from '@/lib/db-data';
import { getAllowedOrderStatusTransitions, getOrderProgressPercent, getOrderStatusIndex, ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from '@/lib/orders';

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; updated?: string }>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user, 'orders')) {
    redirect('/dashboard');
  }

  const order = await getOrderByIdFromDb(id, user);

  if (!order) {
    notFound();
  }

  const canEditOrders = hasPermission(user, 'orders:write');
  const nextStatuses = getAllowedOrderStatusTransitions(order.status);
  const editableItems = order.items?.length
    ? order.items
    : [{
        productName: order.product,
        quantity: 1,
        unitPrice: order.total + (order.discount ?? 0),
        model: order.model,
        color: order.color,
        strap: order.strap,
        engraving: order.engraving,
      }];
  const formItems = editableItems.length < 20
    ? [...editableItems, {
        productName: '',
        quantity: 1,
        unitPrice: 0,
        model: '',
        color: '',
        strap: '',
        engraving: '',
      }]
    : editableItems;

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

        {query.error ? (
          <div role="alert" className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {query.error === 'invalid_transition'
              ? 'Можно перейти только на следующий этап или отменить заказ.'
              : query.error === 'discount_exceeds_total'
                ? 'Скидка не может превышать стоимость позиций.'
              : query.error === 'deposit_exceeds_total'
                ? 'Предоплата не может превышать сумму заказа.'
                : query.error === 'invalid_items'
                  ? 'Состав позиций изменился. Обновите страницу и повторите сохранение.'
                  : query.error === 'invalid_fields'
                    ? 'Проверьте сумму, оплату и заполнение позиций.'
                    : query.error === 'not_found'
                      ? 'Заказ не найден или у вас нет доступа.'
                      : 'Не удалось сохранить изменения заказа.'}
          </div>
        ) : null}
        {query.updated ? (
          <div role="status" className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {query.updated === 'status' ? 'Статус заказа обновлён.' : 'Данные и оплата заказа сохранены.'}
          </div>
        ) : null}

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
              <div className="flex justify-between"><span>Статус оплаты</span><span>{order.payment}</span></div>
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
                    <time className="text-xs text-slate-400" dateTime={entry.date}>{formatDate(entry.date)}</time>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{entry.note}</p>
                  {entry.actor ? <p className="mt-1 text-xs text-slate-500">Выполнил: {entry.actor}</p> : null}
                </div>
              ))}
              {order.history.length === 0 ? (
                <p className="text-sm text-slate-400">История изменений пока пуста.</p>
              ) : null}
            </div>
          </div>
        </section>

        {canEditOrders ? (
          <section className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Изменить статус</h2>
              {nextStatuses.length > 0 ? (
                <form action={`/api/orders/${order.id}`} method="POST" className="mt-4 space-y-4">
                  <input type="hidden" name="action" value="status" />
                  <label className="block text-sm text-slate-300">
                    Следующий этап
                    <select name="status" required defaultValue={nextStatuses[0]} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                      {nextStatuses.map((status) => (
                        <option key={status} value={status}>{ORDER_STATUS_LABELS[status] ?? status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-300">
                    Комментарий
                    <input name="note" maxLength={1000} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" />
                  </label>
                  <button type="submit" className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400">
                    Сохранить статус
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Заказ завершён или отменён — дальнейшие переходы недоступны.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Позиции и оплата</h2>
              <form action={`/api/orders/${order.id}`} method="POST" className="mt-4 space-y-4">
                <input type="hidden" name="action" value="edit" />
                {formItems.map((item, index) => (
                  <fieldset key={item.id ?? `new-${index}`} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <legend className="px-2 text-xs uppercase tracking-wider text-slate-400">{item.id ? `Позиция ${index + 1}` : 'Добавить позицию'}</legend>
                    <input type="hidden" name="itemId" value={item.id ?? ''} />
                    <label className="block text-sm text-slate-300">
                      Наименование
                      <input name="productName" required={Boolean(item.id)} maxLength={120} defaultValue={item.productName} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NumberField label="Количество" name="quantity" defaultValue={item.quantity} min="1" max="1000" step="1" />
                      <NumberField label="Цена за единицу" name="unitPrice" defaultValue={item.unitPrice} min="0" max="1000000" step="0.01" />
                      <TextField label="Модель" name="model" defaultValue={item.model ?? ''} />
                      <TextField label="Цвет" name="color" defaultValue={item.color ?? ''} />
                      <TextField label="Ремешок" name="strap" defaultValue={item.strap ?? ''} />
                      <TextField label="Гравировка" name="engraving" defaultValue={item.engraving ?? ''} />
                    </div>
                    {item.id ? (
                      <label className="flex items-center gap-2 text-xs text-rose-300">
                        <input type="checkbox" name="removeItemId" value={item.id} className="accent-rose-500" />
                        Удалить позицию
                      </label>
                    ) : null}
                  </fieldset>
                ))}
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField label="Скидка" name="discount" defaultValue={order.discount ?? 0} min="0" max="1000000" step="0.01" />
                  <NumberField label="Оплачено" name="deposit" defaultValue={order.deposit} min="0" max="1000000" step="0.01" />
                </div>
                <p className="text-xs text-slate-500">Статус оплаты пересчитывается автоматически по сумме предоплаты.</p>
                <button type="submit" className="w-full rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-200 hover:bg-cyan-500/20">
                  Сохранить позиции и оплату
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Этапы заказа</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {ORDER_STATUS_FLOW.map((status) => {
              const active = order.status !== 'CANCELLED' && getOrderStatusIndex(order.status) >= getOrderStatusIndex(status);
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

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  defaultValue: number;
  min: string;
  max: string;
  step: string;
}) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input type="number" name={name} required min={min} max={max} step={step} defaultValue={defaultValue} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" />
    </label>
  );
}

function TextField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input name={name} maxLength={200} defaultValue={defaultValue} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" />
    </label>
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

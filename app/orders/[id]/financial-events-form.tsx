'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';

type PaymentRecord = {
  id: string;
  kind: string;
  amount: string;
  currency: string;
  occurredAt: string;
  reference: string | null;
  note: string | null;
};

type CostRecord = {
  id: string;
  category: string;
  amount: string;
  currency: string;
  incurredAt: string;
  description: string;
};

const errorMessages: Record<string, string> = {
  'Payment amount must be greater than zero.': 'Сумма должна быть больше нуля.',
  'Payment amount is invalid.': 'Укажите корректную сумму.',
  'Payment date is invalid.': 'Укажите корректную дату платежа.',
  'Payment currency must match the order currency.': 'Валюта платежа должна совпадать с валютой заказа.',
  'Refund cannot exceed recorded receipts.': 'Сумма возврата не может превышать ранее зарегистрированные поступления.',
  'Cost amount must be greater than zero.': 'Сумма затрат должна быть больше нуля.',
  'Cost amount is invalid.': 'Укажите корректную сумму затрат.',
  'Cost description is required.': 'Добавьте описание затрат.',
  'Cost date is invalid.': 'Укажите корректную дату затрат.',
  'Cost currency must match the order currency.': 'Валюта затрат должна совпадать с валютой заказа.',
};

export default function FinancialEventsForm({
  orderId,
  currency,
  payments,
  costs,
}: {
  orderId: string;
  currency: string | null;
  payments: PaymentRecord[];
  costs: CostRecord[];
}) {
  const router = useRouter();
  const [paymentError, setPaymentError] = useState('');
  const [costError, setCostError] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  const currencyKnown = Boolean(currency);

  async function submitEvent(
    event: FormEvent<HTMLFormElement>,
    kind: 'payment' | 'cost',
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const setError = kind === 'payment' ? setPaymentError : setCostError;
    const setSaving = kind === 'payment' ? setSavingPayment : setSavingCost;
    setError('');
    setSaving(true);

    const fields = new FormData(form);
    const date = String(fields.get(kind === 'payment' ? 'occurredAt' : 'incurredAt') ?? '');
    const payload: Record<string, string> = Object.fromEntries(
      Array.from(fields.entries(), ([key, value]) => [key, String(value)]),
    );
    if (date) payload[kind === 'payment' ? 'occurredAt' : 'incurredAt'] = new Date(date).toISOString();

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/${kind === 'payment' ? 'payments' : 'costs'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Не удалось сохранить событие.');
      form.reset();
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Не удалось сохранить событие.';
      setError(errorMessages[message] ?? message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.15em] text-slate-400">Финансовые события заказа</p>
          <h2 className="mt-1 text-xl font-semibold">Поступления, возвраты и прямые затраты</h2>
        </div>
        <span className="w-fit rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          Валюта: {currency ?? 'не подтверждена'}
        </span>
      </div>

      {!currencyKnown ? (
        <p className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Для исторического заказа валюта не подтверждена. Сначала требуется сверка валюты — формы записи финансовых событий отключены.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-200">Записать поступление или возврат</h3>
          <form onSubmit={(event) => void submitEvent(event, 'payment')} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <input type="hidden" name="currency" value={currency ?? ''} />
            <label className="block text-sm text-slate-300">
              Тип события
              <select name="kind" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                <option value="RECEIPT">Поступление</option>
                <option value="REFUND">Возврат денег</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Сумма ({currency ?? '—'})
                <input name="amount" type="number" required min="0.01" max="1000000" step="0.01" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                Дата и время
                <input name="occurredAt" type="datetime-local" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              Номер подтверждения
              <input name="reference" maxLength={200} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
            </label>
            <label className="block text-sm text-slate-300">
              Комментарий
              <input name="note" maxLength={1000} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
            </label>
            {paymentError ? <p role="alert" className="text-sm text-rose-300">{paymentError}</p> : null}
            <button type="submit" disabled={!currencyKnown || savingPayment} className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
              {savingPayment ? 'Сохраняем…' : 'Записать событие'}
            </button>
          </form>

          <EventList isEmpty={payments.length === 0} empty="Платежей пока нет. Предоплата в карточке заказа отдельно не является журналом платежей.">
            {payments.map((payment) => (
              <li key={payment.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className={payment.kind === 'REFUND' ? 'text-rose-300' : 'text-emerald-300'}>
                    {payment.kind === 'REFUND' ? 'Возврат' : 'Поступление'} · {formatAmount(payment.amount, payment.currency)}
                  </strong>
                  <time className="text-xs text-slate-500">{formatDate(payment.occurredAt)}</time>
                </div>
                {payment.reference ? <p className="mt-1 text-xs text-slate-400">Подтверждение: {payment.reference}</p> : null}
                {payment.note ? <p className="mt-1 text-xs text-slate-400">{payment.note}</p> : null}
              </li>
            ))}
          </EventList>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-slate-200">Записать фактические прямые затраты</h3>
          <form onSubmit={(event) => void submitEvent(event, 'cost')} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <input type="hidden" name="currency" value={currency ?? ''} />
            <label className="block text-sm text-slate-300">
              Категория
              <select name="category" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                <option value="MATERIALS">Материалы</option>
                <option value="LABOR">Работа мастера</option>
                <option value="PACKAGING">Упаковка</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Сумма ({currency ?? '—'})
                <input name="amount" type="number" required min="0.01" max="1000000" step="0.01" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                Дата и время
                <input name="incurredAt" type="datetime-local" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              Описание
              <input name="description" required maxLength={1000} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Что было фактически затрачено" />
            </label>
            {costError ? <p role="alert" className="text-sm text-rose-300">{costError}</p> : null}
            <button type="submit" disabled={!currencyKnown || savingCost} className="w-full rounded-lg bg-violet-500/20 px-4 py-2.5 font-semibold text-violet-200 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50">
              {savingCost ? 'Сохраняем…' : 'Записать затраты'}
            </button>
          </form>

          <EventList isEmpty={costs.length === 0} empty="Фактические прямые затраты ещё не зарегистрированы.">
            {costs.map((cost) => (
              <li key={cost.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-violet-200">{costCategoryLabel(cost.category)} · {formatAmount(cost.amount, cost.currency)}</strong>
                  <time className="text-xs text-slate-500">{formatDate(cost.incurredAt)}</time>
                </div>
                <p className="mt-1 text-xs text-slate-400">{cost.description}</p>
              </li>
            ))}
          </EventList>
        </div>
      </div>
    </section>
  );
}

function EventList({ empty, isEmpty, children }: { empty: string; isEmpty: boolean; children: ReactNode }) {
  return (
    <ul className="space-y-2">
      {children}
      {isEmpty ? <li className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-500">{empty}</li> : null}
    </ul>
  );
}

function formatAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${Number.isFinite(value) ? value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount} ${currency}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function costCategoryLabel(category: string) {
  if (category === 'MATERIALS') return 'Материалы';
  if (category === 'LABOR') return 'Работа мастера';
  return 'Упаковка';
}

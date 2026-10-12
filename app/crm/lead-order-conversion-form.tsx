'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';

export default function LeadOrderConversionForm({
  leadId,
  suggestedBudget,
}: {
  leadId: string;
  suggestedBudget: number;
}) {
  const router = useRouter();
  const [total, setTotal] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const errorMessages: Record<string, string> = {
    'Only qualified leads can be converted to orders.': 'Создать заказ можно только из квалифицированного лида.',
    'An order already exists for this lead.': 'Для этого лида заказ уже создан.',
    'The lead is outside the 30-day conversion window.': 'Срок создания заказа по этому лиду (30 дней) истёк.',
    'Order total must be greater than zero.': 'Подтверждённая сумма заказа должна быть больше нуля.',
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: Number(total) }),
      });
      const result = await response.json() as { orderId?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Не удалось создать заказ.');
      if (!result.orderId) throw new Error('Сервер не вернул созданный заказ.');
      router.push(`/orders/${encodeURIComponent(result.orderId)}`);
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Не удалось создать заказ.';
      setError(errorMessages[message] ?? message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
      <p className="text-[11px] font-medium text-emerald-200">Создать заказ из квалифицированного лида</p>
      <label className="block text-[11px] text-slate-400">
        Подтверждённая сумма, KZT
        <input
          type="number"
          required
          min="0.01"
          max="1000000"
          step="0.01"
          value={total}
          onChange={(event) => setTotal(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
          placeholder={`Бюджет лида: ${suggestedBudget.toLocaleString('ru-RU')}`}
        />
      </label>
      <p className="text-[10px] leading-4 text-slate-500">Бюджет лида — только ориентир, он не переносится в заказ автоматически.</p>
      {error ? <p role="alert" className="text-[11px] text-rose-300">{error}</p> : null}
      <button
        type="submit"
        disabled={saving || !total}
        className="w-full rounded-lg bg-emerald-500/15 px-2 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Создаём заказ…' : 'Создать заказ'}
      </button>
    </form>
  );
}

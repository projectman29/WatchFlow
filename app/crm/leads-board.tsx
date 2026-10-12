'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LeadRecord, OrderRecord } from '@/lib/demo-data';
import { getLeadBoardStage, getLeadStatusLabel, LEAD_LOSS_REASONS, LEAD_ORDER_CONVERSION_WINDOW_DAYS, LEAD_STAGES, LEAD_STATUS_LABELS } from '@/lib/crm';
import { ORDER_STATUS_LABELS } from '@/lib/orders';
import LeadOrderConversionForm from './lead-order-conversion-form';

type LeadStage = (typeof LEAD_STAGES)[number];
type DraggedLead = { id: string; stage: LeadStage };

export default function LeadsBoard({
  leads,
  orders = [],
  canEdit,
  canViewOrders,
  canCreateOrders,
  salesDataReady,
}: {
  leads: LeadRecord[];
  orders?: OrderRecord[];
  canEdit: boolean;
  canViewOrders?: boolean;
  canCreateOrders?: boolean;
  salesDataReady: boolean;
}) {
  const router = useRouter();
  const [draggedLead, setDraggedLead] = useState<DraggedLead | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [pendingLostLead, setPendingLostLead] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveStage(leadId: string, status: LeadStage, reasonLost?: string) {
    setSaving(true);
    setError('');

    try {
      const body = new FormData();
      body.set('action', 'status');
      body.set('status', status);
      if (reasonLost) body.set('reasonLost', reasonLost);

      const response = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
        method: 'POST',
        body,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? 'Не удалось изменить статус лида.');
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось изменить статус лида.');
    } finally {
      setSaving(false);
    }
  }

  function handleDrop(stage: LeadStage) {
    if (!draggedLead || draggedLead.stage === stage) {
      setDraggedLead(null);
      setDragOverStage(null);
      return;
    }

    if (stage === 'LOST') {
      setPendingLostLead(draggedLead.id);
      setLossReason('');
    } else {
      void saveStage(draggedLead.id, stage);
    }
    setDraggedLead(null);
    setDragOverStage(null);
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <section className="flex gap-4 overflow-x-auto overflow-y-hidden rounded-2xl pb-4">
        {LEAD_STAGES.map((stage) => {
          const stageLeads = leads.filter((lead) => getLeadBoardStage(lead.status) === stage);

          return (
            <div
              key={stage}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverStage(stage);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverStage(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(stage);
              }}
              className={`w-[min(260px,82vw)] shrink-0 rounded-2xl border bg-gradient-to-b from-slate-900 to-slate-900/80 p-3 shadow-lg shadow-black/10 transition duration-200 xl:w-auto xl:min-w-[190px] xl:flex-1 ${
                dragOverStage === stage
                  ? 'border-cyan-400/70 bg-cyan-950/30 shadow-cyan-950/30'
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-700/60 pb-3">
                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
                  {LEAD_STATUS_LABELS[stage]}
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{stageLeads.length}</span>
              </div>

              <div className="space-y-3">
                {stageLeads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">
                    Нет лидов
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <article
                      key={lead.id}
                      draggable={canEdit && !lead.isDemo && !saving}
                      onDragStart={(event) => {
                        setDraggedLead({ id: lead.id, stage: getLeadBoardStage(lead.status) ?? 'NEW' });
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggedLead(null);
                        setDragOverStage(null);
                      }}
                      className={`rounded-xl border border-slate-700/70 bg-slate-950/90 p-2.5 shadow-sm shadow-black/20 transition duration-200 hover:border-slate-600 hover:bg-slate-950 ${
                        canEdit && !lead.isDemo ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${draggedLead?.id === lead.id ? 'opacity-50' : ''}`}
                    >
                      <p className="font-semibold text-white">{lead.client}</p>
                      {lead.phone ? <p className="mt-1 text-[11px] text-slate-400">{lead.phone}</p> : null}
                      {lead.city ? <p className="mt-1 truncate text-[11px] text-slate-400">{lead.city}</p> : null}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] uppercase tracking-[0.1em] text-slate-400">{lead.source}</span>
                        <span className="shrink-0 text-xs font-semibold text-cyan-300">Бюджет: {lead.value.toLocaleString('ru-RU')}</span>
                      </div>
                      {canEdit && !lead.isDemo ? (
                        <>
                          <details className="mt-2 border-t border-slate-800/80 pt-2">
                            <summary className="cursor-pointer list-none text-[11px] font-medium text-slate-400 hover:text-cyan-300">
                              Действия и подробности
                            </summary>
                            <div className="mt-2 space-y-2">
                              {lead.whatsapp ? <p className="text-[11px] text-slate-400">WhatsApp: {lead.whatsapp}</p> : null}
                              {lead.instagram ? <p className="text-[11px] text-slate-400">Instagram: {lead.instagram}</p> : null}
                              {lead.assignedTo ? <p className="text-[11px] text-slate-400">Ответственный: {lead.assignedTo}</p> : null}
                              <p className="text-[11px] text-slate-300">Статус: {getLeadStatusLabel(lead.status)}</p>
                              {lead.reasonLost ? <p className="text-[11px] text-rose-300">Причина: {lead.reasonLost}</p> : null}
                              {lead.notes ? <p className="text-[11px] text-slate-400">Комментарий: {lead.notes}</p> : null}
                              {canViewOrders && lead.linkedOrder ? (
                                <Link
                                  href={`/orders/${encodeURIComponent(lead.linkedOrder.id)}`}
                                  className="block rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-center text-xs text-emerald-200 hover:bg-emerald-500/20"
                                >
                                  Открыть заказ {lead.linkedOrder.number}
                                </Link>
                              ) : canCreateOrders && ['WAITING_PAYMENT', 'WON'].includes(lead.status) ? (
                                !salesDataReady ? (
                                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-200">
                                    Создание заказа временно недоступно до обновления базы данных.
                                  </p>
                                ) : isWithinConversionWindow(lead.firstQualifiedAt) ? (
                                  <LeadOrderConversionForm leadId={lead.id} suggestedBudget={lead.value} />
                                ) : (
                                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-200">
                                    {lead.firstQualifiedAt
                                      ? 'Окно создания заказа — 30 дней — истекло.'
                                      : 'Нет записи о первом переходе в квалифицированный статус; заказ создать нельзя.'}
                                  </p>
                                )
                              ) : null}
                              <form className="space-y-2 border-t border-slate-800 pt-2" action={`/api/crm/leads/${lead.id}`} method="POST">
                                <input type="hidden" name="action" value="status" />
                                <label className="block text-[11px] text-slate-400">
                                  Изменить статус
                                  <select name="status" defaultValue={getLeadBoardStage(lead.status) ?? 'NEW'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
                                    {LEAD_STAGES.map((status) => <option key={status} value={status}>{LEAD_STATUS_LABELS[status]}</option>)}
                                  </select>
                                </label>
                                <label className="block text-[11px] text-slate-400">
                                  Причина отказа
                                  <select name="reasonLost" defaultValue={LEAD_LOSS_REASONS.includes(lead.reasonLost as (typeof LEAD_LOSS_REASONS)[number]) ? lead.reasonLost : ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
                                    <option value="">Выберите причину</option>
                                    {LEAD_LOSS_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                                  </select>
                                </label>
                                <button type="submit" className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20">
                                  Сохранить статус
                                </button>
                              </form>
                              <Link href={`/crm?editLead=${encodeURIComponent(lead.id)}`} className="block rounded-lg border border-slate-700 px-2 py-1.5 text-center text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200">
                                Редактировать карточку
                              </Link>
                            </div>
                          </details>
                        </>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
        {canViewOrders ? (
          <div className="w-[min(260px,82vw)] shrink-0 rounded-2xl border border-slate-800 bg-slate-900 p-3 xl:w-auto xl:min-w-[190px] xl:flex-1">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Заказы в работе</span>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{orders.length}</span>
            </div>
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">
                  Нет заказов в работе
                </div>
              ) : orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${encodeURIComponent(order.id)}`}
                  className="block rounded-xl border border-slate-700 bg-slate-950 p-3 transition hover:border-cyan-500/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-cyan-300">{order.number}</span>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300">
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-white">{order.client}</p>
                  <p className="mt-1 text-xs text-slate-400">{order.product}</p>
                  <p className="mt-2 text-sm text-emerald-300">
                    {order.total.toLocaleString('ru-RU')} {order.currency ?? '(валюта не подтверждена)'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">Ответственный: {order.assignee}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {pendingLostLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="lost-lead-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 id="lost-lead-title" className="text-lg font-semibold text-white">Причина отказа</h2>
            <p className="mt-2 text-sm text-slate-400">Чтобы переместить лид в «Отказ», укажите причину.</p>
            <select
              value={lossReason}
              onChange={(event) => setLossReason(event.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
            >
              <option value="">Выберите причину</option>
              {LEAD_LOSS_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setPendingLostLead(null)}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!lossReason || saving}
                onClick={() => {
                  if (pendingLostLead && lossReason) {
                    void saveStage(pendingLostLead, 'LOST', lossReason);
                  }
                }}
                className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Сохранение…' : 'Подтвердить'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function isWithinConversionWindow(qualifiedAt?: string) {
  if (!qualifiedAt) return false;
  const qualifiedAtMs = new Date(qualifiedAt).getTime();
  const elapsed = Date.now() - qualifiedAtMs;
  return Number.isFinite(qualifiedAtMs) && elapsed >= 0 && elapsed <= LEAD_ORDER_CONVERSION_WINDOW_DAYS * 86_400_000;
}

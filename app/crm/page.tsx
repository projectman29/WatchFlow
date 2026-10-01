import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection, hasPermission } from '@/lib/access';
import { LEAD_LOSS_REASONS, LEAD_SOURCES, LEAD_STAGES, LEAD_STATUS_LABELS, getLeadSourceSummary, getPipelineSummary } from '@/lib/crm';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getCRMLeadsFromDb, getLeadAssignees, getOrdersFromDb } from '@/lib/db-data';

export default async function CRMPage({
  searchParams,
}: {
  searchParams?: Promise<{ editLead?: string }>;
}) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user.role, 'crm') && !canAccessSection(user.role, 'leads')) {
    redirect('/dashboard');
  }

  const canViewCrmAnalytics = canAccessSection(user.role, 'crm');
  const leads = await getCRMLeadsFromDb(user);
  const orders = canAccessSection(user.role, 'orders') ? await getOrdersFromDb(user) : [];
  const assignees = await getLeadAssignees(user);
  const params = searchParams ? await searchParams : {};
  const editingLead = leads.find((lead) => lead.id === params.editLead && !lead.isDemo);
  const pipelineSummary = getPipelineSummary(leads);
  const sourceSummary = getLeadSourceSummary(leads);
  const stageGroups = LEAD_STAGES.map((stage) => ({
    stage,
    leads: leads.filter((lead) => lead.status === stage),
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">CRM</p>
            <h1 className="mt-2 text-3xl font-bold">{canViewCrmAnalytics ? 'Воронка продаж' : 'Мои лиды'}</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Dashboard
            </Link>
            <Link href="/orders" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Заказы
            </Link>
          </div>
        </header>

        {canViewCrmAnalytics ? <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Всего лидов" value={pipelineSummary.total} accent="text-cyan-300" />
          <MetricCard label="В работе" value={pipelineSummary.inProgress} accent="text-violet-300" />
          <MetricCard label="WON" value={pipelineSummary.won} accent="text-emerald-300" />
          <MetricCard label="LOST" value={pipelineSummary.lost} accent="text-rose-300" />
        </section> : null}

        {canViewCrmAnalytics || hasPermission(user.role, 'leads:write') ? <section className={`mb-8 grid gap-4 ${canViewCrmAnalytics ? 'xl:grid-cols-[1.1fr_0.9fr]' : ''}`}>
          {canViewCrmAnalytics ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Источники лидов</h2>
              <span className="text-sm text-slate-400">{sourceSummary.length} каналов</span>
            </div>

            <div className="space-y-3">
              {sourceSummary.map(({ source, count }) => (
                <div key={source} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                  <span className="text-sm text-slate-300">{source}</span>
                  <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300">{count}</span>
                </div>
              ))}
            </div>
          </div> : null}

          {hasPermission(user.role, 'leads:write') ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-semibold">{editingLead ? 'Изменить заявку' : 'Новая заявка'}</h2>
            <form className="mt-5 space-y-4" action={editingLead ? `/api/crm/leads/${editingLead.id}` : '/api/crm/leads'} method="POST">
              {editingLead ? <input type="hidden" name="action" value="edit" /> : null}
              <label className="block text-sm text-slate-300">
                Клиент
                <input name="clientName" required minLength={2} maxLength={120} defaultValue={editingLead?.client ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Имя клиента" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  Телефон
                  <input name="phone" type="tel" required minLength={5} maxLength={40} defaultValue={editingLead?.phone ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Телефон" />
                </label>

                <label className="block text-sm text-slate-300">
                  Сумма
                  <input name="value" type="number" required min="0" max="1000000" step="0.01" defaultValue={editingLead?.value ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="0" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  WhatsApp
                  <input name="whatsapp" type="tel" maxLength={40} defaultValue={editingLead?.whatsapp ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Номер WhatsApp" />
                </label>
                <label className="block text-sm text-slate-300">
                  Instagram
                  <input name="instagram" maxLength={100} defaultValue={editingLead?.instagram ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="@username" />
                </label>
              </div>

              <label className="block text-sm text-slate-300">
                Город
                <input name="city" maxLength={100} defaultValue={editingLead?.city ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Город клиента" />
              </label>

              <label className="block text-sm text-slate-300">
                Источник
                <select name="source" required defaultValue={editingLead?.source ?? 'Instagram'} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </label>

              {user.role.toLowerCase() === 'sales' ? (
                assignees[0] ? <input type="hidden" name="assignedToId" value={assignees[0].id} /> : null
              ) : (
                <label className="block text-sm text-slate-300">
                  Ответственный менеджер
                  <select name="assignedToId" required defaultValue={editingLead?.assignedToId ?? assignees[0]?.id ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>{assignee.name} ({assignee.role === 'manager' ? 'РОП' : 'менеджер'})</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-sm text-slate-300">
                Заметка
                <textarea name="notes" maxLength={2000} rows={2} defaultValue={editingLead?.notes ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Дополнительная информация" />
              </label>

              <button type="submit" className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400">
                {editingLead ? 'Сохранить изменения' : 'Сохранить лид'}
              </button>
              {editingLead ? <Link href="/crm" className="block text-center text-sm text-slate-400 hover:text-white">Отменить редактирование</Link> : null}
            </form>
          </div> : null}
        </section> : null}

        <section className="grid gap-4 xl:grid-cols-6">
          {stageGroups.map(({ stage, leads }) => (
            <div key={stage} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">{LEAD_STATUS_LABELS[stage]}</span>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{leads.length}</span>
              </div>

              <div className="space-y-3">
                {leads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">
                    Нет лидов
                  </div>
                ) : (
                  leads.map((lead) => (
                    <div key={lead.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                      <p className="font-semibold text-white">{lead.client}</p>
                      {lead.phone ? <p className="mt-1 text-xs text-slate-400">{lead.phone}</p> : null}
                      {lead.whatsapp ? <p className="mt-1 text-xs text-slate-400">WhatsApp: {lead.whatsapp}</p> : null}
                      {lead.instagram ? <p className="mt-1 text-xs text-slate-400">Instagram: {lead.instagram}</p> : null}
                      {lead.city ? <p className="mt-1 text-xs text-slate-400">Город: {lead.city}</p> : null}
                      {lead.assignedTo ? <p className="mt-1 text-xs text-slate-400">Ответственный: {lead.assignedTo}</p> : null}
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{lead.source}</p>
                      <p className="mt-2 text-sm text-cyan-300">€{lead.value}</p>
                      {lead.reasonLost ? (
                        <p className="mt-2 text-xs text-rose-300">Причина: {lead.reasonLost}</p>
                      ) : null}
                      {lead.notes ? <p className="mt-2 text-xs text-slate-400">{lead.notes}</p> : null}
                      {hasPermission(user.role, 'leads:write') && !lead.isDemo ? (
                        <form className="mt-3 space-y-2 border-t border-slate-800 pt-3" action={`/api/crm/leads/${lead.id}`} method="POST">
                          <input type="hidden" name="action" value="status" />
                          <label className="block text-xs text-slate-400">
                            Изменить статус
                            <select name="status" defaultValue={lead.status} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white">
                              {LEAD_STAGES.map((status) => <option key={status} value={status}>{LEAD_STATUS_LABELS[status]}</option>)}
                            </select>
                          </label>
                          <label className="block text-xs text-slate-400">
                            Причина отказа (обязательна для статуса «Отказ»)
                            <select name="reasonLost" defaultValue={LEAD_LOSS_REASONS.includes(lead.reasonLost as (typeof LEAD_LOSS_REASONS)[number]) ? lead.reasonLost : ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white">
                              <option value="">Выберите причину</option>
                              {LEAD_LOSS_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                            </select>
                          </label>
                          <button type="submit" className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20">
                            Сохранить статус
                          </button>
                        </form>
                      ) : null}
                      {hasPermission(user.role, 'leads:write') && !lead.isDemo ? (
                        <Link href={`/crm?editLead=${encodeURIComponent(lead.id)}`} className="mt-2 block rounded-lg border border-slate-700 px-2 py-2 text-center text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200">
                          Редактировать карточку
                        </Link>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </section>

        {canAccessSection(user.role, 'orders') ? <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Заказы в работе</h2>
            <span className="text-sm text-slate-400">{orders.length} записей</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-300">{order.number}</span>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                    {order.status}
                  </span>
                </div>
                <p className="mt-3 text-lg font-semibold">{order.client}</p>
                <p className="text-sm text-slate-400">{order.product}</p>
                <p className="mt-2 text-xl font-bold text-emerald-300">€{order.total}</p>
                <p className="mt-3 text-xs text-slate-400">Ответственный: {order.assignee}</p>
              </article>
            ))}
          </div>
        </section> : null}
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

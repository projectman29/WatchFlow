import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection, hasPermission } from '@/lib/access';
import { LEAD_SOURCES, getLeadSourceSummary, getPipelineSummary } from '@/lib/crm';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getCRMLeadsFromDb, getLeadAssignees, getOrdersFromDb } from '@/lib/db-data';
import LeadsBoard from './leads-board';
import { isSalesDataFoundationReady } from '@/lib/sales-data-readiness';

export default async function CRMPage({
  searchParams,
}: {
  searchParams?: Promise<{ editLead?: string; leadError?: string; lead?: string; orderNumber?: string }>;
}) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user, 'crm') && !canAccessSection(user, 'leads')) {
    redirect('/dashboard');
  }

  const canViewCrmAnalytics = canAccessSection(user, 'crm');
  const salesDataReady = await isSalesDataFoundationReady();
  const leads = await getCRMLeadsFromDb(user);
  const orders = canAccessSection(user, 'orders') ? await getOrdersFromDb(user) : [];
  const activeOrders = orders.filter((order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED');
  const assignees = await getLeadAssignees(user);
  const params = searchParams ? await searchParams : {};
  const editingLead = leads.find((lead) => lead.id === params.editLead && !lead.isDemo);
  const pipelineSummary = getPipelineSummary(leads);
  const sourceSummary = getLeadSourceSummary(leads);
  return (
    <main className="min-h-screen bg-slate-950 px-3 py-5 text-slate-50 sm:px-6 sm:py-8 2xl:px-8">
      <div className="mx-auto w-full max-w-[1800px]">
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

        {params.leadError ? (
          <div role="alert" className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {params.leadError === 'loss_reason_required'
              ? 'Укажите причину отказа, чтобы перевести лид в статус «Отказ».'
              : params.leadError === 'client_required'
                ? 'Нельзя создать заказ: сначала заполните данные клиента в карточке лида.'
                : params.leadError === 'order_creation_failed'
                  ? 'Не удалось создать заказ. Статус лида не изменён; попробуйте ещё раз.'
              : params.leadError === 'invalid_fields'
                ? 'Не удалось сохранить изменения. Проверьте заполненные поля.'
                : params.leadError === 'not_found'
                  ? 'Лид не найден или у вас нет доступа к нему.'
                  : params.leadError === 'invalid_assignee'
                    ? 'Выберите доступного ответственного сотрудника.'
                    : 'Не удалось выполнить действие с лидом. Обновите страницу и попробуйте снова.'}
          </div>
        ) : null}
        {params.lead === 'order_created' ? (
          <div role="status" className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Заказ {params.orderNumber} создан и добавлен в раздел «Заказы».
          </div>
        ) : null}

        {canViewCrmAnalytics ? <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Всего лидов" value={pipelineSummary.total} accent="text-cyan-300" />
          <MetricCard label="В работе" value={pipelineSummary.inProgress} accent="text-violet-300" />
          <MetricCard label="WON" value={pipelineSummary.won} accent="text-emerald-300" />
          <MetricCard label="LOST" value={pipelineSummary.lost} accent="text-rose-300" />
        </section> : null}

        {canViewCrmAnalytics || hasPermission(user, 'leads:write') ? <section className={`mb-8 grid gap-4 ${canViewCrmAnalytics ? 'xl:grid-cols-[1.1fr_0.9fr]' : ''}`}>
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

          {hasPermission(user, 'leads:write') ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
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

        <LeadsBoard
          leads={leads}
          orders={activeOrders}
          canEdit={hasPermission(user, 'leads:write')}
          canViewOrders={canAccessSection(user, 'orders')}
          canCreateOrders={hasPermission(user, 'leads:write') && hasPermission(user, 'orders:write')}
          salesDataReady={salesDataReady}
        />
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

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection, hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { DESIGN_STATUS_LABELS, DESIGN_STATUSES, type DesignStatus } from '@/lib/design';
import { getRecordScope } from '@/lib/db-data';
import { prisma } from '@/lib/prisma';

const DESIGN_STATUS_ACCENTS: Record<DesignStatus, string> = {
  NEW: 'text-cyan-300',
  IN_PROGRESS: 'text-violet-300',
  READY_FOR_REVIEW: 'text-amber-300',
  REVISION: 'text-rose-300',
  APPROVED: 'text-emerald-300',
};

export default async function DesignPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const user = await getCurrentUserFromCookies();

  if (!user) redirect('/login');

  const canManage = hasPermission(user, 'orders:write');
  const canDesign = hasPermission(user, 'design:write');
  if (!canManage && !canAccessSection(user, 'design')) redirect('/dashboard');

  const query = searchParams ? await searchParams : {};
  const scope = await getRecordScope(user);
  const employee = await prisma.employee.findFirst({
    where: { user: { email: user.email } },
    select: { id: true },
  });
  const taskWhere = {
    ...(canManage && scope ? { order: scope } : {}),
    ...(!canManage
      ? { OR: [{ assignedDesignerId: employee?.id ?? '__unassigned__' }, { assignedDesignerId: null }] }
      : {}),
  };
  const tasks = await prisma.designTask.findMany({
    where: taskWhere,
    include: {
      order: {
        include: {
          client: true,
          items: { orderBy: { createdAt: 'asc' }, take: 1 },
        },
      },
      assignedDesigner: { select: { id: true, fullName: true } },
      files: { orderBy: { version: 'desc' } },
    },
    orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
  });
  const designers = canManage
    ? await prisma.employee.findMany({
        where: { isActive: true, user: { role: { name: 'designer' } } },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      })
    : [];
  const availableOrders = canManage
    ? await prisma.order.findMany({
        where: {
          ...(scope ?? {}),
          status: { in: ['NEW', 'WAITING_DESIGN', 'DESIGN_IN_PROGRESS'] },
          designTask: { is: null },
        },
        include: { client: true, items: { orderBy: { createdAt: 'asc' }, take: 1 } },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  const errorMessages: Record<string, string> = {
    unauthorized: 'Войдите в систему.',
    forbidden: 'У вас нет прав для этого действия.',
    invalid_fields: 'Проверьте заполненные поля.',
    invalid_designer: 'Выберите активного сотрудника с ролью дизайнера.',
    order_not_found: 'Заказ не найден или недоступен.',
    task_exists: 'Для этого заказа задача дизайна уже создана.',
    wrong_order_status: 'Создать задачу дизайна можно только для заказа на этапе дизайна.',
    task_not_found: 'Задача дизайна не найдена.',
    invalid_transition: 'Это действие недоступно для текущего этапа задачи.',
    designer_profile_missing: 'Для пользователя не найден профиль сотрудника.',
    invalid_file: 'Выберите непустой файл размером до 10 МБ.',
    unsupported_file: 'Поддерживаются только настоящие JPG, PNG и PDF файлы.',
    upload_failed: 'Не удалось сохранить макет. Попробуйте ещё раз.',
  };
  const successMessages: Record<string, string> = {
    uploaded: 'Макет загружен и отправлен на согласование.',
    approved: 'Дизайн подтверждён; заказ передан к следующему этапу.',
    revision_requested: 'Запрос на правки отправлен дизайнеру.',
    started: 'Задача взята в работу.',
    assigned: 'Дизайнер назначен.',
    created: 'Задача дизайна создана и поставлена в очередь.',
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Design workflow</p>
            <h1 className="mt-2 text-3xl font-bold">Дизайн и согласование</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/orders" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Заказы
            </Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Dashboard
            </Link>
          </div>
        </header>

        {query.error ? (
          <div role="alert" className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessages[query.error] ?? 'Операция не выполнена. Обновите страницу и попробуйте снова.'}
          </div>
        ) : null}
        {query.success ? (
          <div role="status" className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessages[query.success] ?? 'Изменения сохранены.'}
          </div>
        ) : null}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {DESIGN_STATUSES.map((status) => (
            <MetricCard
              key={status}
              label={DESIGN_STATUS_LABELS[status]}
              value={tasks.filter((task) => task.status === status).length}
              accent={DESIGN_STATUS_ACCENTS[status]}
            />
          ))}
        </section>

        {canManage && availableOrders.length > 0 ? (
          <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Поставить заказ в очередь дизайна</h2>
            <p className="mt-1 text-sm text-slate-400">Выберите заказ и при необходимости назначьте дизайнера и срок.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {availableOrders.map((order) => (
                <form key={order.id} action="/api/design/tasks/new" method="POST" className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-2">
                  <input type="hidden" name="action" value="create" />
                  <input type="hidden" name="orderId" value={order.id} />
                  <div>
                    <p className="font-semibold text-cyan-300">{order.number}</p>
                    <p className="mt-1 text-sm text-white">{order.client?.name ?? 'Клиент не указан'}</p>
                    <p className="mt-1 text-xs text-slate-400">{order.items[0]?.model ?? order.items[0]?.productName ?? 'Модель не указана'}</p>
                  </div>
                  <div className="space-y-2">
                    {designers.length > 0 ? (
                      <select name="designerId" defaultValue="" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                        <option value="">Без назначения</option>
                        {designers.map((designer) => <option key={designer.id} value={designer.id}>{designer.fullName}</option>)}
                      </select>
                    ) : null}
                    <input type="date" name="deadline" aria-label="Срок выполнения" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                    <button type="submit" className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                      Создать задачу
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-5">
          {DESIGN_STATUSES.map((status) => {
            const statusTasks = tasks.filter((task) => task.status === status);

            return (
              <div key={status} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className={`text-sm font-semibold uppercase tracking-[0.12em] ${DESIGN_STATUS_ACCENTS[status]}`}>
                    {DESIGN_STATUS_LABELS[status]}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{statusTasks.length}</span>
                </div>

                <div className="space-y-3">
                  {statusTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-500">Пусто</div>
                  ) : statusTasks.map((task) => {
                    const item = task.order.items[0];
                    const canWork = canDesign && (!task.assignedDesignerId || task.assignedDesignerId === employee?.id);

                    return (
                      <article key={task.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white">{task.order.client?.name ?? 'Клиент не указан'}</p>
                            <Link href={`/orders/${task.order.id}`} className="mt-1 inline-block text-xs text-cyan-300 hover:text-cyan-200">
                              {task.order.number}
                            </Link>
                          </div>
                          <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300">
                            Правки: {task.revisionCount}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">Модель: {item?.model ?? item?.productName ?? 'не указана'}</p>
                        {item?.engraving ? <p className="mt-1 text-sm text-slate-300">Надпись: {item.engraving}</p> : null}
                        {task.notes ? <p className="mt-2 rounded-lg bg-slate-900 p-2 text-xs text-slate-300">Пожелания/правки: {task.notes}</p> : null}
                        <p className="mt-2 text-xs text-slate-400">
                          Дизайнер: {task.assignedDesigner?.fullName ?? 'Не назначен'}
                        </p>
                        {task.deadline ? <p className="mt-1 text-xs text-slate-400">Срок: {task.deadline.toLocaleDateString('ru-RU')}</p> : null}

                        {task.files.length > 0 ? (
                          <div className="mt-3 space-y-1 border-t border-slate-800 pt-2">
                            <p className="text-xs text-slate-400">Макеты</p>
                            {task.files.map((file) => (
                              <a key={file.id} href={`/api/design/files/${file.id}`} target="_blank" rel="noreferrer" className="block truncate text-xs text-cyan-300 hover:text-cyan-200">
                                v{file.version} · {file.fileName}
                              </a>
                            ))}
                          </div>
                        ) : null}

                        {canManage && designers.length > 0 && status !== 'APPROVED' ? (
                          <form action={`/api/design/tasks/${task.id}`} method="POST" className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
                            <input type="hidden" name="action" value="assign" />
                            <select name="designerId" required defaultValue={task.assignedDesignerId ?? ''} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white">
                              <option value="" disabled>Назначить дизайнера</option>
                              {designers.map((designer) => <option key={designer.id} value={designer.id}>{designer.fullName}</option>)}
                            </select>
                            <button type="submit" className="rounded-lg border border-slate-700 px-2 text-xs text-slate-200 hover:border-cyan-500">Назначить</button>
                          </form>
                        ) : null}

                        {canWork && (status === 'NEW' || status === 'REVISION') ? (
                          <form action={`/api/design/tasks/${task.id}`} method="POST" className="mt-3 border-t border-slate-800 pt-3">
                            <input type="hidden" name="action" value="start" />
                            <button type="submit" className="w-full rounded-lg bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/25">
                              {status === 'REVISION' ? 'Начать правки' : 'Взять в работу'}
                            </button>
                          </form>
                        ) : null}

                        {canWork && status === 'IN_PROGRESS' ? (
                          <form action={`/api/design/tasks/${task.id}/files`} method="POST" encType="multipart/form-data" className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                            <label className="block text-xs text-slate-400">
                              Загрузить макет (JPG, PNG или PDF, до 10 МБ)
                              <input type="file" name="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" required className="mt-2 block w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-2 file:py-1.5 file:text-xs file:text-slate-100" />
                            </label>
                            <button type="submit" className="w-full rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20">
                              Отправить на согласование
                            </button>
                          </form>
                        ) : null}

                        {canManage && status === 'READY_FOR_REVIEW' ? (
                          <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                            <form action={`/api/design/tasks/${task.id}`} method="POST">
                              <input type="hidden" name="action" value="approve" />
                              <button type="submit" className="w-full rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25">
                                Дизайн подтверждён
                              </button>
                            </form>
                            <form action={`/api/design/tasks/${task.id}`} method="POST" className="space-y-2">
                              <input type="hidden" name="action" value="revision" />
                              <textarea name="notes" required minLength={1} maxLength={2000} rows={2} placeholder="Что нужно исправить?" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white" />
                              <button type="submit" className="w-full rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20">
                                Запросить правки
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

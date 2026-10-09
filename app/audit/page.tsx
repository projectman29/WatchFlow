import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { AUDIT_ACTION_LABELS } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

type AuditSearchParams = {
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
};

function validDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}

function displayDetails(value: string | null): string {
  if (!value) return 'Подробности не указаны.';
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const details = { ...parsed };
      delete (details as Record<string, unknown>).actor;
      return JSON.stringify(details, null, 2);
    }
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<AuditSearchParams>;
}) {
  const user = await getCurrentUserFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'audit:read')) redirect('/dashboard');

  const query = searchParams ? await searchParams : {};
  const from = validDate(query.from);
  const until = validDate(query.to);
  if (until) until.setUTCDate(until.getUTCDate() + 1);

  const filters = {
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(from || until
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(until ? { lt: until } : {}) } }
      : {}),
  };

  const [entries, entities, actions] = await Promise.all([
    prisma.activityLog.findMany({
      where: filters,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.activityLog.findMany({
      distinct: ['entity'],
      select: { entity: true },
      orderBy: { entity: 'asc' },
    }),
    prisma.activityLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Administration</p>
            <h1 className="mt-2 text-3xl font-bold">История и аудит</h1>
            <p className="mt-2 text-sm text-slate-400">Последние 100 записей. Доступ только у администратора.</p>
          </div>
          <Link href="/dashboard" className="self-start rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Dashboard
          </Link>
        </header>

        <form method="GET" className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-slate-400">
            Объект
            <select name="entity" defaultValue={query.entity ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="">Все объекты</option>
              {entities.map(({ entity }) => <option key={entity} value={entity}>{entity}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Действие
            <select name="action" defaultValue={query.action ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="">Все действия</option>
              {actions.map(({ action }) => <option key={action} value={action}>{AUDIT_ACTION_LABELS[action] ?? action}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            С даты
            <input type="date" name="from" defaultValue={query.from ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-400">
            По дату
            <input type="date" name="to" defaultValue={query.to ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Фильтровать</button>
            <Link href="/audit" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Сбросить</Link>
          </div>
        </form>

        <section className="space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
              Записей за выбранный период нет.
            </div>
          ) : entries.map((entry) => {
            let details: Record<string, unknown> = {};
            try {
              const parsed: unknown = JSON.parse(entry.details ?? '{}');
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                details = parsed as Record<string, unknown>;
              }
            } catch {
              details = {};
            }
            const actor = entry.user?.name ?? (typeof details.actor === 'string' ? details.actor : 'Система');

            return (
              <article key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-white">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {actor} · {entry.entity}{entry.entityId ? ` · ${entry.entityId}` : ''}
                    </p>
                  </div>
                  <time className="text-xs text-slate-500" dateTime={entry.createdAt.toISOString()}>
                    {entry.createdAt.toLocaleString('ru-RU')}
                  </time>
                </div>
                <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-cyan-300">Изменения и подробности</summary>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-slate-800 p-3 text-xs leading-relaxed text-slate-300">{displayDetails(entry.details)}</pre>
                </details>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

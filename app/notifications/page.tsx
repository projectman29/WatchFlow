import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string }>;
}) {
  const user = await getCurrentUserFromCookies();
  if (!user) redirect('/login');

  const query = searchParams ? await searchParams : {};
  const notificationUser = user.id.startsWith('demo-')
    ? await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } })
    : { id: user.id };
  const notifications = notificationUser
    ? await prisma.notification.findMany({
        where: { userId: notificationUser.id },
        orderBy: [{ readAt: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      })
    : [];
  const unreadCount = notifications.filter((notification) => notification.readAt === null).length;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">WatchFlow</p>
            <h1 className="mt-2 text-3xl font-bold">Уведомления</h1>
            <p className="mt-2 text-sm text-slate-400">Непрочитанных: {unreadCount}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
              Dashboard
            </Link>
            {unreadCount > 0 ? (
              <form action="/api/notifications" method="POST">
                <input type="hidden" name="action" value="read-all" />
                <button type="submit" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  Прочитать все
                </button>
              </form>
            ) : null}
          </div>
        </header>

        {query.updated ? (
          <p role="status" className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Статус уведомлений обновлён.
          </p>
        ) : null}

        <section className="space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
              Пока нет уведомлений.
            </div>
          ) : notifications.map((notification) => (
            <article
              key={notification.id}
              className={`rounded-2xl border p-5 ${notification.readAt ? 'border-slate-800 bg-slate-900' : 'border-cyan-500/40 bg-cyan-500/5'}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {!notification.readAt ? <span className="h-2 w-2 rounded-full bg-cyan-400" aria-label="Новое" /> : null}
                    <h2 className="font-semibold text-white">{notification.title}</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
                  <time className="mt-3 block text-xs text-slate-500" dateTime={notification.createdAt.toISOString()}>
                    {notification.createdAt.toLocaleString('ru-RU')}
                  </time>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {notification.href ? (
                    <Link href={notification.href} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
                      Открыть
                    </Link>
                  ) : null}
                  {!notification.readAt ? (
                    <form action="/api/notifications" method="POST">
                      <input type="hidden" name="action" value="read-one" />
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button type="submit" className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-cyan-500">
                        Прочитано
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

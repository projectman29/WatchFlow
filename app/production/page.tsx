import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';

export default async function ProductionPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user, 'production')) {
    redirect('/dashboard');
  }

  const tasks = [
    { id: 'p1', order: 'ORD-2025-0002', client: 'Aster&Bloom', master: user.name, status: 'WAITING_PRODUCTION', progress: 20, deadline: '2026-10-18' },
    { id: 'p2', order: 'ORD-2025-0008', client: 'Northmark', master: user.name, status: 'IN_PROGRESS', progress: 60, deadline: '2026-10-20' },
    { id: 'p3', order: 'ORD-2025-0012', client: 'Zenith Lab', master: user.name, status: 'QUALITY_CONTROL', progress: 85, deadline: '2026-10-22' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Production</p>
            <h1 className="mt-2 text-3xl font-bold">Производство</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/design" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Дизайн</Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">Dashboard</Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Всего задач</p>
            <p className="mt-2 text-3xl font-bold text-cyan-300">{tasks.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">В работе</p>
            <p className="mt-2 text-3xl font-bold text-violet-300">{tasks.filter((task) => task.status === 'IN_PROGRESS').length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Готово</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{tasks.filter((task) => task.status === 'QUALITY_CONTROL').length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Просрочено</p>
            <p className="mt-2 text-3xl font-bold text-amber-300">0</p>
          </div>
        </section>

        <section className="grid gap-4">
          {tasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.15em] text-slate-400">{task.order}</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{task.client}</h2>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.12em] text-slate-200">{task.status}</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
                <div>Мастер: {task.master}</div>
                <div>Прогресс: {task.progress}%</div>
                <div>Дедлайн: {task.deadline}</div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';

export default async function DesignPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user, 'design')) {
    redirect('/dashboard');
  }

  const tasks = [
    { id: 'd1', order: 'ORD-2025-0001', client: 'Atelier Quartz', artist: user.name, asset: 'Часы prototype', version: 1, status: 'NEW' },
    { id: 'd2', order: 'ORD-2025-0004', client: 'Vance Studio', artist: user.name, asset: 'Коробка и упаковка', version: 2, status: 'IN_PROGRESS' },
    { id: 'd3', order: 'ORD-2025-0010', client: 'Northmark', artist: user.name, asset: 'Логотип / бренд', version: 1, status: 'READY_FOR_REVIEW' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Design workflow</p>
            <h1 className="mt-2 text-3xl font-bold">Дизайн и согласование</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/orders" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">Заказы</Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Dashboard</Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Всего задач</p>
            <p className="mt-2 text-3xl font-bold text-cyan-300">{tasks.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">В работе</p>
            <p className="mt-2 text-3xl font-bold text-violet-300">{tasks.filter((task) => task.status === 'IN_PROGRESS').length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">На согласовании</p>
            <p className="mt-2 text-3xl font-bold text-amber-300">{tasks.filter((task) => task.status === 'READY_FOR_REVIEW').length}</p>
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
                <div>Дизайнер: {task.artist}</div>
                <div>Актив: {task.asset}</div>
                <div>Версия: {task.version}</div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

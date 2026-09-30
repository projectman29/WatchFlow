import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUserFromCookies } from '@/lib/auth';

export default async function AdminPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  const cards = [
    { label: 'Сотрудники', value: '12', href: '/admin/employees' },
    { label: 'Роли', value: '8', href: '/admin/employees' },
    { label: 'Доступы', value: '18', href: '/admin/employees' },
    { label: 'Активных', value: '10', href: '/admin/employees' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Admin Panel</p>
            <h1 className="mt-2 text-3xl font-bold">Управление системой</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Dashboard
            </Link>
            <Link href="/admin/employees" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Сотрудники
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-500/60 hover:bg-slate-800">
              <p className="text-sm uppercase tracking-[0.15em] text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-bold text-cyan-300">{card.value}</p>
            </Link>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Основные задачи</h2>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            <li>• Создавать и блокировать сотрудников</li>
            <li>• Назначать роли и права доступа</li>
            <li>• Следить за активностью и безопасностью</li>
            <li>• Настраивать доступ к разделам системы</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

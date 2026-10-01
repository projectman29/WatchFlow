import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection, getAssignedEmployeeIds, normalizeRole } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromCookies } from '@/lib/auth';

async function getDashboardSummary(user: { id: string; email: string; name: string; role: string }) {
  const role = normalizeRole(user.role);
  let scope: { managerId: { in: string[] } } | undefined;

  if (role === 'manager' || role === 'sales') {
    const employee = await prisma.employee.findFirst({
      where: { user: { email: user.email } },
      select: { id: true, subordinates: { select: { id: true } } },
    }).catch(() => null);
    const employeeIds = getAssignedEmployeeIds(
      role,
      employee?.id ?? null,
      employee?.subordinates.map((subordinate) => subordinate.id) ?? [],
    );
    scope = { managerId: { in: employeeIds ?? [] } };
  }

  if (!process.env.DATABASE_URL) {
    return {
      leads: role === 'sales' ? 3 : role === 'manager' ? 6 : 18,
      orders: role === 'sales' ? 1 : role === 'manager' ? 3 : 11,
      clients: role === 'sales' ? 3 : role === 'manager' ? 6 : 27,
      inventory: 128,
      revenue: 84200,
      conversion: 24,
      roleLabel: 'Admin',
    };
  }

  try {
    const [leadCount, orderCount, clientCount, inventoryCount] = await Promise.all([
      prisma.lead.count({ where: scope }),
      prisma.order.count({ where: scope }),
      prisma.client.count({ where: scope ? { leads: { some: scope } } : undefined }),
      prisma.inventoryItem.count(),
    ]);

    return {
      leads: leadCount,
      orders: orderCount,
      clients: clientCount,
      inventory: inventoryCount,
      revenue: orderCount * 2400,
      conversion: 26,
      roleLabel: 'Admin',
    };
  } catch {
    return {
      leads: role === 'sales' ? 3 : role === 'manager' ? 6 : 18,
      orders: role === 'sales' ? 1 : role === 'manager' ? 3 : 11,
      clients: role === 'sales' ? 3 : role === 'manager' ? 6 : 27,
      inventory: 128,
      revenue: 84200,
      conversion: 24,
      roleLabel: 'Admin',
    };
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  const summary = await getDashboardSummary(user);

  const cards = [
    ...(canAccessSection(user.role, 'leads') || canAccessSection(user.role, 'crm')
      ? [{ label: 'Лиды', value: summary.leads, accent: 'text-cyan-300' }]
      : []),
    ...(canAccessSection(user.role, 'orders')
      ? [{ label: 'Заказы', value: summary.orders, accent: 'text-violet-300' }]
      : []),
    ...(canAccessSection(user.role, 'crm')
      ? [{ label: 'Клиенты', value: summary.clients, accent: 'text-emerald-300' }]
      : []),
    ...(canAccessSection(user.role, 'warehouse')
      ? [{ label: 'Остаток', value: summary.inventory, accent: 'text-amber-300' }]
      : []),
  ];

  const quickLinks = [
    { href: '/crm', label: canAccessSection(user.role, 'crm') ? 'CRM / Воронка' : 'Лиды', show: canAccessSection(user.role, 'crm') || canAccessSection(user.role, 'leads') },
    { href: '/orders', label: 'Заказы', show: canAccessSection(user.role, 'orders') },
    { href: '/design', label: 'Дизайн', show: canAccessSection(user.role, 'design') },
    { href: '/production', label: 'Производство', show: canAccessSection(user.role, 'production') },
    { href: '/warehouse', label: 'Склад', show: canAccessSection(user.role, 'warehouse') },
    { href: '/logistics', label: 'Логистика', show: canAccessSection(user.role, 'logistics') },
    { href: '/employees', label: 'Сотрудники', show: canAccessSection(user.role, 'employees') },
    { href: '/admin', label: 'Admin Panel', show: canAccessSection(user.role, 'admin') },
  ].filter((link) => link.show);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">WatchFlow</p>
            <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-300">
              {user.name}
            </div>
            <div className="rounded-full bg-cyan-500 px-3 py-1 text-sm font-semibold text-slate-950">
              {user.role}
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Выйти
              </button>
            </form>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm uppercase tracking-[0.15em] text-slate-400">{card.label}</p>
              <p className={`mt-3 text-4xl font-bold ${card.accent}`}>{card.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 flex flex-wrap gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                link.href === '/admin'
                  ? 'bg-violet-500 text-white hover:bg-violet-400'
                  : 'border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </section>

        {canAccessSection(user.role, 'reports') ? <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Операционные показатели</h2>
              <span className="text-sm text-emerald-400">+12.4% к плану</span>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                  <span>Продажи</span>
                  <span>84%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800">
                  <div className="h-2.5 w-[84%] rounded-full bg-cyan-400" />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                  <span>Конверсия</span>
                  <span>{summary.conversion}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800">
                  <div className="h-2.5 w-[62%] rounded-full bg-violet-400" />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                  <span>Доставка</span>
                  <span>91%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800">
                  <div className="h-2.5 w-[91%] rounded-full bg-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Подразделения</h2>
            <ul className="mt-5 space-y-3 text-sm text-slate-300">
              <li className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2"><span>CRM</span><span className="text-cyan-300">Активно</span></li>
              <li className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2"><span>Производство</span><span className="text-violet-300">В работе</span></li>
              <li className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2"><span>Склад</span><span className="text-emerald-300">Норма</span></li>
              <li className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2"><span>Маркетинг</span><span className="text-amber-300">Готово</span></li>
            </ul>
          </div>
        </section> : null}

        <div className="mt-8 flex items-center gap-4">
          <Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900">
            На главную
          </Link>
          <Link href="/login" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
            Обновить вход
          </Link>
        </div>
      </div>
    </main>
  );
}

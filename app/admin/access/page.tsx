import Link from 'next/link';
import { redirect } from 'next/navigation';
import { normalizeRole } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import RoleAccessManager from './role-access-manager';

export default async function AccessSettingsPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'admin') redirect('/dashboard');

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { name: { not: 'admin' } },
      include: { permissions: { select: { key: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.permission.findMany({ select: { key: true }, orderBy: { key: 'asc' } }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Admin Panel</p>
            <h1 className="mt-2 text-3xl font-bold">Настройка доступа</h1>
            <p className="mt-2 text-sm text-slate-400">Настройте права для каждой роли. Права администратора защищены и не редактируются.</p>
          </div>
          <Link href="/admin" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
            Назад в панель
          </Link>
        </header>

        <RoleAccessManager
          roles={roles.map((role) => ({
            name: role.name,
            label: role.label,
            permissionKeys: role.permissions.map(({ key }) => key),
          }))}
          permissions={permissions.map(({ key }) => key)}
        />
      </div>
    </main>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getEmployeeSummary } from '@/lib/employees';
import { getEmployeesFromDb } from '@/lib/db-data';

export default async function EmployeesPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user.role, 'employees')) {
    redirect('/dashboard');
  }

  const employees = await getEmployeesFromDb();
  const summary = getEmployeeSummary(employees);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Team</p>
            <h1 className="mt-2 text-3xl font-bold">Сотрудники</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Dashboard
            </Link>
            <Link href="/admin" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Admin Panel
            </Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <MetricCard label="Всего" value={summary.total} accent="text-cyan-300" />
          <MetricCard label="Активно" value={summary.active} accent="text-emerald-300" />
          <MetricCard label="Отделов" value={Object.keys(summary.byDepartment).length} accent="text-violet-300" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => (
            <article key={employee.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{employee.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{employee.position}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${
                    employee.isActive ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border border-slate-700 bg-slate-950 text-slate-300'
                  }`}
                >
                  {employee.status}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <InfoRow label="Отдел" value={employee.department} />
                <InfoRow label="Роль" value={employee.role} />
                <InfoRow label="Email" value={employee.email} />
                <InfoRow label="Телефон" value={employee.phone} />
              </div>
            </article>
          ))}
        </section>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-200">{value}</span>
    </div>
  );
}

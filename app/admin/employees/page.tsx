import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ADMIN_ROLE_OPTIONS, DEMO_EMPLOYEES } from '@/lib/admin';
import { employeeDirectory } from '@/lib/employees';
import { getCurrentUserFromCookies } from '@/lib/auth';

async function getEmployees() {
  if (!process.env.DATABASE_URL) {
    return employeeDirectory;
  }

  try {
    return employeeDirectory;
  } catch {
    return DEMO_EMPLOYEES.map((employee) => ({
      ...employee,
      name: employee.fullName,
      department: (employee.department ?? 'Sales') as any,
      role: (employee.role ?? 'sales') as any,
      status: employee.isActive ? 'active' : 'inactive',
    }));
  }
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: { editId?: string } | Promise<{ editId?: string }>;
}) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  const params = searchParams ? await searchParams : {};
  const editId = params?.editId ?? '';
  const employees = await getEmployees();
  const editingEmployee = employees.find((employee) => employee.id === editId);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Admin</p>
            <h1 className="mt-2 text-3xl font-bold">Сотрудники</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Admin Panel
            </Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Список сотрудников</h2>
            <div className="mt-5 space-y-3">
              {employees.map((employee) => (
                <div key={employee.id} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{employee.name}</p>
                      <p className="text-sm text-slate-400">{employee.position}</p>
                    </div>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-200">
                      {employee.role}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                    <p>Email: {employee.email}</p>
                    <p>Телефон: {employee.phone}</p>
                    <p>Отдел: {employee.department}</p>
                    <p>Статус: {employee.isActive ? 'Активен' : 'Заблокирован'}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/admin/employees?editId=${employee.id}`}
                      className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300"
                    >
                      Изменить
                    </Link>
                    <form action="/api/admin/employees" method="POST">
                      <input type="hidden" name="_action" value={employee.isActive ? 'block' : 'unblock'} />
                      <input type="hidden" name="employeeId" value={employee.id} />
                      <button type="submit" className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${employee.isActive ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
                        {employee.isActive ? 'Блокировать' : 'Разблокировать'}
                      </button>
                    </form>
                    <form action="/api/admin/employees" method="POST">
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="employeeId" value={employee.id} />
                      <button type="submit" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-300">
                        Удалить
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">{editingEmployee ? 'Изменить сотрудника' : 'Добавить сотрудника'}</h2>
            <form className="mt-5 space-y-4" action="/api/admin/employees" method="POST">
              {editingEmployee ? <input type="hidden" name="employeeId" value={editingEmployee.id} /> : null}
              <input type="hidden" name="_action" value={editingEmployee ? 'update' : 'create'} />

              <label className="block text-sm text-slate-300">
                ФИО
                <input name="name" required defaultValue={editingEmployee?.name ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Иван Иванов" />
              </label>

              <label className="block text-sm text-slate-300">
                Email
                <input type="email" name="email" required defaultValue={editingEmployee?.email ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="employee@watchflow.local" />
              </label>

              <label className="block text-sm text-slate-300">
                Должность
                <input name="position" required defaultValue={editingEmployee?.position ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Менеджер по продажам" />
              </label>

              <label className="block text-sm text-slate-300">
                Телефон
                <input name="phone" defaultValue={editingEmployee?.phone ?? ''} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="+7 700 000 00 00" />
              </label>

              <label className="block text-sm text-slate-300">
                Отдел
                <select name="department" defaultValue={editingEmployee?.department ?? 'Sales'} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                  <option value="Administration">Administration</option>
                  <option value="Sales">Sales</option>
                  <option value="Production">Production</option>
                  <option value="Warehouse">Warehouse</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Marketing">Marketing</option>
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Роль
                <select name="role" defaultValue={editingEmployee?.role ?? 'sales'} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
                  {ADMIN_ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" name="isActive" defaultChecked={editingEmployee?.isActive ?? true} className="h-4 w-4 rounded border-slate-700 bg-slate-950" />
                Активен
              </label>

              <button type="submit" className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400">
                {editingEmployee ? 'Сохранить изменения' : 'Создать сотрудника'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

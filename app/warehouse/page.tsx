import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getInventorySummary, getLowStockItems, productBOM, warehouseInventory } from '@/lib/inventory';

export default async function WarehousePage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect('/login');
  }

  if (!canAccessSection(user.role, 'warehouse')) {
    redirect('/dashboard');
  }

  const lowStockItems = getLowStockItems(warehouseInventory);
  const summary = getInventorySummary(warehouseInventory);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Warehouse</p>
            <h1 className="mt-2 text-3xl font-bold">Склад</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/production" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800">
              Производство
            </Link>
            <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Всего единиц" value={summary.totalUnits} accent="text-cyan-300" />
          <MetricCard label="Низкий остаток" value={summary.lowStock} accent="text-amber-300" />
          <MetricCard label="Критично" value={summary.critical} accent="text-rose-300" />
          <MetricCard label="Компонентов BOM" value={productBOM.length} accent="text-emerald-300" />
        </section>

        <section className="mb-8 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">⚠ Предупреждения</h2>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs uppercase tracking-[0.15em] text-amber-300">
                {lowStockItems.length}
              </span>
            </div>

            <div className="space-y-3">
              {lowStockItems.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-400">Низких остатков нет</p>
              ) : (
                lowStockItems.map((item) => (
                  <div key={item.sku} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <strong className="text-amber-200">{item.name}</strong>
                      <span className="text-xs uppercase tracking-[0.12em] text-amber-200">{item.sku}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">Остаток: {item.stock} / минимум: {item.reorderLevel}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">BOM: WATCH-001</h2>
            <div className="mt-5 space-y-3">
              {productBOM.map((row) => (
                <div key={`${row.product}-${row.component}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                  <span className="text-slate-200">{row.component}</span>
                  <span className="font-medium text-cyan-300">×{row.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Категория</th>
                  <th className="px-4 py-3">Остаток</th>
                  <th className="px-4 py-3">Минимум</th>
                  <th className="px-4 py-3">Место</th>
                </tr>
              </thead>
              <tbody>
                {warehouseInventory.map((item) => (
                  <tr key={item.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-cyan-300">{item.sku}</td>
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3 text-slate-300">{item.category}</td>
                    <td className={`px-4 py-3 font-medium ${item.stock <= item.reorderLevel ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {item.stock}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{item.reorderLevel}</td>
                    <td className="px-4 py-3 text-slate-300">{item.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

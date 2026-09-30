import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-400">WatchFlow</p>
            <h1 className="mt-2 text-3xl font-bold">Операционная система для часов</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-cyan-500/60 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/10"
            >
              Войти
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-cyan-500/60 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/10"
            >
              Admin
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mt-14 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
              Production & Sales OS
            </p>
            <h2 className="mt-6 max-w-xl text-5xl font-black leading-tight tracking-tight">
              Все процессы — от лида до доставки — в одной системе.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              CRM, производство, склад, логистика, маркетинг и KPI объединены в одном рабочем пространстве с ролями и проверками доступа.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-full bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Перейти в систему
              </Link>
              <Link
                href="/admin"
                className="rounded-full border border-cyan-500/60 px-6 py-3 font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/10"
              >
                Admin Panel
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-slate-700 px-6 py-3 font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
            <div className="grid gap-4">
              <div className="rounded-2xl bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Продажи</p>
                <p className="mt-2 text-3xl font-bold text-cyan-300">€84.2k</p>
                <p className="mt-1 text-sm text-emerald-400">+12.4% vs. план</p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Лиды</p>
                <p className="mt-2 text-3xl font-bold text-violet-300">1,248</p>
                <p className="mt-1 text-sm text-violet-200">+8 кампаний</p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Производство</p>
                <p className="mt-2 text-3xl font-bold text-amber-300">94%</p>
                <p className="mt-1 text-sm text-amber-200">Срок соблюдается</p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}

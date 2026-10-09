export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorKey } = await searchParams;
  const errorMessage =
    errorKey === 'missing_credentials'
      ? 'Email and password are required.'
      : errorKey === 'invalid_credentials'
        ? 'Invalid credentials'
        : '';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/60">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">WatchFlow</p>
          <h1 className="mt-3 text-3xl font-bold">Вход в систему</h1>
        </div>

        <form className="space-y-5" action="/api/auth/login" method="POST" autoComplete="off">
          <label className="block text-sm text-slate-300">
            Email
            <input
              name="email"
              type="email"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
              required
            />
          </label>

          <label className="block text-sm text-slate-300">
            Пароль
            <input
              name="password"
              type="password"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
              required
            />
          </label>

          {errorMessage ? (
            <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Войти
          </button>
        </form>

      </div>
    </main>
  );
}

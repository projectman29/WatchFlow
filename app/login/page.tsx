'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const nextEmail = String(formData.get('email') ?? '').trim();
    const nextPassword = String(formData.get('password') ?? '');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Login failed.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/60">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">WatchFlow</p>
          <h1 className="mt-3 text-3xl font-bold">Вход в систему</h1>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} autoComplete="off">
          <label className="block text-sm text-slate-300">
            Email
            <input
              type="email"
              name="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
              required
            />
          </label>

          <label className="block text-sm text-slate-300">
            Пароль
            <input
              type="password"
              name="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
              required
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          <p>Демо-аккаунты:</p>
          <p>admin@watchflow.local / admin123</p>
          <p>manager@watchflow.local / manager123</p>
          <p>sales@watchflow.local / sales123</p>
          <p>designer@watchflow.local / designer123</p>
          <p>master@watchflow.local / master123</p>
          <p>warehouse@watchflow.local / warehouse123</p>
          <p>logistics@watchflow.local / logistics123</p>
          <p>marketing@watchflow.local / marketing123</p>
        </div>
      </div>
    </main>
  );
}

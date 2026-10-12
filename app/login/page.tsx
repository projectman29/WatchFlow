'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { readJsonResponseBody } from '@/lib/http';

const ERROR_MESSAGES: Record<string, string> = {
  missing_credentials: 'Email and password are required.',
  invalid_credentials: 'Invalid credentials',
  rate_limited: 'Too many failed login attempts. Please try again later.',
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorKey = searchParams.get('error') ?? '';
  const displayedError = error || ERROR_MESSAGES[errorKey] || '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const nextEmail = email.trim();
    const nextPassword = password;

    if (!nextEmail || !nextPassword) {
      setError(ERROR_MESSAGES.missing_credentials);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      });

      const data = await readJsonResponseBody(response);

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Login failed.');
      }

      if (typeof window !== 'undefined') {
        window.location.assign('/dashboard');
        return;
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
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
              required
            />
          </label>

          {displayedError ? (
            <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {displayedError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Проверка...' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          <p>Демо-аккаунты:</p>
          <p>admin@watchflow.local / AdminPass123!</p>
          <p>manager@watchflow.local / ManagerPass123!</p>
          <p>sales@watchflow.local / SalesPass123!</p>
          <p>designer@watchflow.local / DesignerPass123!</p>
          <p>master@watchflow.local / MasterPass123!</p>
          <p>warehouse@watchflow.local / WarehousePass123!</p>
          <p>logistics@watchflow.local / LogisticsPass123!</p>
          <p>marketing@watchflow.local / MarketingPass123!</p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white"><div className="text-slate-300">Loading...</div></main>}>
      <LoginPageContent />
    </Suspense>
  );
}

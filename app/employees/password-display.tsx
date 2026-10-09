'use client';

import Link from 'next/link';

export default function PasswordDisplay({ replaceHref }: { replaceHref?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right text-sm text-slate-200">
      <span aria-label="Сохранённый пароль скрыт">••••••••••••</span>
      {replaceHref ? (
        <Link href={replaceHref} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
          Заменить
        </Link>
      ) : null}
    </div>
  );
}

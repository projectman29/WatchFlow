'use client';

import { useState } from 'react';

export default function PasswordInput({
  name,
  required,
  placeholder,
}: {
  name: string;
  required: boolean;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mt-2 flex rounded-xl border border-slate-700 bg-slate-950 focus-within:border-cyan-500">
      <input
        type={visible ? 'text' : 'password'}
        name={name}
        required={required}
        minLength={12}
        maxLength={128}
        autoComplete="new-password"
        className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3 py-2.5 text-white outline-none"
        placeholder={placeholder}
      />
      <button
        type="button"
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="rounded-r-xl px-3 text-xs font-medium text-cyan-300 hover:bg-slate-800"
      >
        {visible ? 'Скрыть' : 'Показать'}
      </button>
    </div>
  );
}

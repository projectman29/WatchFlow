'use client';

import { useState } from 'react';
import { PERMISSION_LABELS } from '@/lib/access';

type RoleAccess = {
  name: string;
  label: string;
  permissionKeys: string[];
};

export default function RoleAccessManager({
  roles,
  permissions,
}: {
  roles: RoleAccess[];
  permissions: string[];
}) {
  const [roleAccess, setRoleAccess] = useState(roles);
  const [selectedRole, setSelectedRole] = useState(roles[0]?.name ?? '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const currentRole = roleAccess.find((role) => role.name === selectedRole);

  function togglePermission(permission: string) {
    setRoleAccess((current) => current.map((role) => {
      if (role.name !== selectedRole) return role;
      const permissionKeys = role.permissionKeys.includes(permission)
        ? role.permissionKeys.filter((key) => key !== permission)
        : [...role.permissionKeys, permission];
      return { ...role, permissionKeys };
    }));
    setMessage('');
  }

  async function savePermissions() {
    if (!currentRole) return;
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: currentRole.name, permissionKeys: currentRole.permissionKeys }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Не удалось сохранить настройки.');

      setMessage('Права доступа сохранены.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить настройки.');
    } finally {
      setSaving(false);
    }
  }

  if (!roles.length) {
    return <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Нет ролей для настройки.</p>;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <label htmlFor="role-select" className="block text-sm font-medium text-slate-300">Роль</label>
      <select
        id="role-select"
        value={selectedRole}
        onChange={(event) => {
          setSelectedRole(event.target.value);
          setMessage('');
        }}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white sm:max-w-sm"
      >
        {roleAccess.map((role) => <option key={role.name} value={role.name}>{role.label}</option>)}
      </select>

      <h2 className="mt-8 text-lg font-semibold">Разрешения</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {permissions.map((permission) => (
          <label key={permission} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 hover:border-slate-600">
            <input
              type="checkbox"
              checked={currentRole?.permissionKeys.includes(permission) ?? false}
              onChange={() => togglePermission(permission)}
              className="mt-1 size-4 accent-cyan-400"
            />
            <span>
              <span className="block text-sm font-medium text-slate-100">{PERMISSION_LABELS[permission] ?? permission}</span>
              <span className="mt-1 block text-xs text-slate-500">{permission}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={saving}
          onClick={savePermissions}
          className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Сохранение…' : 'Сохранить права'}
        </button>
        <p aria-live="polite" className="text-sm text-slate-300">{message}</p>
      </div>
    </section>
  );
}

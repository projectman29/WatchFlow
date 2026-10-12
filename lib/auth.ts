import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'watchflow_session';
export const DEV_JWT_SECRET_FALLBACK = 'watchflow-local-development-secret-at-least-32-bytes';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
};

export function isEmployeeAccountActive(employee?: { isActive: boolean } | null): boolean {
  return employee?.isActive === true;
}

export function getJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET?.trim();

  if (configuredSecret && Buffer.byteLength(configuredSecret, 'utf8') >= 32) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_JWT_SECRET_FALLBACK;
  }

  throw new Error('JWT_SECRET must be configured with at least 32 bytes.');
}

export function parseLoginCredentials(input: unknown): { email: string; password: string } | null {
  if (!input) {
    return null;
  }

  if (input instanceof URLSearchParams) {
    const email = input.get('email');
    const password = input.get('password');

    if (typeof email === 'string' && typeof password === 'string') {
      return { email: email.trim(), password };
    }

    return null;
  }

  if (input instanceof FormData) {
    const email = input.get('email');
    const password = input.get('password');

    if (typeof email === 'string' && typeof password === 'string') {
      return { email: email.trim(), password };
    }

    return null;
  }

  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    const email = record.email;
    const password = record.password;

    if (typeof email === 'string' && typeof password === 'string') {
      return { email: email.trim(), password };
    }
  }

  return null;
}

export function authenticateDemoAdmin(email: string, password: string): SessionUser | null {
  const normalizedEmail = email.trim().toLowerCase();

  const demoUsers: Record<string, { password: string; name: string; role: string }> = {
    'admin@watchflow.local': { password: 'AdminPass123!', name: 'Super Admin', role: 'admin' },
    'manager@watchflow.local': { password: 'ManagerPass123!', name: 'Марина Соколова', role: 'manager' },
    'sales@watchflow.local': { password: 'SalesPass123!', name: 'Иван Петров', role: 'sales' },
    'designer@watchflow.local': { password: 'DesignerPass123!', name: 'Ольга Дизайнер', role: 'designer' },
    'master@watchflow.local': { password: 'MasterPass123!', name: 'Игорь Мастер', role: 'master' },
    'warehouse@watchflow.local': { password: 'WarehousePass123!', name: 'Сергей Склад', role: 'warehouse' },
    'logistics@watchflow.local': { password: 'LogisticsPass123!', name: 'Алина Логистика', role: 'logistics' },
    'marketing@watchflow.local': { password: 'MarketingPass123!', name: 'Анна Маркетинг', role: 'marketing' },
  };

  const user = demoUsers[normalizedEmail];

  if (!user || password !== user.password) {
    return null;
  }

  return {
    id: `demo-${user.role}`,
    email: normalizedEmail,
    name: user.name,
    role: user.role,
    permissions: ['dashboard:read'],
  };
}

export async function getLoginUser(email: string, password: string): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!process.env.DATABASE_URL) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { role: { include: { permissions: { select: { key: true } } } }, employee: true },
  });

  if (!user || !isEmployeeAccountActive(user.employee) || !user.role) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    permissions: user.role.permissions.map(({ key }) => key),
  };
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: '7d' });
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload & SessionUser;

    if (
      typeof payload.id !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.role !== 'string'
    ) return null;

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      ...(Array.isArray(payload.permissions) && payload.permissions.every((permission) => typeof permission === 'string')
        ? { permissions: payload.permissions }
        : {}),
    };
  } catch {
    return null;
  }
}

export async function getCurrentUserFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const sessionUser = verifySessionToken(token);

  if (!sessionUser) {
    return null;
  }

  if (sessionUser.id.startsWith('demo-')) {
    return sessionUser;
  }

  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { role: { include: { permissions: { select: { key: true } } } }, employee: true },
    });

    if (!user || !isEmployeeAccountActive(user.employee) || !user.role) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      permissions: user.role.permissions.map(({ key }) => key),
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  };

  response.cookies.set(SESSION_COOKIE, token, cookieOptions);
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
}

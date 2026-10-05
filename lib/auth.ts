import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'watchflow_session';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export function isEmployeeAccountActive(employee?: { isActive: boolean } | null): boolean {
  return employee?.isActive === true;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'watchflow-dev-secret-change-me';

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
    'admin@watchflow.local': { password: 'admin123', name: 'Super Admin', role: 'admin' },
    'manager@watchflow.local': { password: 'manager123', name: 'Марина Соколова', role: 'manager' },
    'sales@watchflow.local': { password: 'sales123', name: 'Иван Петров', role: 'sales' },
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
  };
}

export async function getLoginUser(email: string, password: string): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const demoUser = authenticateDemoAdmin(normalizedEmail, password);
  if (demoUser) {
    return demoUser;
  }

  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true, employee: true },
    });

    if (!user || !isEmployeeAccountActive(user.employee) || !user.role) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    };
  } catch {
    return null;
  }
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & SessionUser;

    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: String(payload.role),
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
      include: { role: true, employee: true },
    });

    if (!user || !isEmployeeAccountActive(user.employee) || !user.role) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: Response, token: string): void {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  };

  if ('cookies' in response && typeof response.cookies?.set === 'function') {
    response.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return;
  }

  response.headers.set(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookieOptions.maxAge};${cookieOptions.secure ? ' Secure;' : ''}`,
  );
}

export function clearSessionCookie(response: Response): void {
  if ('cookies' in response && typeof response.cookies?.set === 'function') {
    response.cookies.set(SESSION_COOKIE, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
      secure: process.env.NODE_ENV === 'production',
    });
    return;
  }

  response.headers.set(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;${process.env.NODE_ENV === 'production' ? ' Secure;' : ''}`,
  );
}

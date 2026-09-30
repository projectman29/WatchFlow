import { cookies } from 'next/headers';
import jwt, { JwtPayload } from 'jsonwebtoken';

export const SESSION_COOKIE = 'watchflow_session';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'watchflow-dev-secret-change-me';

export function authenticateDemoAdmin(email: string, password: string): SessionUser | null {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === 'admin@watchflow.local' && password === 'admin123') {
    return {
      id: 'demo-admin',
      email: normalizedEmail,
      name: 'Super Admin',
      role: 'admin',
    };
  }

  return null;
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

  return verifySessionToken(token);
}

export function setSessionCookie(response: Response, token: string): void {
  response.headers.set(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60};`,
  );
}

export function clearSessionCookie(response: Response): void {
  response.headers.set(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;`,
  );
}

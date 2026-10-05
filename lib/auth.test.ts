import { describe, expect, it, vi } from 'vitest';
import { getCurrentUserFromCookies, parseLoginCredentials, setSessionCookie, signSession } from './auth';
import { NextResponse } from 'next/server';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (
      name === 'watchflow_session'
        ? {
            value: signSession({
              id: 'demo-admin',
              email: 'admin@watchflow.local',
              name: 'Super Admin',
              role: 'admin',
            }),
          }
        : undefined
    ),
  }),
}));

describe('login credentials parsing', () => {
  it('accepts a browser form payload and a JSON payload', () => {
    const jsonPayload = parseLoginCredentials({ email: 'admin@watchflow.local', password: 'admin123' });
    const formPayload = parseLoginCredentials(new URLSearchParams({ email: 'admin@watchflow.local', password: 'admin123' }));

    expect(jsonPayload).toEqual({ email: 'admin@watchflow.local', password: 'admin123' });
    expect(formPayload).toEqual({ email: 'admin@watchflow.local', password: 'admin123' });
  });

  it('writes a session cookie through the NextResponse cookie API so the browser persists it', () => {
    const response = NextResponse.redirect('http://localhost:3000/dashboard');

    setSessionCookie(response, 'test-session-token');

    expect(response.cookies.get('watchflow_session')?.value).toBe('test-session-token');
    expect(response.headers.get('set-cookie')).toContain('watchflow_session=');
  });

  it('keeps demo users authenticated even when the database is configured', async () => {
    process.env.DATABASE_URL = 'file:./dev.db';

    const user = await getCurrentUserFromCookies();

    expect(user).not.toBeNull();
    expect(user?.id).toBe('demo-admin');
    expect(user?.role).toBe('admin');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { getCurrentUserFromCookies, parseLoginCredentials, setSessionCookie, signSession, verifySessionToken } from './auth';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware';

process.env.JWT_SECRET = 'test-session-secret-which-is-longer-than-32-bytes';

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
    const jsonPayload = parseLoginCredentials({ email: 'user@example.com', password: 'not-a-real-password' });
    const formPayload = parseLoginCredentials(new URLSearchParams({ email: 'user@example.com', password: 'not-a-real-password' }));

    expect(jsonPayload).toEqual({ email: 'user@example.com', password: 'not-a-real-password' });
    expect(formPayload).toEqual({ email: 'user@example.com', password: 'not-a-real-password' });
  });

  it('writes a session cookie through the NextResponse cookie API so the browser persists it', () => {
    const response = NextResponse.redirect('http://localhost:3000/dashboard');

    setSessionCookie(response, 'test-session-token');

    expect(response.cookies.get('watchflow_session')?.value).toBe('test-session-token');
    expect(response.headers.get('set-cookie')).toContain('watchflow_session=');
  });

  it('does not authenticate demo identities when no database is configured', async () => {
    delete process.env.DATABASE_URL;

    const user = await getCurrentUserFromCookies();

    expect(user).toBeNull();
  });

  it('rejects session tokens when the JWT secret is not configured', () => {
    const token = signSession({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      role: 'sales',
    });
    delete process.env.JWT_SECRET;

    expect(verifySessionToken(token)).toBeNull();

    process.env.JWT_SECRET = 'test-session-secret-which-is-longer-than-32-bytes';
  });

  it('rejects a forged administrator token before passing dashboard middleware', async () => {
    const payload = btoa(JSON.stringify({ role: 'admin' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const response = await middleware(new NextRequest('http://localhost:3000/dashboard', {
      headers: { cookie: `watchflow_session=eyJhbGciOiJIUzI1NiJ9.${payload}.invalid` },
    }));

    expect(response.headers.get('location')).toContain('/login');
  });
});

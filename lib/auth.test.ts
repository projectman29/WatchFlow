import { describe, expect, it, vi } from 'vitest';
import { authenticateDemoAdmin, getCurrentUserFromCookies, parseLoginCredentials, setSessionCookie, signSession, verifySessionToken } from './auth';
import { readJsonResponseBody } from './http';
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

  it('parses empty and plain-text HTTP responses without crashing', async () => {
    const emptyResponse = new Response(null, { status: 200 });
    const invalidJsonResponse = new Response('Invalid credentials', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

    await expect(readJsonResponseBody(emptyResponse)).resolves.toEqual({});
    await expect(readJsonResponseBody(invalidJsonResponse)).resolves.toEqual({ error: 'Invalid credentials' });
  });

  it('accepts the demo identities with 12-character minimum passwords', () => {
    expect(authenticateDemoAdmin('admin@watchflow.local', 'AdminPass123!')).toMatchObject({ email: 'admin@watchflow.local', role: 'admin' });
    expect(authenticateDemoAdmin('manager@watchflow.local', 'ManagerPass123!')).toMatchObject({ email: 'manager@watchflow.local', role: 'manager' });
    expect(authenticateDemoAdmin('sales@watchflow.local', 'SalesPass123!')).toMatchObject({ email: 'sales@watchflow.local', role: 'sales' });
    expect(authenticateDemoAdmin('designer@watchflow.local', 'DesignerPass123!')).toMatchObject({ email: 'designer@watchflow.local', role: 'designer' });
  });

  it('accepts demo identities when no database is configured', async () => {
    delete process.env.DATABASE_URL;

    const user = await getCurrentUserFromCookies();

    expect(user).toMatchObject({
      id: 'demo-admin',
      email: 'admin@watchflow.local',
      role: 'admin',
    });
  });

  it('uses a safe local fallback secret for demo sessions when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;

    const token = signSession({
      id: 'demo-admin',
      email: 'admin@watchflow.local',
      name: 'Super Admin',
      role: 'admin',
    });

    expect(verifySessionToken(token)).toMatchObject({
      id: 'demo-admin',
      email: 'admin@watchflow.local',
      role: 'admin',
    });

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

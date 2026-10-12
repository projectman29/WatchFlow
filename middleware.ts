import { NextRequest, NextResponse } from 'next/server';
import { isSameOriginMutation } from './lib/csrf';

const PROTECTED_ROUTES: Array<[string, string]> = [
  ['/admin', 'admin'],
  ['/dashboard', 'dashboard'],
  ['/crm', 'crm'],
  ['/orders', 'orders'],
  ['/warehouse', 'warehouse'],
  ['/production', 'production'],
  ['/design', 'design'],
  ['/logistics', 'logistics'],
  ['/employees', 'employees'],
  ['/reports', 'reports'],
];

function decodeBase64Url(value: string): ArrayBuffer | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const buffer = new ArrayBuffer(decoded.length);
    new Uint8Array(buffer).set(Uint8Array.from(decoded, (character) => character.charCodeAt(0)));
    return buffer;
  } catch {
    return null;
  }
}

async function verifyJwtPayload(token: string): Promise<{ role: string } | null> {
  const secret = process.env.JWT_SECRET?.trim() || (process.env.NODE_ENV !== 'production' ? 'watchflow-local-development-secret-at-least-32-bytes' : '');
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const headerBytes = decodeBase64Url(parts[0]);
  const payloadBytes = decodeBase64Url(parts[1]);
  const signature = decodeBase64Url(parts[2]);
  if (!headerBytes || !payloadBytes || !signature) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(headerBytes)) as { alg?: string };
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { role?: unknown };
    if (header.alg !== 'HS256' || typeof payload.role !== 'string') return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    return isValid ? { role: payload.role } : null;
  } catch {
    return null;
  }
}

export function getProtectedSectionForPath(pathname: string): string | null {
  const normalized = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  for (const [prefix, section] of PROTECTED_ROUTES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return section;
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  const maxBodySize = request.nextUrl.pathname.includes('/design/tasks/') && request.nextUrl.pathname.endsWith('/files')
    ? 12 * 1024 * 1024
    : 1024 * 1024;
  if (contentLength > maxBodySize) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
  }

  if (request.method === 'POST' && request.nextUrl.pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    !isSameOriginMutation(
      request.method,
      request.nextUrl.origin,
      request.headers.get('origin'),
      request.headers.get('referer'),
    )
  ) {
    return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });
  }

  const token = request.cookies.get('watchflow_session')?.value;
  const pathname = request.nextUrl.pathname;
  const protectedSection = getProtectedSectionForPath(pathname);

  if (!protectedSection) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyJwtPayload(token);

  if (!payload?.role) return NextResponse.redirect(new URL('/login', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/crm/:path*',
    '/orders/:path*',
    '/warehouse/:path*',
    '/production/:path*',
    '/design/:path*',
    '/logistics/:path*',
    '/employees/:path*',
    '/reports/:path*',
  ],
};

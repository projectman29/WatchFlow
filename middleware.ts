import { NextRequest, NextResponse } from 'next/server';
import { canAccessSection } from './lib/access';

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

function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const decoded = atob(normalized);
    const text = decodeURIComponent(
      Array.from(decoded, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );

    return JSON.parse(text) as { role?: string };
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

export function middleware(request: NextRequest) {
  const token = request.cookies.get('watchflow_session')?.value;
  const pathname = request.nextUrl.pathname;
  const protectedSection = getProtectedSectionForPath(pathname);

  if (!protectedSection) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = decodeJwtPayload(token);

  if (!payload?.role || !canAccessSection(payload.role, protectedSection)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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

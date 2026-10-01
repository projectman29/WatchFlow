import { NextRequest, NextResponse } from 'next/server';
import { canAccessSection } from '@/lib/access';

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

export function middleware(request: NextRequest) {
  const token = request.cookies.get('watchflow_session')?.value;
  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isAdminRoute = pathname.startsWith('/admin');
  if (!token && (isDashboardRoute || isAdminRoute)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isAdminRoute) {
    const payload = decodeJwtPayload(token);

    if (!payload?.role || !canAccessSection(payload.role, 'admin')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (isDashboardRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};

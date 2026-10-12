import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateDemoAdmin, getLoginUser, parseLoginCredentials, setSessionCookie, signSession } from '@/lib/auth';
import { checkLoginRateLimit, clearLoginRateLimit } from '@/lib/login-rate-limit';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 8192) {
      return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
    }

    let rawBody: unknown = null;
    const contentType = request.headers.get('content-type') ?? '';
    const acceptHeader = request.headers.get('accept') ?? '';
    const isHtmlBrowserRequest =
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data') ||
      acceptHeader.includes('text/html');

    if (contentType.includes('application/json')) {
      const rawText = await request.text();
      if (rawText) {
        try {
          rawBody = JSON.parse(rawText);
        } catch {
          try {
            rawBody = new URLSearchParams(rawText);
          } catch {
            rawBody = null;
          }
        }
      }
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      rawBody = await request.formData();
    } else {
      const rawText = await request.text();
      if (rawText) {
        try {
          rawBody = JSON.parse(rawText);
        } catch {
          rawBody = new URLSearchParams(rawText);
        }
      }
    }

    const credentials = parseLoginCredentials(rawBody);
    const parsed = credentials ? loginSchema.safeParse(credentials) : null;

    const redirectOrigin = request.headers.get('origin') ?? new URL(request.url).origin;

    const errorRedirect = (key: string) => {
      if (!isHtmlBrowserRequest) {
        return NextResponse.json({ error: key === 'missing_credentials' ? 'Email and password are required.' : 'Invalid credentials' }, { status: key === 'missing_credentials' ? 400 : 401 });
      }

      const redirectUrl = new URL('/login', redirectOrigin);
      redirectUrl.searchParams.set('error', key);
      return NextResponse.redirect(redirectUrl, 303);
    };

    if (!parsed || !parsed.success) {
      return errorRedirect('missing_credentials');
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const rateLimit = await checkLoginRateLimit(request, normalizedEmail);
    if (!rateLimit.allowed) {
      const response = errorRedirect('rate_limited');
      response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return response;
    }

    const demoUser = authenticateDemoAdmin(normalizedEmail, password);
    if (demoUser) {
      await clearLoginRateLimit(request, normalizedEmail);

      if (isHtmlBrowserRequest) {
        const response = NextResponse.redirect(new URL('/dashboard', redirectOrigin), 303);
        setSessionCookie(response, signSession(demoUser));
        return response;
      }

      const response = NextResponse.json({ success: true, user: demoUser });
      setSessionCookie(response, signSession(demoUser));
      return response;
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    try {
      const user = await getLoginUser(normalizedEmail, password);

      if (!user) {
        return errorRedirect('invalid_credentials');
      }

      await clearLoginRateLimit(request, normalizedEmail);

      if (isHtmlBrowserRequest) {
        const response = NextResponse.redirect(new URL('/dashboard', redirectOrigin), 303);
        setSessionCookie(response, signSession(user));
        return response;
      }

      const response = NextResponse.json({
        success: true,
        user,
      });

      setSessionCookie(response, signSession(user));
      return response;
    } catch (loginError) {
      console.error('Login failed:', loginError);
      return NextResponse.json({ error: 'Unable to authenticate right now.' }, { status: 503 });
    }
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Unable to login right now.' }, { status: 503 });
  }
}

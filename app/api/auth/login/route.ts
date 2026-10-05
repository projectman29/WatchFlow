import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getLoginUser, parseLoginCredentials, setSessionCookie, signSession } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    let rawBody: unknown = null;
    const contentType = request.headers.get('content-type') ?? '';
    const acceptHeader = request.headers.get('accept') ?? '';
    const isHtmlBrowserRequest =
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data') ||
      acceptHeader.includes('text/html');

    if (contentType.includes('application/json')) {
      rawBody = await request.json();
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

    const errorRedirect = (key: string) => {
      if (!isHtmlBrowserRequest) {
        return NextResponse.json({ error: key === 'missing_credentials' ? 'Email and password are required.' : 'Invalid credentials' }, { status: key === 'missing_credentials' ? 400 : 401 });
      }

      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('error', key);
      return NextResponse.redirect(redirectUrl, 303);
    };

    if (!parsed || !parsed.success) {
      return errorRedirect('missing_credentials');
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const user = await getLoginUser(normalizedEmail, password);

      if (!user) {
        return errorRedirect('invalid_credentials');
      }

      if (isHtmlBrowserRequest) {
        const response = NextResponse.redirect(new URL('/dashboard', request.url), 303);
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
      return errorRedirect('invalid_credentials');
    }
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Unable to login right now.' }, { status: 500 });
  }
}

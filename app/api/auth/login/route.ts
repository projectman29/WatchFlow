import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateDemoAdmin, isEmployeeAccountActive, setSessionCookie, signSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const demoUser = authenticateDemoAdmin(normalizedEmail, password);
    if (demoUser) {
      const response = NextResponse.json({ success: true, user: demoUser });
      setSessionCookie(response, signSession(demoUser));
      return response;
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { role: true, employee: true },
      });

      if (!user || !isEmployeeAccountActive(user.employee) || !user.role) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role?.name ?? 'manager',
        },
      });

      setSessionCookie(response, signSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role?.name ?? 'manager',
      }));

      return response;
    } catch (dbError) {
      console.error('Database login failed:', dbError);
      return NextResponse.json({ error: 'Unable to verify credentials right now.' }, { status: 503 });
    }
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Unable to login right now.' }, { status: 500 });
  }
}

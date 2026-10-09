import { createHmac, randomUUID } from 'node:crypto';
import { getJwtSecret } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_KEY = 10;

function hashKey(value: string): string {
  return `auth_login_rate_${createHmac('sha256', getJwtSecret()).update(value).digest('hex')}`;
}

function clientAddress(request: Request): string | null {
  return request.headers.get('x-real-ip')?.trim() || null;
}

async function incrementBucket(key: string): Promise<{ attempts: number; expiresAt: Date }> {
  const expiresAt = Date.now() + WINDOW_MS;
  const rows = await prisma.$queryRaw<Array<{ value: string }>>`
    INSERT INTO "SystemSetting" ("id", "key", "value", "category", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${key}, ${`1:${expiresAt}`}, 'security', NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "value" = CASE
        WHEN split_part("SystemSetting"."value", ':', 2)::bigint <= ${Date.now()} THEN ${`1:${expiresAt}`}
        ELSE (split_part("SystemSetting"."value", ':', 1)::integer + 1)::text || ':' || split_part("SystemSetting"."value", ':', 2)
      END,
      "updatedAt" = NOW()
    RETURNING "value"
  `;
  const [attempts, expiration] = rows[0].value.split(':').map(Number);
  return { attempts, expiresAt: new Date(expiration) };
}

export async function checkLoginRateLimit(
  request: Request,
  email: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const address = clientAddress(request);
  const keys = [
    hashKey(`account:${email.toLowerCase()}`),
    ...(address ? [hashKey(`address:${address}`)] : []),
  ];
  const buckets = await Promise.all(keys.map(incrementBucket));

  await prisma.$executeRaw`
    DELETE FROM "SystemSetting"
    WHERE "category" = 'security'
      AND left("key", 16) = 'auth_login_rate_'
      AND split_part("value", ':', 2)::bigint < ${Date.now()}
  `;

  const deniedBucket = buckets
    .filter((bucket) => bucket.attempts > MAX_ATTEMPTS_PER_KEY)
    .sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime())[0];

  return deniedBucket
    ? {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((deniedBucket.expiresAt.getTime() - Date.now()) / 1000)),
      }
    : { allowed: true, retryAfterSeconds: 0 };
}

export async function clearLoginRateLimit(request: Request, email: string): Promise<void> {
  const address = clientAddress(request);
  const keys = [
    hashKey(`account:${email.toLowerCase()}`),
    ...(address ? [hashKey(`address:${address}`)] : []),
  ];
  await prisma.systemSetting.deleteMany({
    where: { key: { in: keys } },
  });
}

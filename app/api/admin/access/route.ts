import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeRole, PERMISSION_LABELS } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { createAuditEntry } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

const updateRolePermissionsSchema = z.object({
  role: z.string().trim().min(1).max(80),
  permissionKeys: z.array(z.string().min(1).max(100)).max(100).refine(
    (keys) => new Set(keys).size === keys.length,
    'Permission keys must be unique.',
  ),
});

async function requireAdmin() {
  const user = await getCurrentUserFromCookies();

  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (normalizeRole(user.role) !== 'admin') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        where: { name: { not: 'admin' } },
        include: { permissions: { select: { key: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.permission.findMany({ select: { key: true }, orderBy: { key: 'asc' } }),
    ]);

    return NextResponse.json({
      roles: roles.map((role) => ({
        name: role.name,
        label: role.label,
        permissionKeys: role.permissions.map(({ key }) => key),
      })),
      permissions: permissions.map(({ key }) => ({ key, label: PERMISSION_LABELS[key] ?? key })),
    });
  } catch (error) {
    console.error('Unable to load role permissions:', error);
    return NextResponse.json({ error: 'Unable to load access settings.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = updateRolePermissionsSchema.safeParse(body);
  if (!parsed.success || normalizeRole(parsed.data?.role) === 'admin') {
    return NextResponse.json({ error: 'Invalid role permissions.' }, { status: 400 });
  }

  try {
    const role = await prisma.role.findUnique({
      where: { name: parsed.data.role },
      include: { permissions: { select: { key: true } } },
    });
    if (!role) return NextResponse.json({ error: 'Role not found.' }, { status: 404 });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: parsed.data.permissionKeys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== parsed.data.permissionKeys.length) {
      return NextResponse.json({ error: 'Unknown permission key.' }, { status: 400 });
    }

    const previousKeys = role.permissions.map(({ key }) => key).sort();
    const nextKeys = permissions.map(({ key }) => key).sort();

    await prisma.$transaction(async (transaction) => {
      await transaction.role.update({
        where: { id: role.id },
        data: { permissions: { set: permissions.map(({ id }) => ({ id })) } },
      });
      await createAuditEntry(transaction, {
        userId: auth.user.id,
        actor: auth.user.name,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entity: 'Role',
        entityId: role.id,
        details: {
          role: role.name,
          old: { permissions: previousKeys },
          new: { permissions: nextKeys },
        },
      });
    });

    return NextResponse.json({ success: true, role: role.name, permissionKeys: nextKeys });
  } catch (error) {
    console.error('Unable to update role permissions:', error);
    return NextResponse.json({ error: 'Unable to save access settings.' }, { status: 500 });
  }
}

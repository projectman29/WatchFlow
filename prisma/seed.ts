import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSION_KEYS = [
  'dashboard:read',
  'crm:read',
  'crm:write',
  'orders:read',
  'orders:write',
  'warehouse:read',
  'warehouse:write',
  'marketing:read',
  'marketing:write',
  'design:read',
  'design:write',
  'production:read',
  'production:write',
  'logistics:read',
  'logistics:write',
  'reports:read',
  'users:read',
  'users:write',
  'leads:read',
  'leads:write',
];

const ROLE_CONFIG = [
  { name: 'admin', label: 'Admin' },
  { name: 'manager', label: 'Manager' },
  { name: 'sales', label: 'Sales' },
  { name: 'designer', label: 'Designer' },
  { name: 'master', label: 'Master' },
  { name: 'warehouse', label: 'Warehouse' },
  { name: 'logistics', label: 'Logistics' },
  { name: 'marketing', label: 'Marketing' },
];

async function main() {
  for (const permission of PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key: permission },
      update: { label: permission },
      create: { key: permission, label: permission },
    });
  }

  for (const role of ROLE_CONFIG) {
    const permissionKeys =
      role.name === 'admin'
        ? PERMISSION_KEYS
        : role.name === 'manager'
          ? ['dashboard:read', 'crm:read', 'crm:write', 'leads:read', 'leads:write', 'orders:read', 'orders:write', 'reports:read']
          : role.name === 'sales'
            ? ['dashboard:read', 'crm:read', 'crm:write', 'leads:read', 'leads:write', 'orders:read', 'orders:write']
            : role.name === 'designer'
              ? ['dashboard:read', 'design:read', 'design:write']
              : role.name === 'master'
                ? ['dashboard:read', 'production:read', 'production:write']
                : role.name === 'warehouse'
                  ? ['dashboard:read', 'warehouse:read', 'warehouse:write']
                  : role.name === 'logistics'
                    ? ['dashboard:read', 'logistics:read', 'logistics:write', 'orders:read']
                    : ['dashboard:read', 'marketing:read', 'marketing:write'];

    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        label: role.label,
        permissions: {
          set: [],
          connect: permissionKeys.map((key) => ({ key })),
        },
      },
      create: {
        name: role.name,
        label: role.label,
        permissions: {
          connect: permissionKeys.map((key) => ({ key })),
        },
      },
    });
  }

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  if (!adminRole) {
    throw new Error('Admin role was not created.');
  }

  const passwordHash = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@watchflow.local' },
    update: {
      name: 'Super Admin',
      passwordHash,
      roleId: adminRole.id,
    },
    create: {
      email: 'admin@watchflow.local',
      name: 'Super Admin',
      passwordHash,
      roleId: adminRole.id,
    },
    include: { role: true },
  });

  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {
      fullName: 'Super Admin',
      position: 'Owner',
      department: 'Administration',
      phone: '+7 700 000 00 00',
      isActive: true,
    },
    create: {
      userId: adminUser.id,
      fullName: 'Super Admin',
      position: 'Owner',
      department: 'Administration',
      phone: '+7 700 000 00 00',
      isActive: true,
    },
  });

  await prisma.client.upsert({
    where: { id: 'seed-client-1' },
    update: {},
    create: {
      id: 'seed-client-1',
      name: 'Sample Client',
      email: 'client@example.com',
      company: 'Watch Co',
      source: 'Instagram',
      status: 'NEW',
      notes: 'Seed client for demo data',
    },
  });

  await prisma.lead.upsert({
    where: { id: 'seed-lead-1' },
    update: {},
    create: {
      id: 'seed-lead-1',
      title: 'Custom watch order',
      source: 'Instagram',
      status: 'CONTACTED',
      value: 2450,
      clientId: 'seed-client-1',
    },
  });

  await prisma.order.upsert({
    where: { number: 'WF-1000' },
    update: {},
    create: {
      number: 'WF-1000',
      status: 'NEW',
      total: 2450,
      discount: 0,
      deposit: 500,
      paymentStatus: 'PARTIAL',
      clientId: 'seed-client-1',
      leadId: 'seed-lead-1',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { sku: 'CASE-01' },
    update: {},
    create: {
      sku: 'CASE-01',
      name: 'Steel case',
      stock: 12,
      reorderLevel: 5,
      unitPrice: 160,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

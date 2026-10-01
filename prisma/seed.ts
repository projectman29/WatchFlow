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
            ? ['dashboard:read', 'leads:read', 'leads:write', 'orders:read', 'orders:write']
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

  const legacyDesignRole = await prisma.role.findUnique({ where: { name: 'design' } });
  const designerRole = await prisma.role.findUnique({ where: { name: 'designer' } });

  if (legacyDesignRole && designerRole) {
    await prisma.user.updateMany({
      where: { roleId: legacyDesignRole.id },
      data: { roleId: designerRole.id },
    });
    await prisma.role.delete({ where: { id: legacyDesignRole.id } });
  }

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  const managerRole = await prisma.role.findUnique({ where: { name: 'manager' } });
  const salesRole = await prisma.role.findUnique({ where: { name: 'sales' } });

  if (!adminRole || !managerRole || !salesRole) {
    throw new Error('Core roles were not created.');
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

  const salesManagerUser = await prisma.user.upsert({
    where: { email: 'manager@watchflow.local' },
    update: {
      name: 'Марина Соколова',
      passwordHash: await bcrypt.hash('manager123', 10),
      roleId: managerRole.id,
    },
    create: {
      email: 'manager@watchflow.local',
      name: 'Марина Соколова',
      passwordHash: await bcrypt.hash('manager123', 10),
      roleId: managerRole.id,
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@watchflow.local' },
    update: {
      name: 'Иван Петров',
      passwordHash: await bcrypt.hash('sales123', 10),
      roleId: salesRole.id,
    },
    create: {
      email: 'sales@watchflow.local',
      name: 'Иван Петров',
      passwordHash: await bcrypt.hash('sales123', 10),
      roleId: salesRole.id,
    },
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

  const managerEmployee = await prisma.employee.upsert({
    where: { userId: salesManagerUser.id },
    update: {
      fullName: 'Марина Соколова',
      position: 'РОП',
      department: 'Sales',
      phone: '+7 701 111 22 33',
      isActive: true,
      managerId: null,
    },
    create: {
      userId: salesManagerUser.id,
      fullName: 'Марина Соколова',
      position: 'РОП',
      department: 'Sales',
      phone: '+7 701 111 22 33',
      isActive: true,
      managerId: null,
    },
  });

  const salesEmployee = await prisma.employee.upsert({
    where: { userId: salesUser.id },
    update: {
      fullName: 'Иван Петров',
      position: 'Менеджер по продажам',
      department: 'Sales',
      phone: '+7 702 333 44 55',
      isActive: true,
      managerId: managerEmployee.id,
    },
    create: {
      userId: salesUser.id,
      fullName: 'Иван Петров',
      position: 'Менеджер по продажам',
      department: 'Sales',
      phone: '+7 702 333 44 55',
      isActive: true,
      managerId: managerEmployee.id,
    },
  });

  const client1 = await prisma.client.upsert({
    where: { id: 'seed-client-1' },
    update: {
      name: 'Анна Смирнова',
      email: 'anna@example.com',
      phone: '+7 700 111 22 33',
      instagram: '@anna_watch',
      city: 'Алматы',
      company: '',
      source: 'Instagram',
      status: 'NEW',
      notes: 'Клиент из Instagram',
    },
    create: {
      id: 'seed-client-1',
      name: 'Анна Смирнова',
      email: 'anna@example.com',
      phone: '+7 700 111 22 33',
      instagram: '@anna_watch',
      city: 'Алматы',
      source: 'Instagram',
      status: 'NEW',
      notes: 'Клиент из Instagram',
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: 'seed-client-2' },
    update: {
      name: 'Илья Кузнецов',
      email: 'ilya@example.com',
      phone: '+7 707 222 33 44',
      city: 'Нур-Султан',
      source: 'Meta Ads',
      status: 'CONTACTED',
      notes: 'Проверка дизайна',
    },
    create: {
      id: 'seed-client-2',
      name: 'Илья Кузнецов',
      email: 'ilya@example.com',
      phone: '+7 707 222 33 44',
      city: 'Нур-Султан',
      source: 'Meta Ads',
      status: 'CONTACTED',
      notes: 'Проверка дизайна',
    },
  });

  const client3 = await prisma.client.upsert({
    where: { id: 'seed-client-3' },
    update: {
      name: 'Мария Васильева',
      email: 'maria@example.com',
      phone: '+7 708 333 44 55',
      city: 'Астана',
      source: 'Рекомендации',
      status: 'WON',
      notes: 'Клиент оплатил заказ',
    },
    create: {
      id: 'seed-client-3',
      name: 'Мария Васильева',
      email: 'maria@example.com',
      phone: '+7 708 333 44 55',
      city: 'Астана',
      source: 'Рекомендации',
      status: 'WON',
      notes: 'Клиент оплатил заказ',
    },
  });

  await prisma.lead.upsert({
    where: { id: 'seed-lead-1' },
    update: {
      title: 'Заказ на часы',
      source: 'Instagram',
      status: 'NEW',
      value: 1200,
      clientId: client1.id,
      managerId: salesEmployee.id,
      notes: 'Новая заявка',
    },
    create: {
      id: 'seed-lead-1',
      title: 'Заказ на часы',
      source: 'Instagram',
      status: 'NEW',
      value: 1200,
      clientId: client1.id,
      managerId: salesEmployee.id,
      notes: 'Новая заявка',
    },
  });

  const lead2 = await prisma.lead.upsert({
    where: { id: 'seed-lead-2' },
    update: {
      title: 'Проверка по дизайну',
      source: 'Meta Ads',
      status: 'INTERESTED',
      value: 1900,
      clientId: client2.id,
      managerId: managerEmployee.id,
      notes: 'Клиент заинтересован',
    },
    create: {
      id: 'seed-lead-2',
      title: 'Проверка по дизайну',
      source: 'Meta Ads',
      status: 'INTERESTED',
      value: 1900,
      clientId: client2.id,
      managerId: managerEmployee.id,
      notes: 'Клиент заинтересован',
    },
  });

  const lead3 = await prisma.lead.upsert({
    where: { id: 'seed-lead-3' },
    update: {
      title: 'Готов к оплате',
      source: 'Рекомендации',
      status: 'WON',
      value: 4200,
      clientId: client3.id,
      managerId: salesEmployee.id,
      notes: 'Активный заказ',
    },
    create: {
      id: 'seed-lead-3',
      title: 'Готов к оплате',
      source: 'Рекомендации',
      status: 'WON',
      value: 4200,
      clientId: client3.id,
      managerId: salesEmployee.id,
      notes: 'Активный заказ',
    },
  });

  const order1 = await prisma.order.upsert({
    where: { number: 'WF-1001' },
    update: {
      status: 'IN_PRODUCTION',
      total: 4200,
      deposit: 2100,
      paymentStatus: 'PARTIAL',
      clientId: client3.id,
      leadId: lead3.id,
      managerId: salesEmployee.id,
    },
    create: {
      number: 'WF-1001',
      status: 'IN_PRODUCTION',
      total: 4200,
      discount: 0,
      deposit: 2100,
      paymentStatus: 'PARTIAL',
      clientId: client3.id,
      leadId: lead3.id,
      managerId: salesEmployee.id,
    },
  });

  await prisma.order.upsert({
    where: { number: 'WF-1002' },
    update: {
      status: 'DESIGN_APPROVED',
      total: 5600,
      deposit: 5600,
      paymentStatus: 'PAID',
      clientId: client2.id,
      leadId: lead2.id,
      managerId: managerEmployee.id,
    },
    create: {
      number: 'WF-1002',
      status: 'DESIGN_APPROVED',
      total: 5600,
      discount: 0,
      deposit: 5600,
      paymentStatus: 'PAID',
      clientId: client2.id,
      leadId: lead2.id,
      managerId: managerEmployee.id,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: 'seed-order-item-1' },
    update: {},
    create: {
      id: 'seed-order-item-1',
      orderId: order1.id,
      productName: 'Classic Steel 42mm',
      quantity: 1,
      unitPrice: 4200,
      model: 'Classic Steel',
      color: 'Черный',
      strap: 'Кожаный',
      engraving: 'M.V. / 2026',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { sku: 'CASE-01' },
    update: {
      name: 'Steel case',
      stock: 12,
      reorderLevel: 5,
      unitPrice: 160,
    },
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

import type { Prisma } from '@prisma/client';

type NotificationTransaction = Prisma.TransactionClient;

type CreateNotificationsInput = {
  userIds?: string[];
  roles?: string[];
  type: string;
  title: string;
  message: string;
  href?: string;
};

export async function createNotifications(
  transaction: NotificationTransaction,
  input: CreateNotificationsInput,
): Promise<void> {
  const recipients = new Set(input.userIds ?? []);
  const roleNames = input.roles ?? [];

  if (roleNames.length > 0) {
    const employees = await transaction.employee.findMany({
      where: {
        isActive: true,
        user: { role: { name: { in: roleNames } } },
      },
      select: { userId: true },
    });
    employees.forEach(({ userId }) => recipients.add(userId));
  }

  if (recipients.size === 0) return;

  await transaction.notification.createMany({
    data: [...recipients].map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      href: input.href,
    })),
  });
}

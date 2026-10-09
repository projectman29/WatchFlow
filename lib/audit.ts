import type { Prisma } from '@prisma/client';

type AuditTransaction = Prisma.TransactionClient;

type AuditEntry = {
  userId?: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
};

export async function createAuditEntry(
  transaction: AuditTransaction,
  entry: AuditEntry,
): Promise<void> {
  await transaction.activityLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: JSON.stringify({ ...entry.details, actor: entry.actor }),
    },
  });
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Заказ создан',
  ORDER_UPDATED: 'Изменён заказ',
  STATUS_CHANGED: 'Изменён статус заказа',
  DESIGN_TASK_CREATED: 'Создана задача дизайна',
  DESIGNER_ASSIGNED: 'Назначен дизайнер',
  DESIGN_STARTED: 'Начата работа над дизайном',
  DESIGN_FILE_UPLOADED: 'Загружен макет',
  DESIGN_APPROVED: 'Дизайн подтверждён',
  DESIGN_REVISION_REQUESTED: 'Запрошены правки',
  EMPLOYEE_CREATED: 'Создан сотрудник',
  EMPLOYEE_UPDATED: 'Изменён сотрудник',
  EMPLOYEE_BLOCKED: 'Сотрудник заблокирован',
  EMPLOYEE_UNBLOCKED: 'Сотрудник разблокирован',
  ROLE_CHANGED: 'Изменена роль',
  ROLE_PERMISSIONS_UPDATED: 'Изменены права роли',
  LEAD_STATUS_CHANGED: 'Изменён статус лида',
  LEAD_UPDATED: 'Изменён лид',
};

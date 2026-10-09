import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { canTransitionDesignTask, DESIGN_FILE_TYPES, getSafeDesignFileName, hasValidDesignFileSignature } from '@/lib/design';
import { createNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function respond(request: NextRequest, key: string, message: string, status: number) {
  const isBrowserForm = request.headers.get('content-type')?.includes('multipart/form-data') ||
    request.headers.get('accept')?.includes('text/html');
  if (!isBrowserForm) return NextResponse.json({ error: message }, { status });

  const url = new URL('/design', request.url);
  url.searchParams.set('error', key);
  return NextResponse.redirect(url, 303);
}

function actorId(userId: string): string | undefined {
  return userId.startsWith('demo-') ? undefined : userId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromCookies();
  if (!user) return respond(request, 'unauthorized', 'Войдите в систему.', 401);
  if (!hasPermission(user, 'design:write')) {
    return respond(request, 'forbidden', 'Недостаточно прав для загрузки макета.', 403);
  }

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_SIZE) {
    return respond(request, 'invalid_file', 'Выберите непустой файл размером не более 10 МБ.', 400);
  }

  const fileType = DESIGN_FILE_TYPES[file.type as keyof typeof DESIGN_FILE_TYPES];
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!fileType || !hasValidDesignFileSignature(file.type, bytes)) {
    return respond(request, 'unsupported_file', 'Поддерживаются только настоящие JPG, PNG и PDF файлы.', 400);
  }

  const employee = await prisma.employee.findFirst({
    where: { user: { email: user.email } },
    select: { id: true },
  });
  const task = await prisma.designTask.findUnique({
    where: { id },
    include: { order: { select: { id: true, number: true, status: true, manager: { select: { userId: true } } } } },
  });
  if (!task) return respond(request, 'task_not_found', 'Задача дизайна не найдена.', 404);
  const canManage = hasPermission(user, 'orders:write');
  if (!canManage && task.assignedDesignerId !== employee?.id) {
    return respond(request, 'forbidden', 'Макет может загрузить только назначенный дизайнер.', 403);
  }
  if (!canTransitionDesignTask(task.status, 'upload')) {
    return respond(request, 'invalid_transition', 'Начните работу или откройте задачу на доработку перед загрузкой.', 400);
  }

  const safeName = getSafeDesignFileName(file.name);
  const storageKey = `${randomUUID()}${fileType.extension}`;
  const uploadDirectory = path.resolve(/*turbopackIgnore: true*/ process.env.DESIGN_UPLOAD_DIR || path.join(process.cwd(), 'var', 'design-files'));
  const storagePath = path.join(/*turbopackIgnore: true*/ uploadDirectory, storageKey);

  try {
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(storagePath, bytes, { flag: 'wx' });

    await prisma.$transaction(async (transaction) => {
      const latestFile = await transaction.designFile.findFirst({
        where: { taskId: task.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (latestFile?.version ?? 0) + 1;

      await transaction.designFile.create({
        data: {
          taskId: task.id,
          fileName: safeName,
          storageKey,
          mimeType: file.type,
          size: bytes.byteLength,
          version,
          uploadedById: actorId(user.id),
        },
      });
      await transaction.designTask.update({
        where: { id: task.id },
        data: { status: 'READY_FOR_REVIEW' },
      });
      await transaction.order.update({
        where: { id: task.order.id },
        data: { status: 'WAITING_CLIENT_APPROVAL' },
      });
      await transaction.activityLog.create({
        data: {
          userId: actorId(user.id),
          action: 'DESIGN_FILE_UPLOADED',
          entity: 'Order',
          entityId: task.order.id,
          details: JSON.stringify({
            actor: user.name,
            taskId: task.id,
            old: { designStatus: task.status, orderStatus: task.order.status },
            new: {
              designStatus: 'READY_FOR_REVIEW',
              orderStatus: 'WAITING_CLIENT_APPROVAL',
              fileName: safeName,
              version,
            },
          }),
        },
      });
      await createNotifications(transaction, {
        userIds: task.order.manager ? [task.order.manager.userId] : [],
        roles: task.order.manager ? [] : ['manager', 'admin'],
        type: 'DESIGN_READY',
        title: 'Дизайн готов к согласованию',
        message: `По заказу ${task.order.number} загружен макет v${version}.`,
        href: `/orders/${task.order.id}`,
      });
    });
  } catch (error) {
    try {
      await unlink(storagePath);
    } catch (cleanupError) {
      if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to clean up design upload after database error:', cleanupError);
      }
    }
    console.error('Design file upload failed:', error);
    return respond(request, 'upload_failed', 'Не удалось сохранить макет. Попробуйте ещё раз.', 500);
  }

  if (request.headers.get('accept')?.includes('text/html')) {
    const url = new URL('/design', request.url);
    url.searchParams.set('success', 'uploaded');
    return NextResponse.redirect(url, 303);
  }
  return NextResponse.json({ success: true }, { status: 201 });
}

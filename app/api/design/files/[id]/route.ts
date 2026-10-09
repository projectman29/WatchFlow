import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessSection, hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getRecordScope } from '@/lib/db-data';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromCookies();
  if (!user || (!canAccessSection(user, 'design') && !hasPermission(user, 'orders:read'))) {
    return NextResponse.json({ error: 'Доступ запрещён.' }, { status: 403 });
  }

  const { id } = await params;
  const file = await prisma.designFile.findUnique({
    where: { id },
    include: {
      task: {
        include: { order: { select: { id: true, managerId: true } } },
      },
    },
  });
  if (!file) return NextResponse.json({ error: 'Файл не найден.' }, { status: 404 });

  const employee = await prisma.employee.findFirst({
    where: { user: { email: user.email } },
    select: { id: true },
  });
  const canManage = hasPermission(user, 'orders:read');
  if (!canManage && file.task.assignedDesignerId !== employee?.id) {
    return NextResponse.json({ error: 'Доступ запрещён.' }, { status: 403 });
  }
  if (canManage) {
    const scope = await getRecordScope(user);
    if (scope) {
      const order = await prisma.order.findFirst({
        where: { id: file.task.order.id, ...scope },
        select: { id: true },
      });
      if (!order) return NextResponse.json({ error: 'Доступ запрещён.' }, { status: 403 });
    }
  }

  const uploadDirectory = path.resolve(/*turbopackIgnore: true*/ process.env.DESIGN_UPLOAD_DIR || path.join(process.cwd(), 'var', 'design-files'));
  const filePath = path.resolve(uploadDirectory, file.storageKey);
  if (path.dirname(filePath) !== uploadDirectory) {
    return NextResponse.json({ error: 'Некорректное хранилище файла.' }, { status: 500 });
  }

  try {
    const contents = await readFile(/*turbopackIgnore: true*/ filePath);
    return new NextResponse(new Uint8Array(contents), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.size),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Design file read failed:', error);
    return NextResponse.json({ error: 'Файл не найден в хранилище.' }, { status: 404 });
  }
}

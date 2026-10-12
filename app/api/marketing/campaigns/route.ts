import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.enum(['Instagram', 'Google', 'TikTok', 'Email', 'Referral', 'Other']),
  budget: z.coerce.number().finite().min(0).max(10_000_000),
  goal: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Требуется войти в систему.' }, { status: 401 });
  if (!hasPermission(user.role, 'marketing:write')) {
    return NextResponse.json({ error: 'Недостаточно прав для управления кампаниями.' }, { status: 403 });
  }

  const formData = await request.formData();
  const action = String(formData.get('_action') ?? 'create');

  try {
    if (action === 'toggle') {
      const campaignId = String(formData.get('campaignId') ?? '').trim();
      const campaign = await prisma.systemSetting.findFirst({ where: { id: campaignId, category: 'marketing-campaign' } });
      if (!campaign) return NextResponse.json({ error: 'Кампания не найдена.' }, { status: 404 });

      const data = JSON.parse(campaign.value) as { status?: string };
      data.status = data.status === 'active' ? 'paused' : 'active';
      await prisma.systemSetting.update({ where: { id: campaign.id }, data: { value: JSON.stringify(data) } });
    } else if (action === 'create') {
      const parsed = campaignSchema.safeParse({
        name: formData.get('name'),
        channel: formData.get('channel'),
        budget: formData.get('budget'),
        goal: formData.get('goal') ?? '',
      });
      if (!parsed.success) return NextResponse.json({ error: 'Проверьте название, канал и бюджет кампании.' }, { status: 400 });

      const campaign = parsed.data;
      const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await prisma.systemSetting.create({
        data: {
          key: campaignId,
          category: 'marketing-campaign',
          value: JSON.stringify({ ...campaign, status: 'active', createdBy: user.email }),
        },
      });
    } else {
      return NextResponse.json({ error: 'Неизвестное действие.' }, { status: 400 });
    }

    const url = new URL('/marketing', request.url);
    url.searchParams.set('updated', '1');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error('Marketing campaign update failed:', error);
    return NextResponse.json({ error: 'Не удалось сохранить кампанию. Убедитесь, что база данных доступна.' }, { status: 500 });
  }
}

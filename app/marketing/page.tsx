import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canAccessSection } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Campaign = { id: string; name: string; channel: string; budget: number; goal: string; status: 'active' | 'paused' };

export default async function MarketingPage({
  searchParams,
}: {
  searchParams?: { updated?: string } | Promise<{ updated?: string }>;
}) {
  const user = await getCurrentUserFromCookies();
  if (!user) redirect('/login');
  if (!canAccessSection(user.role, 'marketing')) redirect('/dashboard');

  let campaigns: Campaign[] = [];
  let leadSources: Array<{ source: string; count: number; won: number; value: number }> = [];
  let databaseAvailable = false;
  try {
    const [settings, leads] = await Promise.all([
      prisma.systemSetting.findMany({ where: { category: 'marketing-campaign' }, orderBy: { updatedAt: 'desc' } }),
      prisma.lead.findMany({ select: { source: true, status: true, value: true } }),
    ]);
    campaigns = settings.map((setting) => {
      const data = JSON.parse(setting.value) as Partial<Campaign>;
      return {
        id: setting.id,
        name: data.name ?? 'Кампания',
        channel: data.channel ?? 'Other',
        budget: Number(data.budget ?? 0),
        goal: data.goal ?? '',
        status: data.status === 'paused' ? 'paused' : 'active',
      };
    });
    const grouped = new Map<string, { source: string; count: number; won: number; value: number }>();
    for (const lead of leads) {
      const source = lead.source ?? 'Не указан';
      const row = grouped.get(source) ?? { source, count: 0, won: 0, value: 0 };
      row.count += 1;
      if (lead.status === 'WON') row.won += 1;
      row.value += Number(lead.value ?? 0);
      grouped.set(source, row);
    }
    leadSources = [...grouped.values()].sort((a, b) => b.count - a.count);
    databaseAvailable = true;
  } catch (error) {
    console.error('Unable to load marketing data:', error);
  }

  const params = searchParams ? await searchParams : {};
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
  const plannedBudget = campaigns.filter((campaign) => campaign.status === 'active').reduce((sum, campaign) => sum + campaign.budget, 0);
  const totalLeads = leadSources.reduce((sum, source) => sum + source.count, 0);
  const wonLeads = leadSources.reduce((sum, source) => sum + source.won, 0);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Marketing</p><h1 className="mt-2 text-3xl font-bold">Кампании и источники лидов</h1></div>
          <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">Dashboard</Link>
        </header>

        {params.updated ? <p className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Кампания сохранена.</p> : null}
        {!databaseAvailable ? <p className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Не удалось подключиться к базе: кампании и аналитика сейчас недоступны.</p> : null}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Кампании активны" value={activeCampaigns} accent="text-cyan-300" />
          <MetricCard label="Бюджет активных" value={plannedBudget} accent="text-violet-300" suffix=" €" />
          <MetricCard label="Всего лидов" value={totalLeads} accent="text-amber-300" />
          <MetricCard label="Оплачено / выиграно" value={wonLeads} accent="text-emerald-300" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Новая кампания</h2>
            <form className="mt-5 space-y-4" action="/api/marketing/campaigns" method="POST">
              <input type="hidden" name="_action" value="create" />
              <label className="block text-sm text-slate-300">Название<input name="name" required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Осенняя коллекция" /></label>
              <label className="block text-sm text-slate-300">Канал<select name="channel" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"><option>Instagram</option><option>Google</option><option>TikTok</option><option>Email</option><option>Referral</option><option>Other</option></select></label>
              <label className="block text-sm text-slate-300">Бюджет, €<input name="budget" type="number" min="0" max="10000000" step="0.01" required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="500" /></label>
              <label className="block text-sm text-slate-300">Цель / заметка<input name="goal" maxLength={300} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" placeholder="Привлечь заявки на новую модель" /></label>
              <button disabled={!databaseAvailable} type="submit" className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">Создать кампанию</button>
            </form>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Кампании</h2>
              <div className="mt-4 space-y-3">{campaigns.length ? campaigns.map((campaign) => <article key={campaign.id} className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">{campaign.name}</p><p className="mt-1 text-sm text-slate-400">{campaign.channel} · бюджет €{campaign.budget.toLocaleString('ru-RU')}{campaign.goal ? ` · ${campaign.goal}` : ''}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs ${campaign.status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{campaign.status === 'active' ? 'Активна' : 'Приостановлена'}</span><form action="/api/marketing/campaigns" method="POST"><input type="hidden" name="_action" value="toggle" /><input type="hidden" name="campaignId" value={campaign.id} /><button type="submit" className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200">{campaign.status === 'active' ? 'Приостановить' : 'Запустить'}</button></form></div></article>) : <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">Кампаний пока нет.</p>}</div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Эффективность источников лидов</h2>
              <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="py-2 pr-4">Источник</th><th className="py-2 pr-4">Лиды</th><th className="py-2 pr-4">Выиграно</th><th className="py-2">Сумма, €</th></tr></thead><tbody>{leadSources.map((source) => <tr key={source.source} className="border-t border-slate-800"><td className="py-3 pr-4">{source.source}</td><td className="py-3 pr-4">{source.count}</td><td className="py-3 pr-4 text-emerald-300">{source.won}</td><td className="py-3">{source.value.toLocaleString('ru-RU')}</td></tr>)}{leadSources.length === 0 ? <tr><td colSpan={4} className="py-4 text-slate-400">Данные появятся после регистрации лидов.</td></tr> : null}</tbody></table></div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, accent, suffix = '' }: { label: string; value: number; accent: string; suffix?: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm uppercase tracking-[0.15em] text-slate-400">{label}</p><p className={`mt-3 text-3xl font-bold ${accent}`}>{value.toLocaleString('ru-RU')}{suffix}</p></div>;
}

import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';

export default async function PolicyWikiPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const articles = db
    .prepare(
      `SELECT w.*, b.name_en as bank_name
       FROM wiki_articles w
       LEFT JOIN banks b ON b.id = w.bank_id
       ORDER BY w.id DESC`,
    )
    .all() as Record<string, unknown>[];

  const banks = db.prepare('SELECT id, name_en FROM banks ORDER BY id ASC').all() as { id: number; name_en: string }[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <PageHeader app="Knowledge" appHref="/os/wiki" title="Wiki & Templates" sub={tr(lang, 'Versioned Underwriting SOPs, Clause References & Client Templates', 'أدلة السياسات الائتمانية الموثقة وقوالب التواصل الثنائية')} />

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          {articles.map((a) => (
            <div key={String(a.id)} className="bw-card p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="bw-badge bg-amber-100 text-[#7d5f1f]">{String(a.category)}</span>
                <span className="font-num text-slate-500">
                  {a.bank_name ? `${String(a.bank_name)} · ` : ''}
                  {String(a.clause_ref)} ({String(a.policy_version)})
                </span>
              </div>
              <h2 className="font-display font-bold text-base text-[#021125]">
                {lang === 'ar' && a.title_ar ? String(a.title_ar) : String(a.title_en)}
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed">
                {lang === 'ar' && a.body_ar ? String(a.body_ar) : String(a.body_en)}
              </p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-5 bw-card p-5 space-y-3 text-xs h-fit">
          <h2 className="font-display font-bold text-base text-[#021125]">Publish New Bank Policy Circular</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-2.5">
            <input type="hidden" name="action" value="create_wiki_article" />
            <input type="hidden" name="returnTo" value="/os/wiki" />
            <input name="titleEn" required placeholder="Policy Title (English)" className="bw-input" />
            <input name="titleAr" placeholder="عنوان السياسة (عربي)" dir="rtl" className="bw-input" />
            <div className="grid grid-cols-2 gap-2">
              <select name="bankId" className="bw-input">
                <option value="">General CBUAE / DLD Rule</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name_en}</option>
                ))}
              </select>
              <input name="clauseRef" defaultValue="Credit-Circular-2026" placeholder="Clause Ref" className="bw-input font-num" />
            </div>
            <textarea name="bodyEn" required rows={3} placeholder="Exact bank policy rule & haircut calculation..." className="bw-input" />
            <textarea name="bodyAr" rows={2} dir="rtl" placeholder="النص العربي للسياسة..." className="bw-input" />
            <button type="submit" className="bw-btn-gold w-full">Publish to Wiki & Co-Pilot Index</button>
          </form>
        </div>
      </div>
    </div>
  );
}

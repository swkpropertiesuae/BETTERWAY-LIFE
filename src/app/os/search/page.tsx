import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaffUser();
  const q = ((await searchParams).q || '').trim();
  const db = getDb();
  const like = `%${q}%`;
  const run = (sql: string) => (q ? (db.prepare(sql).all(like, like, like) as Record<string, string | number>[]) : []);
  const deals = run(`SELECT d.id, d.deal_ref, d.stage, a.full_name_en n FROM deals d LEFT JOIN applicants a ON a.household_id=d.household_id WHERE d.deal_ref LIKE ? OR a.full_name_en LIKE ? OR a.emirates_id LIKE ? GROUP BY d.id LIMIT 20`);
  const leads = run(`SELECT id, contact_name n, contact_phone p, stage FROM leads WHERE contact_name LIKE ? OR contact_phone LIKE ? OR contact_email LIKE ? LIMIT 20`);
  const banks = run(`SELECT id, name_en n FROM banks WHERE name_en LIKE ? OR name_en LIKE ? OR name_en LIKE ? LIMIT 10`);
  const emps = run(`SELECT id, full_name n FROM employees WHERE full_name LIKE ? OR emp_code LIKE ? OR full_name LIKE ? LIMIT 10`);
  const Sec = ({ t, rows, href, line }: { t: string; rows: Record<string, string | number>[]; href: (r: Record<string, string | number>) => string; line: (r: Record<string, string | number>) => string }) =>
    rows.length ? (
      <section><h2 className="font-display font-bold text-sm mb-1">{t}</h2>
        <div className="bw-card divide-y divide-slate-100">{rows.map((r) => <a key={r.id} href={href(r)} className="block p-2.5 text-xs hover:bg-slate-50">{line(r)}</a>)}</div></section>
    ) : null;
  const none = !deals.length && !leads.length && !banks.length && !emps.length;
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="font-display text-xl font-bold text-[#021125]">Search: “{q}”</h1>
      {q && none && <div className="text-sm text-slate-500">No matches.</div>}
      <Sec t="Deals" rows={deals} href={(r) => `/os/deals/${r.id}`} line={(r) => `${r.deal_ref} · ${r.n ?? ''} · ${r.stage}`} />
      <Sec t="Leads" rows={leads} href={(r) => `/os/crm?leadId=${r.id}`} line={(r) => `${r.n} · ${r.p} · ${r.stage}`} />
      <Sec t="Banks" rows={banks} href={() => '/os/banks-apl'} line={(r) => String(r.n)} />
      <Sec t="Employees" rows={emps} href={() => '/os/hrm'} line={(r) => String(r.n)} />
    </div>
  );
}

import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import { checkBankSubmissionGate, listGoAmlReports } from '@/server/engines/compliance-aml-engine';

export default async function ComplianceAndMlroPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.household_id, d.cdd_status, d.stage, h.primary_name
       FROM deals d JOIN households h ON h.id = d.household_id
       WHERE d.origin_mode = 'LIVE' ORDER BY d.id ASC`,
    )
    .all() as { id: number; deal_ref: string; household_id: number; cdd_status: string; stage: string; primary_name: string }[];

  const activeDeal = deals.find((d) => d.id === Number(sp.dealId)) ?? deals[0];
  const gate = checkBankSubmissionGate(db, activeDeal.id);

  const applicants = db
    .prepare(
      `SELECT a.id, a.full_name_en, a.applicant_role, a.residency_type,
              (SELECT signed_at FROM kfs_acknowledgements k WHERE k.deal_id = ? AND k.applicant_id = a.id) as kfs_signed_at,
              (SELECT risk_band || ' (' || risk_score || ')' FROM aml_screenings s WHERE s.deal_id = ? AND s.applicant_id = a.id ORDER BY s.id DESC LIMIT 1) as aml_summary
       FROM applicants a
       WHERE a.household_id = ?
       ORDER BY a.id ASC`,
    )
    .all(activeDeal.id, activeDeal.id, activeDeal.household_id) as {
    id: number;
    full_name_en: string;
    applicant_role: string;
    residency_type: string;
    kfs_signed_at: string | null;
    aml_summary: string | null;
  }[];

  // Chinese-Wall check for Sealed UAE FIU goAML Vault:
  let goAmlReports: ReturnType<typeof listGoAmlReports> | null = null;
  let goAmlWallReason: string | null = null;
  try {
    goAmlReports = listGoAmlReports(db, user);
  } catch (err) {
    goAmlWallReason = err instanceof Error ? err.message : 'MLRO-only Chinese wall active';
  }

  const complaints = db.prepare('SELECT * FROM sanadak_complaints ORDER BY id DESC').all() as Record<string, unknown>[];
  const auditLogs = db.prepare(user.is_mlro === 1 ? 'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 20' : "SELECT * FROM audit_logs WHERE entity_type != 'goaml_reports' ORDER BY id DESC LIMIT 20").all() as Record<string, unknown>[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader app="Compliance" appHref="/os/compliance" title="Compliance" sub={tr(lang, 'Multi-Applicant KFS Gate, AML/CDD & Sealed FIU Reporting', 'بوابة بيان الحقائق المشترك، فحص المخاطر وخزنة وحدة المعلومات المالية')} />

        <div className="flex flex-wrap gap-2">
          {deals.map((d) => (
            <a
              key={d.id}
              href={`/os/compliance?dealId=${d.id}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                d.id === activeDeal.id ? 'bg-[#021125] text-white border-[#021125]' : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <span className="font-num">{d.deal_ref}</span> · {d.primary_name}
            </a>
          ))}
        </div>
      </div>

      {/* Multi-Applicant KFS & CDD Gate Matrix */}
      <div className="bw-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-base text-[#021125]">
              Joint Applicant KFS & AML/CDD Clearance Matrix — {activeDeal.deal_ref}
            </h2>
            <p className="text-xs text-slate-500">
              Every obligated applicant (`PRIMARY`, `CO_BORROWER`, `GUARANTOR`) must digitally sign the CBUAE KFS and pass Source-of-Funds CDD before `IPA_SUBMITTED`.
            </p>
          </div>
          <span className={`bw-badge ${gate.allowed ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
            {gate.allowed ? '✓ GATE READY FOR IPA' : 'LOCKED UNTIL ALL APPLICANTS CLEARED'}
          </span>
        </div>

        <div className="space-y-3">
          {applicants.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-200 p-3.5 grid lg:grid-cols-12 gap-3 items-center text-xs">
              <div className="lg:col-span-4">
                <div className="font-bold text-[#021125]">
                  {a.full_name_en} <span className="bw-badge bg-slate-100 text-slate-700">{a.applicant_role}</span>
                </div>
                <div className="text-slate-500 mt-0.5">
                  KFS: {a.kfs_signed_at ? <strong className="text-emerald-700">✓ Signed ({a.kfs_signed_at})</strong> : <strong className="text-rose-700">Missing</strong>}
                  {' · '}AML: <strong>{a.aml_summary || 'Unscreened'}</strong>
                </div>
              </div>

              <form method="POST" action="/api/v1/actions" className="lg:col-span-4 flex gap-2 items-center">
                <input type="hidden" name="action" value="sign_kfs" />
                <input type="hidden" name="dealId" value={activeDeal.id} />
                <input type="hidden" name="applicantId" value={a.id} />
                <input type="hidden" name="signedByName" value={a.full_name_en} />
                <input type="hidden" name="returnTo" value={`/os/compliance?dealId=${activeDeal.id}`} />
                <input
                  name="disclosedLfiCommissionRange"
                  defaultValue="0.45% - 1.00% paid by LFI"
                  className="bw-input text-[11px]"
                />
                <button type="submit" className="bw-btn-gold shrink-0">Sign KFS</button>
              </form>

              <form method="POST" action="/api/v1/actions" className="lg:col-span-4 flex gap-2 items-center">
                <input type="hidden" name="action" value="run_aml_screening" />
                <input type="hidden" name="dealId" value={activeDeal.id} />
                <input type="hidden" name="applicantId" value={a.id} />
                <input type="hidden" name="returnTo" value={`/os/compliance?dealId=${activeDeal.id}`} />
                <select name="sourceOfFundsType" className="bw-input text-[11px]">
                  <option value="UAE_SALARY_SAVINGS">UAE Salary Savings</option>
                  <option value="PROPERTY_SALE_PROCEEDS">Property Sale Proceeds</option>
                  <option value="OVERSEAS_DIVIDENDS">Overseas Dividends</option>
                  <option value="GIFT_FIRST_DEGREE">First-Degree Family Gift</option>
                </select>
                <button type="submit" className="bw-btn-navy shrink-0">Clear CDD</button>
              </form>
            </div>
          ))}
        </div>
      </div>

      {/* Sealed UAE FIU goAML Vault (Chinese Wall) */}
      <div className="bw-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-[#021125]">
            Sealed UAE FIU `goAML` STR / SAR Vault (Federal Decree-Law No. 20 of 2018)
          </h2>
          <span className={`bw-badge ${user.is_mlro === 1 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
            {user.is_mlro === 1 ? 'MLRO CLEARANCE ACTIVE' : '403 CHINESE WALL LOCKED'}
          </span>
        </div>

        {goAmlWallReason ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-950 space-y-1">
            <div className="font-bold">🔒 Statutory Anti-Tipping-Off Chinese Wall Enforced (HTTP 403)</div>
            <div>{goAmlWallReason}</div>
            <div className="text-rose-800">
              Current user (<strong>{user.email}</strong>, role `{user.role}`, `is_mlro={user.is_mlro}`) is blocked from reading or exporting `goAML` filings. Switch to `farid.mlro@betterwaymortgages.com` or `md@betterwaymortgages.com` to inspect the sealed vault.
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 text-xs">
            <div className="lg:col-span-7 space-y-2.5">
              {goAmlReports?.map((rep) => (
                <div key={rep.id} className="rounded-lg border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5 max-w-md">
                    <div className="font-bold text-[#021125] font-num">
                      {rep.report_ref} · <span className="text-rose-700">{rep.report_type}</span> ({rep.status})
                    </div>
                    <div className="text-slate-600">{rep.subject_summary}</div>
                  </div>
                  <a href={`/api/v1/exports/goaml/${rep.id}`} className="bw-btn-navy">
                    ⬇ Export goAML .XML
                  </a>
                </div>
              ))}
            </div>

            <form method="POST" action="/api/v1/actions" className="lg:col-span-5 space-y-2.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <input type="hidden" name="action" value="create_goaml_report" />
              <input type="hidden" name="returnTo" value="/os/compliance" />
              <div className="font-bold text-[#021125]">File New Sealed STR / SAR Investigation</div>
              <select name="reportType" className="bw-input">
                <option value="SAR">SAR — Suspicious Activity Report</option>
                <option value="STR">STR — Suspicious Transaction Report</option>
              </select>
              <input name="redFlags" defaultValue="UNVERIFIED_OFFSHORE_THIRD_PARTY,CASH_LAYERING" className="bw-input font-num" />
              <textarea
                name="subjectSummary"
                required
                rows={2}
                placeholder="Confidential MLRO narrative for UAE Financial Intelligence Unit..."
                className="bw-input"
              />
              <button type="submit" className="bw-btn-gold w-full">Generate Sealed goAML XML</button>
            </form>
          </div>
        )}
      </div>

      {/* Sanadak Ombudsman SLA Register + Append-Only Audit Logs */}
      <div className="grid lg:grid-cols-12 gap-6 text-xs">
        <div className="lg:col-span-5 bw-card p-5 space-y-3">
          <h3 className="font-display font-bold text-sm text-[#021125]">
            CBUAE `Sanadak` Ombudsman Complaint SLA Register (2d Ack / 15d Resolution)
          </h3>
          <form method="POST" action="/api/v1/actions" className="space-y-2">
            <input type="hidden" name="action" value="log_sanadak_complaint" />
            <input type="hidden" name="returnTo" value="/os/compliance" />
            <input name="complainantName" required placeholder="Complainant Name" className="bw-input" />
            <input name="description" required placeholder="Summary of fee / valuation / timeline grievance..." className="bw-input" />
            <button type="submit" className="bw-btn-navy w-full">Log Sanadak SLA Ticket</button>
          </form>

          <div className="space-y-2 pt-2">
            {complaints.map((c) => (
              <div key={String(c.id)} className="rounded border border-slate-200 p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold font-num">{String(c.complaint_ref)} · {String(c.complainant_name)}</div>
                  <div className="text-slate-500">{String(c.description)}</div>
                </div>
                {c.resolved_at ? (
                  <span className="bw-badge bg-emerald-100 text-emerald-900">RESOLVED</span>
                ) : (
                  <form method="POST" action="/api/v1/actions">
                    <input type="hidden" name="action" value="resolve_sanadak_complaint" />
                    <input type="hidden" name="complaintId" value={String(c.id)} />
                    <input type="hidden" name="returnTo" value="/os/compliance" />
                    <button type="submit" className="bw-btn-gold text-[11px]">Resolve</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bw-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-[#021125]">
              Immutable Append-Only `audit_logs` Ledger (SQLite Trigger Protected)
            </h3>
            <span className="bw-badge bg-slate-100 text-slate-700">NO UPDATE / NO DELETE</span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {auditLogs.map((al) => (
              <div key={String(al.id)} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-num font-bold text-[#021125]">#{String(al.id)}</span>{' '}
                  <span className="font-semibold">{String(al.action)}</span> on{' '}
                  <span className="font-num text-slate-600">{String(al.entity_type)}:{String(al.entity_id)}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-num">
                  {String(al.actor_role)} · {String(al.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


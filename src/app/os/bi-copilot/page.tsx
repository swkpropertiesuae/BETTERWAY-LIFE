import { PageHeader } from '@/components/page-header';
import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAed, tr } from '@/lib/format';
import {
  analyzeBankStatementLines,
  computeExecutiveForecastAndBi,
  queryBankPolicyCoPilot,
  type StatementLine,
} from '@/server/engines/statement-and-policy-copilot';

const DEFAULT_STMT_RAW = [
  '2026-09-28|WPS SALARY TRANSFER EMIRATES GROUP|0|42000',
  '2026-10-28|WPS SALARY TRANSFER EMIRATES GROUP|0|42000',
  '2026-10-05|ADCB AUTO FINANCE EMI RECOVERY|2450|0',
  '2026-10-12|TABBY BNPL INSTALMENT 2 OF 4|650|0',
  '2026-10-19|TAMARA SPLIT PAYMENT|450|0',
].join('\n');

function parseStatementText(raw: string): StatementLine[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [date = '2026-10-01', description = '', debitAed = '0', creditAed = '0'] = line.split('|');
      return {
        date: date.trim(),
        description: description.trim(),
        debitFils: Math.round(Number(debitAed || 0) * 100),
        creditFils: Math.round(Number(creditAed || 0) * 100),
      };
    });
}

export default async function BiAndCopilotPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stmt?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const bi = computeExecutiveForecastAndBi(db);
  const query = sp.q || 'Which UAE banks assess 3% credit card limit in DBR and what is the off-plan handover LTV rule?';
  const copilot = queryBankPolicyCoPilot(db, query);

  const stmtRaw = sp.stmt || DEFAULT_STMT_RAW;
  const stmtAnalysis = analyzeBankStatementLines(parseStatementText(stmtRaw));

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader app="Reporting" appHref="/os/bi-copilot" title="Executive BI" sub={tr(lang, 'Clawback-Adjusted Treasury Forecast, Statement Parser & Policy Co-Pilot', 'توقعات الخزينة المعدلة، كاشف الالتزامات ومساعد السياسات الموثق')} />

      {/* Stage-Weighted Forecast Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bw-card p-5">
          <div className="text-xs text-slate-500">Gross Active Loan Pipeline</div>
          <div className="font-num text-xl font-bold text-[#021125] mt-1">{formatAed(bi.grossPipelineLoanFils)}</div>
          <div className="text-xs text-slate-500 mt-1">{bi.activeDealsCount} active live deals</div>
        </div>
        <div className="bw-card p-5">
          <div className="text-xs text-slate-500">Stage-Weighted Gross Subvention + Fees</div>
          <div className="font-num text-xl font-bold text-[#021125] mt-1">{formatAed(bi.weightedGrossRevenueFils)}</div>
          <div className="text-xs text-slate-500 mt-1">Weighted from Fact-Find (10%) to Cheques Ready (98%)</div>
        </div>
        <div className="bw-card p-5">
          <div className="text-xs text-slate-500">Net Weighted House Cash (After Partner Splits & 10% Clawback Reserve)</div>
          <div className="font-num text-xl font-bold text-emerald-800 mt-1">
            {formatAed(bi.weightedNetHouseAfterSplitsAndClawbackFils)}
          </div>
          <div className="text-xs text-emerald-700 mt-1">True brokerage free-cash expectation</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Deterministic UAE Bank Statement Analyzer */}
        <div className="lg:col-span-6 bw-card p-5 space-y-3 text-xs">
          <h2 className="font-display font-bold text-base text-[#021125]">
            6-Month UAE Bank Statement Pre-Underwriting Analyzer
          </h2>
          <p className="text-slate-600">
            Detects WPS salary transfers, recurring loan EMIs, undisclosed `Tabby` / `Tamara` BNPL obligations, and bounced cheques (`RETURNED CHEQUE` / `INSUFFICIENT FUNDS`) before bank submission.
          </p>
          <form method="GET" action="/os/bi-copilot" className="space-y-2.5">
            <input type="hidden" name="q" value={query} />
            <textarea name="stmt" rows={5} defaultValue={stmtRaw} className="bw-input font-num text-[11px]" />
            <button type="submit" className="bw-btn-navy w-full">Analyze Statement Lines</button>
          </form>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 grid grid-cols-2 gap-3">
            <div>
              <div className="text-slate-500">Avg Monthly WPS Salary</div>
              <div className="font-num font-bold text-[#021125]">{formatAed(stmtAnalysis.avgMonthlySalaryFils)}</div>
            </div>
            <div>
              <div className="text-slate-500">Detected Recurring EMI</div>
              <div className="font-num font-bold text-[#021125]">{formatAed(stmtAnalysis.detectedRecurringEmiFils)}</div>
            </div>
            <div>
              <div className="text-slate-500">Detected Tabby/Tamara BNPL</div>
              <div className="font-num font-bold text-amber-800">{formatAed(stmtAnalysis.detectedBnplFils)}</div>
            </div>
            <div>
              <div className="text-slate-500">Bounced Cheques / Alert</div>
              <div className={`font-bold ${stmtAnalysis.underwritingAlertLevel === 'CLEAR' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {stmtAnalysis.bouncedChequeCount} Bounces · {stmtAnalysis.underwritingAlertLevel}
              </div>
            </div>
          </div>
        </div>

        {/* Citation-Backed Bank Policy Co-Pilot */}
        <div className="lg:col-span-6 bw-card p-5 space-y-3 text-xs">
          <h2 className="font-display font-bold text-base text-[#021125]">
            Citation-Backed Bank Credit Policy Co-Pilot
          </h2>
          <p className="text-slate-600">
            Strictly grounded in Betterway&apos;s versioned `wiki_articles` repository — never guesses unverified rates or clauses.
          </p>
          <form method="GET" action="/os/bi-copilot" className="flex gap-2">
            <input type="hidden" name="stmt" value={stmtRaw} />
            <input name="q" defaultValue={query} className="bw-input" />
            <button type="submit" className="bw-btn-gold shrink-0">Ask Policy</button>
          </form>

          <div className="rounded-lg bg-[#021125] text-slate-100 p-4 space-y-3">
            <div className="whitespace-pre-wrap leading-relaxed">{copilot.deterministicSummary}</div>
            <div className="pt-2 border-t border-white/15 flex flex-wrap gap-2">
              {copilot.citations.map((c) => (
                <span key={c.slug} className="rounded bg-white/10 px-2 py-1 text-[10px] font-num text-[#c9a257]">
                  Cite: {c.clauseRef} ({c.policyVersion})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

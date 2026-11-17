import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { getDb } from '@/server/db';
import { canPrintReceptionQr } from '@/server/engines/swk-enterprise-engine';
import { OsLayoutFrame } from '@/components/swk-shell';

export default async function InternalOsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const db = getDb();

  const openTasksCount = (
    db.prepare("SELECT COUNT(*) as c FROM ops_tasks WHERE status = 'OPEN'").get() as { c: number }
  ).c;
  const allowQrPrint = canPrintReceptionQr(user);

  const dealsAgg = db
    .prepare(
      `SELECT COUNT(*) as c, COALESCE(SUM(target_loan_fils), 0) as total
       FROM deals
       WHERE origin_mode = 'LIVE'`,
    )
    .get() as { c: number; total: number };

  const latestEibor = db
    .prepare('SELECT three_month_micro FROM eibor_fixings ORDER BY fixing_date DESC LIMIT 1')
    .get() as { three_month_micro: number } | undefined;
  const eibor3mPct = ((latestEibor?.three_month_micro ?? 418000) / 100000).toFixed(2);
  const activePipelineM =
    dealsAgg.total > 0 ? `AED ${(dealsAgg.total / 100_000_000).toFixed(2)}M` : 'AED 0';

  return (
    <OsLayoutFrame
      user={user}
      lang={lang}
      openTasksCount={openTasksCount}
      canPrintQr={allowQrPrint}
      eibor3mPct={eibor3mPct}
      activePipelineM={activePipelineM}
    >
      {children}
    </OsLayoutFrame>
  );
}

import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import {
  listStudioTemplates,
  getMasterWorkflowBookletChapters,
} from '@/server/engines/pdf-studio-engine';
import {
  PdfStudioClient,
  type StudioDealOption,
  type StudioEmployeeOption,
  type SavedStudioDoc,
} from '@/components/pdf-studio-client';

export const dynamic = 'force-dynamic';

export default async function PdfStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireStaffUser();
  const sp = await searchParams;
  const db = getDb();

  const templates = listStudioTemplates();
  const chapters = getMasterWorkflowBookletChapters();

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, h.primary_name AS client_name, d.community_name,
              d.purchase_price_fils, d.target_loan_fils, b.name_en AS bank_name, u.full_name_en AS advisor_name
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN banks b ON b.id = d.selected_bank_id
       LEFT JOIN users u ON u.id = d.advisor_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id ASC`,
    )
    .all() as unknown as StudioDealOption[];

  const employees = db
    .prepare(
      `SELECT e.id, e.emp_code, e.full_name, COALESCE(u.email, '') AS email,
              e.designation, e.department, e.join_date, e.mohre_person_id_14, e.employee_iban_23,
              e.basic_salary_fils, e.housing_allowance_fils, e.transport_allowance_fils, e.other_allowance_fils
       FROM employees e
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.id ASC`,
    )
    .all() as unknown as StudioEmployeeOption[];

  const savedDocs = db
    .prepare('SELECT * FROM studio_documents ORDER BY id DESC LIMIT 20')
    .all() as unknown as SavedStudioDoc[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />
      <PageHeader
        app="Documents & PDF Studio"
        appHref="/os/studio"
        title="Betterway PDF & Document Studio + 20-Chapter Workflow Booklet"
        sub="Rahaba Azeez HR Certificates, NOCs, Offer Letters, 3-Bank Mortgage Proposals, Form F Annexures & Bilingual EN/AR PDF Engine"
      />
      <PdfStudioClient
        templates={templates}
        chapters={chapters}
        deals={deals}
        employees={employees}
        savedDocs={savedDocs}
      />
    </div>
  );
}

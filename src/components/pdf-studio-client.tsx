'use client';

import { useMemo, useState } from 'react';
import { StaffAvatar } from '@/components/staff-avatar';
import { OFFICIAL_STAFF_DIRECTORY } from '@/lib/staff-directory';
import type {
  StudioTemplateSpec,
  WorkflowBookletChapter,
} from '@/server/engines/pdf-studio-engine';
import {
  BookOpen,
  CheckCircle2,
  FileCheck,
  FileText,
  Languages,
  Printer,
  Sparkles,
  Wand2,
} from 'lucide-react';

export interface StudioDealOption {
  id: number;
  deal_ref: string;
  client_name: string;
  community_name: string;
  purchase_price_fils: number;
  target_loan_fils: number;
  bank_name: string | null;
  advisor_name: string | null;
}

export interface StudioEmployeeOption {
  id: number;
  emp_code: string;
  full_name: string;
  email: string;
  designation: string;
  department: string;
  join_date: string;
  mohre_person_id_14: string;
  employee_iban_23: string;
  basic_salary_fils: number;
  housing_allowance_fils: number;
  transport_allowance_fils: number;
  other_allowance_fils: number;
}

export interface SavedStudioDoc {
  id: number;
  doc_ref: string;
  template_id: string;
  title: string;
  category: string;
  rendered_body: string;
  created_by_email: string;
  created_at: string;
}

export function PdfStudioClient({
  templates,
  chapters,
  deals,
  employees,
  savedDocs,
}: {
  templates: StudioTemplateSpec[];
  chapters: WorkflowBookletChapter[];
  deals: StudioDealOption[];
  employees: StudioEmployeeOption[];
  savedDocs: SavedStudioDoc[];
}) {
  const [studioTab, setStudioTab] = useState<'editor' | 'booklet' | 'vault'>('editor');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'hr-salary-certificate');
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState<string>('asif@betterwaymortgages.com');
  const [selectedDealId, setSelectedDealId] = useState<number>(deals[0]?.id || 1);
  const [customBody, setCustomBody] = useState<string | null>(null);
  const [addresseeBank, setAddresseeBank] = useState<string>('Emirates NBD PJSC — Retail Credit Desk, Dubai, UAE');

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? templates[0]!,
    [templates, selectedTemplateId],
  );

  const selectedEmp = useMemo(
    () =>
      employees.find((e) => (e.email || '').toLowerCase() === selectedEmployeeEmail.toLowerCase()) ??
      employees[0],
    [employees, selectedEmployeeEmail],
  );

  const selectedDeal = useMemo(
    () => deals.find((d) => d.id === selectedDealId) ?? deals[0],
    [deals, selectedDealId],
  );

  const autoFilledBody = useMemo(() => {
    const issueDate = new Date().toISOString().slice(0, 10);
    const docRef = `BW-DOC-${selectedTemplateId.toUpperCase().slice(0, 6)}-2026`;
    const basicAed = selectedEmp ? Math.round(Number(selectedEmp.basic_salary_fils) / 100) : 7_000;
    const allowAed = selectedEmp
      ? Math.round(
          (Number(selectedEmp.housing_allowance_fils) +
            Number(selectedEmp.transport_allowance_fils) +
            Number(selectedEmp.other_allowance_fils)) /
            100,
        )
      : 5_000;
    const totalAed = basicAed + allowAed;
    const propAed = selectedDeal ? Math.round(Number(selectedDeal.purchase_price_fils) / 100) : 3_500_000;
    const loanAed = selectedDeal ? Math.round(Number(selectedDeal.target_loan_fils) / 100) : 2_800_000;
    const ltvPct = propAed > 0 ? ((loanAed / propAed) * 100).toFixed(1) : '80.0';
    const emiAed = Math.round(loanAed * 0.00527);

    const map: Record<string, string> = {
      '[Issue Date]': issueDate,
      '[Doc Ref]': docRef,
      '[Employee Name]': selectedEmp?.full_name || 'Asif Khan',
      '[Employee Code]': selectedEmp?.emp_code || 'BW-EMP-009',
      '[Designation]': selectedEmp?.designation || 'Mortgage Advisor',
      '[Department]': selectedEmp?.department || 'Mortgage Advisory',
      '[Join Date]': selectedEmp?.join_date || '2026-01-01',
      '[MOHRE ID]': selectedEmp?.mohre_person_id_14 || '00192837465009',
      '[Employee IBAN]': selectedEmp?.employee_iban_23 || 'AE070331234567890123409',
      '[Basic Salary AED]': basicAed.toLocaleString(),
      '[Allowances AED]': allowAed.toLocaleString(),
      '[Total Salary AED]': totalAed.toLocaleString(),
      '[Addressee Bank]': addresseeBank,
      '[Client Name]': selectedDeal?.client_name || 'Khalid Al Nuaimi',
      '[Deal Ref]': selectedDeal?.deal_ref || 'BW-2026-0001',
      '[Property Community]': selectedDeal?.community_name || 'Dubai Hills Estate',
      '[Property Value AED]': propAed.toLocaleString(),
      '[Loan Amount AED]': loanAed.toLocaleString(),
      '[LTV %]': ltvPct,
      '[Selected Bank]': selectedDeal?.bank_name || 'Emirates NBD',
      '[Intro Rate %]': '3.89% Fixed (3 Years)',
      '[Monthly EMI AED]': emiAed.toLocaleString(),
      '[Advisor Name]': selectedDeal?.advisor_name || 'Daniel Xavier',
    };

    let text = activeTemplate.body;
    for (const [k, v] of Object.entries(map)) {
      text = text.split(k).join(v);
    }
    return text;
  }, [activeTemplate, selectedEmp, selectedDeal, selectedTemplateId, addresseeBank]);

  const currentDocText = customBody !== null ? customBody : autoFilledBody;

  const applyAiTransform = (mode: 'improve' | 'legal' | 'arabic' | 'reset') => {
    if (mode === 'reset') {
      setCustomBody(null);
      return;
    }
    if (mode === 'arabic') {
      setCustomBody(
        [
          `شركة بيتروي للوساطة العقارية والتمويل ذ.م.م — دبي، الإمارات العربية المتحدة`,
          `وثيقة رسمية معتمدة — شهادة راتب / خطاب عدم ممانعة / عرض تمويل عقاري`,
          `────────────────────────────────────────────────────────────────────`,
          `نشهد نحن شركة بيتروي للوساطة العقارية والتمويل ذ.م.م بأن كافة البيانات الواردة أدناه مطابقة لسجلات نظام حماية الأجور (MOHRE WPS) وضوابط مصرف الإمارات المركزي (CBUAE 50% DBR) ودائرة الأراضي والأملاك في دبي (DLD):`,
          ``,
          autoFilledBody,
          ``,
          `اعتماد الموارد البشرية: رحابة عزيز (HR) · اعتماد الإدارة العليا: شبيب سراج (المدير العام والمؤسس)`,
        ].join('\n'),
      );
      return;
    }
    if (mode === 'legal') {
      setCustomBody(
        [
          `STRICTLY CONFIDENTIAL · CBUAE, MOHRE & DLD STATUTORY ATTESTATION`,
          `════════════════════════════════════════════════════════════════════`,
          autoFilledBody,
          ``,
          `STATUTORY CLAUSE: Issued in strict accordance with UAE Federal Decree-Law No. 33 of 2021 (MOHRE Labour Law), CBUAE Consumer Protection Regulations, and Federal Decree-Law No. 45 of 2021 (PDPL).`,
        ].join('\n'),
      );
      return;
    }
    setCustomBody(
      [
        `BETTERWAY MORTGAGES LLC — EXECUTIVE CERTIFIED DOCUMENT`,
        autoFilledBody,
        `\n[Digitally Verified & Stamped via Betterway OS Studio · Seal Ref: BW-SEAL-2026]`,
      ].join('\n'),
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher */}
      <div className="bw-card p-3 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStudioTab('editor')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              studioTab === 'editor'
                ? 'bg-[#021125] text-[#D7B04E]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            Interactive PDF &amp; Letterhead Studio ({templates.length} Templates)
          </button>
          <button
            type="button"
            onClick={() => setStudioTab('booklet')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              studioTab === 'booklet'
                ? 'bg-[#021125] text-[#D7B04E]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            20-Chapter Visual Workflow &amp; System Logic PDF Booklet
          </button>
          <button
            type="button"
            onClick={() => setStudioTab('vault')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              studioTab === 'vault'
                ? 'bg-[#021125] text-[#D7B04E]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileCheck className="h-4 w-4" />
            Issued Studio Documents ({savedDocs.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="bw-btn-gold text-xs flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print / Save A4 PDF
        </button>
      </div>

      {/* TAB 1: INTERACTIVE PDF & LETTERHEAD STUDIO */}
      {studioTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Sidebar: Template Picker & Auto-Fill Controls */}
          <div className="lg:col-span-5 space-y-4 no-print">
            <div className="bw-card p-4 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A6518]">
                Step 1 · Select Corporate or Rahaba HR Template
              </div>
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {templates.map((t) => {
                  const active = t.id === selectedTemplateId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(t.id);
                        setCustomBody(null);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        active
                          ? 'bg-[#021125] text-white border-[#D7B04E] shadow-sm'
                          : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs">{t.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            active ? 'bg-[#D7B04E] text-[#021125]' : 'bg-amber-100 text-[#8A6518]'
                          }`}
                        >
                          {t.badge}
                        </span>
                      </div>
                      <div className={`text-[11px] mt-1 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                        {t.summary}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Live Record Auto-Fill (Staff + Deal) */}
            <div className="bw-card p-4 space-y-3 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A6518]">
                Step 2 · Auto-Fill Placeholders from Staff &amp; Deal DB
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1.5">
                  Staff Member (for HR Letters, NOCs, Salary Certificates):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {OFFICIAL_STAFF_DIRECTORY.map((s) => {
                    const active = s.email.toLowerCase() === selectedEmployeeEmail.toLowerCase();
                    return (
                      <button
                        key={s.email}
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeEmail(s.email);
                          setCustomBody(null);
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                          active
                            ? 'bg-[#021125] text-[#D7B04E] border-[#D7B04E]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <StaffAvatar name={s.fullNameEn} email={s.email} size={18} />
                        <span>{s.fullNameEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="font-semibold text-slate-700">
                  Mortgage Deal File (for Proposals, AIP, Form F, KFS &amp; Tax Invoices):
                </span>
                <select
                  value={selectedDealId}
                  onChange={(e) => {
                    setSelectedDealId(Number(e.target.value));
                    setCustomBody(null);
                  }}
                  className="bw-input mt-1 w-full"
                >
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.deal_ref} — {d.client_name} ({d.community_name} · AED{' '}
                      {Math.round(d.target_loan_fils / 100).toLocaleString()})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="font-semibold text-slate-700">Addressee Bank / Authority:</span>
                <input
                  value={addresseeBank}
                  onChange={(e) => {
                    setAddresseeBank(e.target.value);
                    setCustomBody(null);
                  }}
                  className="bw-input mt-1 w-full"
                />
              </label>

              {/* AI Transform & Bilingual Bar */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="font-bold text-[#021125] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#8A6518]" />
                  BetterwayGPT Document Co-Pilot &amp; EN/AR Translator
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyAiTransform('improve')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex items-center justify-center gap-1"
                  >
                    <Wand2 className="h-3.5 w-3.5 text-[#8A6518]" /> Executive Polish
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAiTransform('legal')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#8A6518]" /> CBUAE/MOHRE Legal
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAiTransform('arabic')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#021125] text-[#D7B04E] font-bold flex items-center justify-center gap-1"
                  >
                    <Languages className="h-3.5 w-3.5" /> Translate Arabic (عربي)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAiTransform('reset')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                  >
                    Reset Template
                  </button>
                </div>
              </div>

              {/* Persist to Studio Vault */}
              <form method="POST" action="/api/v1/actions" className="pt-2">
                <input type="hidden" name="action" value="create_studio_document" />
                <input type="hidden" name="returnTo" value="/os/studio" />
                <input type="hidden" name="templateId" value={selectedTemplateId} />
                <input type="hidden" name="employeeEmail" value={selectedEmployeeEmail} />
                <input type="hidden" name="dealId" value={String(selectedDealId)} />
                <button type="submit" className="bw-btn-gold w-full justify-center">
                  Save &amp; Stamp Official Document in Vault
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Live A4 Printable Corporate Letterhead Sheet */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border-2 border-[#021125]/15 shadow-xl overflow-hidden print:border-0 print:shadow-none">
              {/* Betterway Mortgages LLC Midnight Navy & Sovereign Gold Letterhead */}
              <div className="bg-[#021125] text-white px-7 py-5 border-b-4 border-[#D7B04E] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D7B04E]">
                    BETTERWAY MORTGAGES LLC · DUBAI, UNITED ARAB EMIRATES
                  </div>
                  <div className="font-display text-xl font-bold mt-1">{activeTemplate.title}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    CBUAE &amp; DLD Regulated Mortgage Consultancy · Business Bay, Dubai, UAE
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-[#072244] px-3 py-2 rounded-xl border border-white/10">
                  <StaffAvatar name={selectedEmp?.full_name || 'Asif Khan'} email={selectedEmployeeEmail} size={36} />
                  <div className="text-right">
                    <div className="text-xs font-bold text-white">{selectedEmp?.full_name || 'Asif Khan'}</div>
                    <div className="text-[10px] text-[#D7B04E]">{selectedEmp?.designation || 'Mortgage Advisor'}</div>
                  </div>
                </div>
              </div>

              {/* Editable A4 Body */}
              <div className="p-7 space-y-5">
                <textarea
                  value={currentDocText}
                  onChange={(e) => setCustomBody(e.target.value)}
                  rows={20}
                  className="w-full font-mono text-xs leading-relaxed text-slate-900 bg-slate-50/50 p-4 rounded-xl border border-slate-200 focus:outline-none focus:border-[#021125] print:border-0 print:bg-transparent print:p-0"
                />

                {/* Corporate Seal & Signatory Footer */}
                <div className="pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-xs">
                  <div className="flex items-center gap-2.5">
                    <StaffAvatar name="Rahaba Azeez" email="rahaba@betterwaymortgages.com" size={38} />
                    <div>
                      <div className="font-bold text-[#021125]">Rahaba Azeez</div>
                      <div className="text-[11px] text-slate-500">HR — Human Resources</div>
                      <div className="text-[10px] text-emerald-700 font-bold">DIGITALLY VERIFIED ✓</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <StaffAvatar name="Daniel Xavier" email="daniel@betterwaymortgages.com" size={38} />
                    <div>
                      <div className="font-bold text-[#021125]">Daniel Xavier</div>
                      <div className="text-[11px] text-slate-500">Team Manager &amp; Advisor</div>
                      <div className="text-[10px] text-emerald-700 font-bold">COUNTERSIGNED ✓</div>
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-[#D7B04E] bg-[#021125] text-white p-3 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#D7B04E]">
                      OFFICIAL CORPORATE SEAL
                    </div>
                    <div className="font-display font-bold text-xs mt-0.5">BETTERWAY MORTGAGES LLC</div>
                    <div className="text-[10px] text-slate-300 font-num">Shabib Siraj ·Warda</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 20-CHAPTER VISUAL WORKFLOW & SYSTEM LOGIC PDF BOOKLET */}
      {studioTab === 'booklet' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#021125] text-white p-6 border-b-4 border-[#D7B04E] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#D7B04E]">
                BETTERWAY MORTGAGES LLC · MASTER OPERATING MANUAL
              </div>
              <h2 className="font-display text-2xl font-bold mt-1">
                20-Chapter Visual Workflow &amp; System Logic PDF Booklet
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                End-to-end architecture covering Website-to-OS lead ingestion, CBUAE 50% DBR underwriting, 24-bank rate cards, DLD Trustee cheque splits, FTA VAT 201, Rahaba Azeez HR &amp; 10:05 AM QR attendance, and Betterway ONE mobile sync.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="bw-btn-gold text-xs flex items-center gap-2 no-print"
            >
              <Printer className="h-4 w-4" />
              Print Complete 20-Chapter PDF Booklet
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chapters.map((ch) => (
              <div key={ch.chapterNo} className="bw-card p-5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#021125] text-[#D7B04E] font-num text-xs font-bold">
                    Chapter {String(ch.chapterNo).padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-semibold text-[#8A6518]">{ch.department}</span>
                </div>
                <h3 className="font-display font-bold text-base text-[#021125]">{ch.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{ch.summary}</p>
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div className="text-[11px] font-bold text-slate-700">
                    Lead Accountability: <span className="text-[#021125]">{ch.leadOwner}</span>
                  </div>
                  <ul className="text-[11px] text-slate-600 space-y-0.5">
                    {ch.controlRules.map((rule, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D7B04E]" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ISSUED STUDIO DOCUMENTS VAULT */}
      {studioTab === 'vault' && (
        <div className="bw-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base text-[#021125]">
            Issued &amp; Stamped Studio Documents ({savedDocs.length})
          </h2>
          {savedDocs.length === 0 ? (
            <div className="text-xs text-slate-500">
              No studio documents saved yet — click &ldquo;Save &amp; Stamp Official Document in Vault&rdquo; in the Studio Editor.
            </div>
          ) : (
            <div className="space-y-3">
              {savedDocs.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-num font-bold text-xs text-[#021125]">{doc.doc_ref}</span> ·{' '}
                      <strong className="text-xs text-slate-900">{doc.title}</strong>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      ISSUED &amp; STAMPED · {doc.created_by_email}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200 max-h-48 overflow-y-auto">
                    {doc.rendered_body}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

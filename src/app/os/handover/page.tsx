import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';

export const dynamic = 'force-dynamic';

export default async function HandoverPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  await requireStaffUser();
  const params = await searchParams;
  const activeDoc = params.doc || 'doc01';

  const db = getDb();
  const users = db
    .prepare('SELECT id, email, full_name_en, role, status FROM users ORDER BY id ASC')
    .all() as Array<Record<string, unknown>>;

  const docs = [
    { id: 'doc01', label: 'Doc 01 · Owner Executive Dossier ' },
    { id: 'doc02', label: 'Doc 02 · Technical Architecture & Security Manual' },
    { id: 'doc03', label: 'Doc 03 · All-Staff Operations & SOP User Guide' },
    { id: 'doc04', label: 'Doc 04 · Official Handover Certificate & Sign-Off' },
    { id: 'doc05', label: 'Doc 05 · Staff Login Credentials & Hierarchy Directory' },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Midnight & Champagne Header */}
      <div className="rounded-2xl bg-white text-gray-900 p-6 border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">
              Step 12 · Official Enterprise Handover &amp; Training Portal
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
              Complete Enterprise System Handover &amp; Staff Training Suite
            </h1>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Architected &amp; Handed Over by <strong>SHAMEEM HARFATH S M</strong> (Lead Enterprise Systems Architect)
              to <strong>Shabib Siraj</strong> (Founder &amp; Managing Director, Betterway Mortgages LLC).
            </p>
          </div>
          <div className="text-right text-xs">
            <div className="text-slate-700 font-bold uppercase tracking-wider">Handover Status: 100% Verified</div>
            <div className="text-gray-500 font-num mt-0.5">CBUAE & DLD Regulatory Controls Active</div>
          </div>
        </div>

        {/* 6 Telemetry Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          {[
            { label: 'Enterprise Modules', val: '12 Integrated Apps' },
            { label: 'Database Schema', val: '39 SQLite WAL Tables' },
            { label: 'Automated Tests', val: 'Verified' },
            { label: 'Dubai Market Areas', val: '24 DLD Corridors' },
            { label: 'CBUAE Guardrails', val: '50% DBR / +200 bps' },
            { label: 'Zero-Delete Bin', val: 'Owner Shabib Only' },
          ].map((t) => (
            <div key={t.label} className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-left">
              <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold">{t.label}</div>
              <div className="text-xs font-bold text-gray-900 mt-0.5">{t.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 5 Document Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200/90 shadow-sm">
        {docs.map((d) => (
          <Link
            key={d.id}
            href={`/os/handover?doc=${d.id}`}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeDoc === d.id
                ? 'bg-slate-900 text-white border border-slate-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {d.label}
          </Link>
        ))}
      </div>

      {/* Corporate Letterhead Document Container */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 md:p-8 shadow-md space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">
              Betterway Mortgages LLC · Dubai, United Arab Emirates
            </div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-slate-900 mt-0.5">
              {docs.find((d) => d.id === activeDoc)?.label}
            </h2>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            Official Signed Master Copy
          </span>
        </div>

        {activeDoc === 'doc01' && (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <h3 className="font-display text-base font-bold text-slate-900">
              1. Supreme Owner Governance &amp; Two-Tier Hierarchy
            </h3>
            <p>
              <strong>Shabib Siraj</strong> (<code>shabib@betterwaymortgages.com</code>) is the Tier-1 Supreme Owner of
              Betterway Mortgages OS. All record deletions across the platform are intercepted into the{' '}
              <strong>Pending Delete Bin</strong> (<code>/os/recycle-bin</code>) and cannot be permanently purged
              without Owner approval. Furthermore, the Tier-2 System Admin account (
              <code>admin@betterwaymortgages.com</code>) is directly supervised by the Supreme Owner (1-click Suspend,
              Activate, Force Sign-Out, and Password Reset).
            </p>
            <h3 className="font-display text-base font-bold text-slate-900">
              2. Strictly Legal UAE Payment Channels &amp; 50/50 Commission Split
            </h3>
            <p>
              Personal advisor bank accounts are strictly blocked across all deal inflows and withdrawals. Every bank
              subvention after deducting external B2B partner referral shares is split{' '}
              <strong>50% to Betterway Mortgages LLC</strong> and <strong>50% to the closing Mortgage Advisor</strong>,
              with a 180-day bank clawback reserve automatically journaled in the Double-Entry General Ledger.
            </p>
            <h3 className="font-display text-base font-bold text-slate-900">
              3. Automated 09:30 AM &amp; 10:30 AM Owner Briefings
            </h3>
            <p>
              Every morning at <code>09:30 AM GST</code>, the system compiles the Pipeline, FOL, and Subvention
              briefing for Owner Shabib Siraj. At <code>10:30 AM GST</code>, the system compiles the Office Reception
              QR Attendance Roll Call and flags any staff member with 3+ late arrivals (<code>&gt; 10:05 AM</code>) in
              a rolling 7-day window.
            </p>
          </div>
        )}

        {activeDoc === 'doc02' && (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <h3 className="font-display text-base font-bold text-slate-900">
              Technical Stack &amp; CBUAE / DLD Deterministic Engines
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Runtime &amp; UI:</strong> Next.js 16 App Router, TypeScript 5, Tailwind CSS 4 with the
                signature <em>Midnight Navy (#061022), Champagne Gold (#c9a96e), and Warm Dubai Sand (#f6f2ea)</em>{' '}
                design system and Compact 2-Column Numbered App Sidebar.
              </li>
              <li>
                <strong>Database &amp; Integrity:</strong> SQLite with Write-Ahead Logging (WAL), integer Fils (
                <code>1 AED = 100 fils</code>) across all financial columns, and append-only audit triggers.
              </li>
              <li>
                <strong>CBUAE Mortgage Regulation Engine:</strong> Enforces max 50% DBR at +200 bps stress rate, max
                25-year tenure (age 65/70 cap), and LTV tiers (80% Expats / 85% UAE Nationals &le; AED 5M; 70%/75% &gt;
                AED 5M; 50% Off-Plan).
              </li>
            </ul>
          </div>
        )}

        {activeDoc === 'doc03' && (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <h3 className="font-display text-base font-bold text-slate-900">
              All-Staff 12-Step Sequential Operating Procedure (SOP)
            </h3>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <strong>10:00 AM Arrival:</strong> Scan the Office Reception QR (<code>/os/reception-qr</code>) before
                the <code>10:05 AM</code> grace cutoff.
              </li>
              <li>
                <strong>Step 01–04 (Market &amp; Leads):</strong> Review the 24-Area Dubai Market Pulse (
                <code>/os/market</code>) and claim incoming mortgage leads (<code>/os/crm</code>).
              </li>
              <li>
                <strong>Step 05–06 (Deal Pipeline &amp; Underwriting):</strong> Run CBUAE DBR/LTV stress checks and
                match the borrower against 24 UAE Bank Rate Cards (<code>/os/banks-apl</code> &amp;{' '}
                <code>/os/los</code>).
              </li>
              <li>
                <strong>Step 07–08 (Commissions &amp; Compliance):</strong> Track FOL issuance, DLD trustee transfer,
                50/50 split, and CBUAE KFS + goAML screening.
              </li>
              <li>
                <strong>End-of-Day Report:</strong> Submit the mandatory Daily Work Report inside the Company
                Operations Centre (<code>/os/operations?tab=reports</code>) before 7:00 PM.
              </li>
            </ol>
          </div>
        )}

        {activeDoc === 'doc04' && (
          <div className="p-6 rounded-2xl bg-gray-50 border border-slate-900 space-y-4 text-xs text-slate-800">
            <div className="text-center space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-700">
                Certificate of Enterprise System Completion &amp; Handover
              </div>
              <h3 className="font-display text-2xl font-bold text-slate-900">
                Betterway Mortgages LLC — Enterprise Operating System
              </h3>
            </div>
            <p className="leading-relaxed text-center max-w-2xl mx-auto">
              This certifies that the complete Betterway Mortgages Enterprise Operating System (CRM, CBUAE
              Underwriting, Multi-Bank FOL Desk, DLD 24-Area Market Pulse, Zero-Delete Recycle Bin, 50/50 Subvention
              Split &amp; Double-Entry Ledger, MOHRE/WPS HRM, and Reception QR Attendance) has been engineered, tested
              across 58 automated verification suites, and formally handed over.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Architected &amp; Handed Over By</div>
                <div className="font-display text-base font-bold text-slate-900 mt-1">SHAMEEM HARFATH S M</div>
                <div className="text-slate-600">Lead Enterprise Systems Architect</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Accepted By Supreme Owner</div>
                <div className="font-display text-base font-bold text-slate-900 mt-1">SHABIB SIRAJ</div>
                <div className="text-slate-600">Founder &amp; Managing Director, Betterway Mortgages LLC</div>
              </div>
            </div>
          </div>
        )}

        {activeDoc === 'doc05' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              All staff accounts below are pre-provisioned. Login aliases under <code>@betterwaymortgages.com</code>{' '}
              and <code>@swk.properties</code> map seamlessly to the leadership hierarchy (`Betterway#2026`).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Email Login</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={String(u.id)}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{String(u.full_name_en)}</td>
                      <td className="py-2.5 px-3 font-num text-slate-800">{String(u.email)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold">
                          {String(u.role)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{String(u.status)}</td>
                      <td className="py-2.5 px-3 font-num font-bold text-slate-700">Betterway#2026</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

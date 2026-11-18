'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StaffAvatar } from '@/components/staff-avatar';
import { OFFICIAL_STAFF_DIRECTORY } from '@/lib/staff-directory';
import { computeToolkitAll } from '@/lib/uae-deal-toolkit';
import {
  BellOff,
  Calculator,
  CheckCircle2,
  CloudOff,
  FileCheck2,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Wifi,
} from 'lucide-react';

export interface MobileBundleData {
  staff: {
    userId: number;
    email: string;
    fullNameEn: string;
    designation: string;
    department: string;
    role: string;
    avatarUrl: string | null;
  };
  deviceId: string;
  expiresAt: string;
  encryptedChecksum: string;
  todayGst: string;
  todayAttendance: Record<string, unknown> | null;
  assignedLeads: Array<Record<string, unknown>>;
  assignedDeals: Array<Record<string, unknown>>;
  pendingSyncQueue: Array<Record<string, unknown>>;
  openConflicts: Array<Record<string, unknown>>;
}

export function MobileAppClient({
  bundle,
  quietNotification,
}: {
  bundle: MobileBundleData;
  quietNotification: {
    suppressedByQuietHours: boolean;
    lockScreenText: string;
    deepLinkUrl: string;
  };
}) {
  const [activeTab, setActiveTab] = useState<'qr' | 'pipeline' | 'calc' | 'hr' | 'sync'>('qr');
  const [offlineMode, setOfflineMode] = useState(false);
  const [quietHoursSim, setQuietHoursSim] = useState(true);

  // Mobile quick calculator state
  const [priceAed, setPriceAed] = useState(3_500_000);
  const [downPct, setDownPct] = useState(20);
  const [incomeAed, setIncomeAed] = useState(45_000);
  const [debtAed, setDebtAed] = useState(2_500);
  const [ratePct, setRatePct] = useState(3.89);

  const calc = useMemo(
    () =>
      computeToolkitAll({
        priceAed,
        downPaymentPct: downPct,
        interestRatePct: ratePct,
        tenureYears: 25,
        monthlyIncomeAed: incomeAed,
        existingDebtAed: debtAed,
        cardLimitsAed: 20_000,
        residency: 'expat',
        firstHome: true,
        offPlan: false,
        currentLoanBalanceAed: 2_000_000,
        currentRatePct: 5.49,
        newRatePct: 3.89,
        remainingYears: 20,
        annualRentAed: 210_000,
        areaSqft: 1_500,
        serviceChargePerSqft: 16,
        reraIndexAvgAed: 230_000,
        jointOwners: 1,
        grossSubventionAed: 28_000,
        partnerSharePct: 20,
        advisorSplitPct: 50,
        bookingPct: 20,
        constructionPct: 40,
        handoverPct: 40,
        postHandoverPct: 0,
      }),
    [priceAed, downPct, incomeAed, debtAed, ratePct],
  );

  return (
    <div className="space-y-6">
      {/* Top Staff Switcher Bar */}
      <div className="bw-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#021125] text-[#D7B04E] flex items-center justify-center">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8A6518]">
              Betterway ONE · iOS &amp; Android Field PWA
            </div>
            <div className="font-display text-lg font-bold text-[#021125]">
              Active Mobile Session: {bundle.staff.fullNameEn} ({bundle.staff.designation})
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {OFFICIAL_STAFF_DIRECTORY.map((s) => {
            const active = s.email.toLowerCase() === bundle.staff.email.toLowerCase();
            return (
              <Link
                key={s.email}
                href={`/os/mobile?staff=${encodeURIComponent(s.email)}`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  active
                    ? 'bg-[#021125] text-[#D7B04E] border-[#D7B04E]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <StaffAvatar name={s.fullNameEn} email={s.email} size={20} />
                <span>{s.fullNameEn.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive iPhone 16 Pro Mobile Viewport */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[410px] rounded-[42px] bg-[#021125] p-3.5 shadow-2xl border-4 border-[#072244]">
            {/* Dynamic Island / Status Bar */}
            <div className="rounded-t-[30px] bg-[#021125] px-5 pt-2 pb-3 text-white">
              <div className="flex items-center justify-between text-[11px] font-num opacity-90">
                <span>09:58 GST</span>
                <span className="px-3 py-0.5 rounded-full bg-black/60 text-[#D7B04E] text-[10px] font-bold">
                  Betterway ONE
                </span>
                <span className="flex items-center gap-1">
                  {offlineMode ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <CloudOff className="h-3 w-3" /> Offline
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Wifi className="h-3 w-3" /> Office-5G
                    </span>
                  )}
                </span>
              </div>

              {/* Staff Identity Header inside Mobile App */}
              <div className="mt-3 flex items-center justify-between gap-2 bg-[#072244] rounded-2xl p-3 border border-white/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <StaffAvatar name={bundle.staff.fullNameEn} email={bundle.staff.email} size={42} />
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">{bundle.staff.fullNameEn}</div>
                    <div className="text-[11px] text-[#D7B04E] truncate">{bundle.staff.designation}</div>
                    <div className="text-[10px] text-slate-300 font-num truncate">{bundle.deviceId}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOfflineMode((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                    offlineMode
                      ? 'bg-amber-400 text-[#021125]'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  }`}
                >
                  {offlineMode ? 'Offline Queue' : 'Live Sync'}
                </button>
              </div>
            </div>

            {/* Mobile Screen Body */}
            <div className="bg-[#F8F9FA] text-slate-900 min-h-[510px] max-h-[560px] overflow-y-auto p-4 space-y-3.5 text-xs">
              {/* TAB 1: QR ATTENDANCE & FIELD CHECK-IN */}
              {activeTab === 'qr' && (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A6518]">
                        10:05 AM GST Office Attendance
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          bundle.todayAttendance
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {bundle.todayAttendance
                          ? `Checked In (${String(bundle.todayAttendance.check_in_time_gst)} GST)`
                          : 'Awaiting QR Scan'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Connected to <strong>Betterway-Office-5G</strong>. Scan the Reception QR Stand to record your arrival for HR Lead <strong>Rahaba Azeez</strong>.
                    </p>
                    <form method="POST" action="/api/v1/actions" className="space-y-2 pt-1">
                      <input type="hidden" name="action" value="reception_qr_checkin" />
                      <input type="hidden" name="returnTo" value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}`} />
                      <input type="hidden" name="networkSsid" value="Betterway-Office-5G" />
                      <input type="hidden" name="qrStandCode" value="BW-RECEPTION-STAND-DXB-1" />
                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-[#021125] text-[#D7B04E] font-bold flex items-center justify-center gap-2 shadow-sm"
                      >
                        <QrCode className="h-4 w-4" />
                        Scan Office Reception QR Now
                      </button>
                    </form>
                  </div>

                  {/* Field Site Visit / DLD Trustee GPS Check-in */}
                  <div className="rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#021125]">
                      <MapPin className="h-4 w-4 text-[#8A6518]" />
                      Off-Site Viewing / DLD Trustee GPS Check-In
                    </div>
                    <form method="POST" action="/api/v1/actions" className="space-y-2">
                      <input type="hidden" name="action" value="mobile_enqueue_offline" />
                      <input type="hidden" name="returnTo" value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}`} />
                      <input type="hidden" name="userEmail" value={bundle.staff.email} />
                      <input type="hidden" name="deviceId" value={bundle.deviceId} />
                      <input type="hidden" name="actionType" value="SITE_VISIT_CHECKIN" />
                      <input type="hidden" name="targetTable" value="deals" />
                      <input
                        type="hidden"
                        name="targetId"
                        value={String(bundle.assignedDeals[0]?.id || 1)}
                      />
                      <input type="hidden" name="baseRecordVersion" value="1" />
                      <input
                        name="note"
                        defaultValue="Checked in at Al Manara DLD Trustee with Buyer & Manager Cheques"
                        className="bw-input text-[11px]"
                      />
                      <button type="submit" className="bw-btn-gold w-full justify-center py-2">
                        Queue GPS Field Check-In (Idempotent)
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 2: SCOPED PIPELINE (DEALS & LEADS) */}
              {activeTab === 'pipeline' && (
                <div className="space-y-2.5">
                  <div className="font-bold text-[#021125] flex items-center justify-between">
                    <span>Assigned Deals ({bundle.assignedDeals.length})</span>
                    <span className="text-[10px] text-slate-500 font-num">5m SLA Active</span>
                  </div>
                  {bundle.assignedDeals.map((d) => (
                    <div key={String(d.id)} className="rounded-xl bg-white p-3 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-num font-bold text-[#021125]">{String(d.deal_ref)}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-[#8A6518] border border-amber-200 text-[10px] font-bold">
                          {String(d.stage)}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-800">{String(d.client_name)}</div>
                      <div className="text-[11px] text-slate-500 flex justify-between font-num">
                        <span>{String(d.community_name)}</span>
                        <strong className="text-[#021125]">
                          AED {Math.round(Number(d.target_loan_fils || 0) / 100).toLocaleString()}
                        </strong>
                      </div>
                      <form method="POST" action="/api/v1/actions" className="pt-1 flex gap-1.5">
                        <input type="hidden" name="action" value="mobile_enqueue_offline" />
                        <input type="hidden" name="returnTo" value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}`} />
                        <input type="hidden" name="userEmail" value={bundle.staff.email} />
                        <input type="hidden" name="deviceId" value={bundle.deviceId} />
                        <input type="hidden" name="actionType" value="UPDATE_DEAL_NOTE" />
                        <input type="hidden" name="targetTable" value="deals" />
                        <input type="hidden" name="targetId" value={String(d.id)} />
                        <input type="hidden" name="baseRecordVersion" value="1" />
                        <input
                          name="note"
                          placeholder="Quick field note..."
                          required
                          className="bw-input text-[11px] py-1"
                        />
                        <button type="submit" className="bw-btn-navy text-[10px] px-2.5 py-1 shrink-0">
                          Save
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: MOBILE QUICK DBR & EMI CALCULATOR */}
              {activeTab === 'calc' && (
                <div className="rounded-2xl bg-white p-3.5 border border-slate-200 space-y-2.5">
                  <div className="font-bold text-[#021125] flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-[#8A6518]" />
                    Mobile CBUAE 50% DBR &amp; EMI Calculator
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10px] text-slate-500">Property Price (AED)</span>
                      <input
                        type="number"
                        value={priceAed}
                        onChange={(e) => setPriceAed(Number(e.target.value) || 0)}
                        className="bw-input font-num text-[11px] py-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-slate-500">Down Payment (%)</span>
                      <input
                        type="number"
                        value={downPct}
                        onChange={(e) => setDownPct(Number(e.target.value) || 20)}
                        className="bw-input font-num text-[11px] py-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-slate-500">Monthly Salary (AED)</span>
                      <input
                        type="number"
                        value={incomeAed}
                        onChange={(e) => setIncomeAed(Number(e.target.value) || 0)}
                        className="bw-input font-num text-[11px] py-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-slate-500">Rate (% p.a.)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={ratePct}
                        onChange={(e) => setRatePct(Number(e.target.value) || 3.89)}
                        className="bw-input font-num text-[11px] py-1"
                      />
                    </label>
                  </div>
                  <div className="rounded-xl bg-[#021125] text-white p-3 space-y-1 font-num">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Monthly EMI:</span>
                      <strong className="text-[#D7B04E]">AED {calc.mortgage.emi.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Stressed DBR (+2%):</span>
                      <strong className={calc.mortgage.dbrOk ? 'text-emerald-400' : 'text-rose-400'}>
                        {calc.mortgage.dbrPct.toFixed(1)}% ({calc.mortgage.dbrOk ? 'PASS ≤50%' : 'OVER 50%'})
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Total Cash to Close:</span>
                      <strong>AED {calc.costToClose.cashRequired.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RAHABA AZEEZ HR DESK & DAILY WORK REPORT */}
              {activeTab === 'hr' && (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white p-3.5 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <StaffAvatar name="Rahaba Azeez" email="rahaba@betterwaymortgages.com" size={32} />
                      <div>
                        <div className="font-bold text-[#021125]">Request to Rahaba Azeez (HR)</div>
                        <div className="text-[10px] text-slate-500">Salary Certificate, NOC, Leave &amp; Attendance</div>
                      </div>
                    </div>
                    <form method="POST" action="/api/v1/actions" className="space-y-2">
                      <input type="hidden" name="action" value="create_hr_operation_request" />
                      <input type="hidden" name="returnTo" value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}`} />
                      <input type="hidden" name="requesterEmail" value={bundle.staff.email} />
                      <select name="requestType" className="bw-input text-[11px] py-1.5">
                        <option value="SALARY_CERTIFICATE">Salary Certificate (MOHRE / Bank)</option>
                        <option value="EMPLOYMENT_NOC">Employer No Objection Certificate (NOC)</option>
                        <option value="LEAVE_REQUEST">Annual / Sick Leave Request</option>
                        <option value="LATE_ATTENDANCE_EXCUSE">10:05 AM Attendance / Client Visit Excuse</option>
                        <option value="VISA_RERA_RENEWAL">Visa / Emirates ID / RERA BRN Renewal</option>
                      </select>
                      <input
                        name="subject"
                        required
                        defaultValue="Official Salary Certificate for Personal Banking"
                        className="bw-input text-[11px] py-1.5"
                      />
                      <textarea
                        name="details"
                        rows={2}
                        defaultValue="Please issue stamped certificate from Document Studio."
                        className="bw-input text-[11px]"
                      />
                      <button type="submit" className="bw-btn-gold w-full justify-center py-2">
                        Send Request to Rahaba Azeez
                      </button>
                    </form>
                  </div>

                  <div className="rounded-2xl bg-white p-3.5 border border-slate-200 space-y-2">
                    <div className="font-bold text-[#021125]">End-of-Day Staff Work Report</div>
                    <form method="POST" action="/api/v1/actions" className="space-y-2">
                      <input type="hidden" name="action" value="submit_daily_report" />
                      <input type="hidden" name="returnTo" value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}`} />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input type="number" name="callsCount" defaultValue={16} placeholder="Calls" className="bw-input text-[11px] py-1" />
                        <input type="number" name="ipasSubmitted" defaultValue={2} placeholder="IPAs" className="bw-input text-[11px] py-1" />
                      </div>
                      <input
                        name="summaryNotes"
                        defaultValue="Completed client consultations, KFS pack, and bank BDM follow-up."
                        className="bw-input text-[11px] py-1"
                      />
                      <button type="submit" className="bw-btn-navy w-full justify-center py-2">
                        Submit Daily Report
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 5: OFFLINE SYNC QUEUE & CONFLICT RESOLVER */}
              {activeTab === 'sync' && (
                <div className="space-y-2.5">
                  <div className="rounded-xl bg-white p-3 border border-slate-200 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-[#8A6518]">
                      AES-256-GCM Scoped Bundle Checksum
                    </div>
                    <div className="font-num text-[11px] font-bold text-[#021125] break-all">
                      {bundle.encryptedChecksum}
                    </div>
                    <div className="flex gap-1.5">
                      <form method="POST" action="/api/v1/actions" className="flex-1">
                        <input type="hidden" name="action" value="mobile_replay_queue" />
                        <input type="hidden" name="returnTo" value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}`} />
                        <input type="hidden" name="userEmail" value={bundle.staff.email} />
                        <input type="hidden" name="deviceId" value={bundle.deviceId} />
                        <button type="submit" className="bw-btn-navy w-full justify-center py-1.5 text-[11px]">
                          <RefreshCw className="h-3.5 w-3.5" /> Replay Queue ({bundle.pendingSyncQueue.length})
                        </button>
                      </form>
                      <form method="POST" action="/api/v1/actions">
                        <input type="hidden" name="action" value="mobile_enqueue_offline" />
                        <input type="hidden" name="returnTo" value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}`} />
                        <input type="hidden" name="userEmail" value={bundle.staff.email} />
                        <input type="hidden" name="deviceId" value={bundle.deviceId} />
                        <input type="hidden" name="actionType" value="UPDATE_DEAL_NOTE" />
                        <input type="hidden" name="targetTable" value="deals" />
                        <input type="hidden" name="targetId" value="1" />
                        <input type="hidden" name="baseRecordVersion" value="0" />
                        <input type="hidden" name="note" value="Offline stale version edit test" />
                        <button type="submit" className="bw-btn-gold py-1.5 px-2.5 text-[11px]">
                          + Sim Conflict
                        </button>
                      </form>
                    </div>
                  </div>

                  {bundle.openConflicts.map((c) => (
                    <div key={String(c.id)} className="rounded-xl bg-rose-50 border border-rose-200 p-3 space-y-1.5">
                      <div className="font-bold text-rose-900">
                        Conflict {String(c.id)} · Base v{String(c.base_version)} vs Server v{String(c.server_version)}
                      </div>
                      <form method="POST" action="/api/v1/actions" className="flex gap-1.5">
                        <input type="hidden" name="action" value="mobile_resolve_conflict" />
                        <input type="hidden" name="returnTo" value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}`} />
                        <input type="hidden" name="conflictId" value={String(c.id)} />
                        <input type="hidden" name="resolution" value="ACCEPT_CLIENT" />
                        <button type="submit" className="bw-btn-navy text-[10px] py-1 px-2.5">
                          Accept Mobile Edit
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom iOS Tab Bar */}
            <div className="rounded-b-[30px] bg-[#021125] px-2 py-2.5 grid grid-cols-5 gap-1 text-center">
              {[
                { id: 'qr', label: 'QR Scan', icon: QrCode },
                { id: 'pipeline', label: 'Pipeline', icon: UserCheck },
                { id: 'calc', label: 'DBR Calc', icon: Calculator },
                { id: 'hr', label: 'Rahaba HR', icon: FileCheck2 },
                { id: 'sync', label: 'Sync', icon: RefreshCw },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as typeof activeTab)}
                    className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition ${
                      active ? 'text-[#D7B04E] bg-white/10 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px]">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Mobile Governance, Offline Queue Ledger & Quiet-Hours PDPL Lock-Screen Preview */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quiet-Hours Lock-Screen Redaction Card */}
          <div className="bw-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellOff className="h-5 w-5 text-[#8A6518]" />
                <div>
                  <h2 className="font-display font-bold text-base text-[#021125]">
                    PDPL Lock-Screen Redaction &amp; 21:00–08:00 GST Quiet Hours
                  </h2>
                  <p className="text-xs text-slate-500">
                    UAE Federal Decree-Law 45/2021 (PDPL): Borrower names, salaries, and Emirates IDs are never exposed on a locked phone screen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuietHoursSim((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-[#021125] text-[#D7B04E] text-xs font-bold"
              >
                {quietHoursSim ? 'Quiet Hours Active (21:00–08:00)' : 'Daytime Push Mode'}
              </button>
            </div>

            <div className="rounded-xl bg-[#021125] text-white p-4 border border-[#D7B04E]/40 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#D7B04E] font-bold">
                <span>LOCK SCREEN PREVIEW · FACE ID REQUIRED</span>
                <span>{quietHoursSim ? 'SILENCED (QUIET HOURS)' : 'BANNER ALERT'}</span>
              </div>
              <div className="text-xs text-slate-100 font-medium">{quietNotification.lockScreenText}</div>
            </div>
          </div>

          {/* Offline Action Queue & Conflict Resolution Table */}
          <div className="bw-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-base text-[#021125]">
                  Mobile Offline Sync Queue &amp; UUID Idempotency Ledger
                </h2>
                <p className="text-xs text-slate-500">
                  Field check-ins, call logs, and deal notes queue offline with UUID idempotency keys and version-merge conflict detection.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-num">
                {bundle.encryptedChecksum}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Queue ID</th>
                    <th className="py-2 px-3">Action Type</th>
                    <th className="py-2 px-3">Target</th>
                    <th className="py-2 px-3">Base Ver</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bundle.pendingSyncQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No offline actions queued yet — use the mobile simulator on the left to queue a GPS check-in or deal note.
                      </td>
                    </tr>
                  ) : (
                    bundle.pendingSyncQueue.map((q) => (
                      <tr key={String(q.id)}>
                        <td className="py-2 px-3 font-num font-bold text-[#021125]">{String(q.id)}</td>
                        <td className="py-2 px-3">{String(q.action_type)}</td>
                        <td className="py-2 px-3 font-num">
                          {String(q.target_table)} #{String(q.target_id)}
                        </td>
                        <td className="py-2 px-3 font-num">v{String(q.base_record_version)}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              q.sync_status === 'SYNCED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : q.sync_status === 'NEEDS_REVIEW'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {String(q.sync_status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Direct Quick Links to Connected OS Desks */}
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <Link href="/os/reception-qr" className="bw-card p-4 hover:border-[#D7B04E] transition">
              <QrCode className="h-5 w-5 text-[#8A6518] mb-1.5" />
              <div className="font-bold text-[#021125]">Reception QR Stand</div>
              <div className="text-slate-500 text-[11px] mt-0.5">10:05 AM GST Wi-Fi Stand</div>
            </Link>
            <Link href="/os/studio" className="bw-card p-4 hover:border-[#D7B04E] transition">
              <Sparkles className="h-5 w-5 text-[#8A6518] mb-1.5" />
              <div className="font-bold text-[#021125]">PDF &amp; Document Studio</div>
              <div className="text-slate-500 text-[11px] mt-0.5">HR Certificates &amp; Proposals</div>
            </Link>
            <Link href="/os/operations?tab=rahaba-hr" className="bw-card p-4 hover:border-[#D7B04E] transition">
              <ShieldCheck className="h-5 w-5 text-[#8A6518] mb-1.5" />
              <div className="font-bold text-[#021125]">Rahaba HR Operations</div>
              <div className="text-slate-500 text-[11px] mt-0.5">Attendance, NOCs &amp; Leaves</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

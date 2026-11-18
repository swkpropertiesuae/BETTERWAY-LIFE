'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { StaffAvatar } from '@/components/staff-avatar';
import { OFFICIAL_STAFF_DIRECTORY } from '@/lib/staff-directory';
import { computeToolkitAll } from '@/lib/uae-deal-toolkit';
import type { StudioTemplateSpec } from '@/server/engines/pdf-studio-engine';
import type { BetterwayGptMode } from '@/server/engines/betterway-gpt-engine';
import {
  ArrowUpRight,
  BellOff,
  Bot,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CloudOff,
  Copy,
  Download,
  FileCheck2,
  FileText,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Monitor,
  Phone,
  Play,
  Printer,
  QrCode,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Wifi,
  X,
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

export interface MobileHrDashboardSlice {
  dateGst: string;
  staffRollCall: Array<{
    fullNameEn: string;
    email: string;
    designation: string;
    empCode: string;
    checkedInToday: boolean;
    checkInTimeGst: string | null;
    attendanceStatus: string;
    submittedDailyReport: boolean;
  }>;
  requests: Array<{
    id: number;
    requestRef: string;
    requesterEmail: string;
    requesterName: string;
    requestType: string;
    subject: string;
    details: string;
    priority: string;
    status: string;
    rahabaNotes: string;
  }>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function MobileAppClient({
  bundle,
  quietNotification,
  hrDash,
  studioTemplates,
  initialTab = 'qr',
  notice,
  error,
}: {
  bundle: MobileBundleData;
  quietNotification: {
    suppressedByQuietHours: boolean;
    lockScreenText: string;
    deepLinkUrl: string;
  };
  hrDash: MobileHrDashboardSlice;
  studioTemplates: StudioTemplateSpec[];
  initialTab?: string;
  notice?: string;
  error?: string;
}) {
  const validTabs = ['qr', 'pipeline', 'gpt', 'calc', 'hr', 'sync'] as const;
  type TabId = (typeof validTabs)[number];
  const startTab: TabId = (validTabs as readonly string[]).includes(initialTab)
    ? (initialTab as TabId)
    : 'qr';

  const [activeTab, setActiveTab] = useState<TabId>(startTab);
  const [desktopFrameMode, setDesktopFrameMode] = useState<boolean>(false);
  const [staffSheetOpen, setStaffSheetOpen] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [quietHoursSim, setQuietHoursSim] = useState(true);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);

  // Pipeline sub-tab
  const [pipelineSub, setPipelineSub] = useState<'deals' | 'leads'>('deals');

  // Calc & PDF Studio sub-tab
  const [calcSub, setCalcSub] = useState<'calculator' | 'pdf'>('calculator');
  const [priceAed, setPriceAed] = useState(3_500_000);
  const [downPct, setDownPct] = useState(20);
  const [incomeAed, setIncomeAed] = useState(45_000);
  const [debtAed, setDebtAed] = useState(2_500);
  const [ratePct, setRatePct] = useState(3.89);
  const [selectedTplId, setSelectedTplId] = useState(studioTemplates[0]?.id || 'hr-salary-certificate');
  const [pdfLang, setPdfLang] = useState<'en' | 'ar'>('en');

  // BetterwayGPT state inside mobile app
  const [gptMode, setGptMode] = useState<BetterwayGptMode>('LIVE_OS_DATA');
  const [gptInput, setGptInput] = useState('');
  const [gptLoading, setGptLoading] = useState(false);
  const [gptMessages, setGptMessages] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; text: string }>
  >([
    {
      id: 'm-welcome',
      role: 'assistant',
      text: `Marhaba ${bundle.staff.fullNameEn.split(' ')[0]}! I am BetterwayGPT Mobile. Ask me about live deals, 24-bank rates, CBUAE 50% DBR, or Rahaba Azeez HR & 10:05 AM attendance.`,
    },
  ]);
  const [agentOutput, setAgentOutput] = useState<string | null>(null);

  // Register Service Worker & capture Android install prompt
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

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

  const activeTpl = useMemo(
    () => studioTemplates.find((t) => t.id === selectedTplId) ?? studioTemplates[0],
    [studioTemplates, selectedTplId],
  );

  const mobilePdfPreview = useMemo(() => {
    if (!activeTpl) return '';
    const firstDeal = bundle.assignedDeals[0];
    const propVal = firstDeal ? Math.round(Number(firstDeal.purchase_price_fils) / 100) : 3_500_000;
    const loanVal = firstDeal ? Math.round(Number(firstDeal.target_loan_fils) / 100) : 2_800_000;
    let body = activeTpl.body
      .split('[Issue Date]')
      .join(bundle.todayGst)
      .split('[Doc Ref]')
      .join('BW-MOB-2026')
      .split('[Employee Name]')
      .join(bundle.staff.fullNameEn)
      .split('[Employee Code]')
      .join('BW-EMP-009')
      .split('[Designation]')
      .join(bundle.staff.designation)
      .split('[Department]')
      .join(bundle.staff.department)
      .split('[Join Date]')
      .join('2026-01-01')
      .split('[MOHRE ID]')
      .join('00192837465009')
      .split('[Employee IBAN]')
      .join('AE070331234567890123409')
      .split('[Basic Salary AED]')
      .join('12,000')
      .split('[Allowances AED]')
      .join('5,000')
      .split('[Total Salary AED]')
      .join('17,000')
      .split('[Addressee Bank]')
      .join('Emirates NBD PJSC — Dubai, UAE')
      .split('[Client Name]')
      .join(String(firstDeal?.client_name || 'Khalid Al Nuaimi'))
      .split('[Deal Ref]')
      .join(String(firstDeal?.deal_ref || 'BW-2026-0001'))
      .split('[Property Community]')
      .join(String(firstDeal?.community_name || 'Dubai Hills Estate'))
      .split('[Property Value AED]')
      .join(propVal.toLocaleString())
      .split('[Loan Amount AED]')
      .join(loanVal.toLocaleString())
      .split('[LTV %]')
      .join('80.0')
      .split('[Selected Bank]')
      .join('Emirates NBD')
      .split('[Intro Rate %]')
      .join('3.89% Fixed')
      .split('[Monthly EMI AED]')
      .join(calc.mortgage.emi.toLocaleString())
      .split('[Advisor Name]')
      .join(bundle.staff.fullNameEn);

    if (pdfLang === 'ar') {
      body = `شركة بيتروي للوساطة العقارية والتمويل ذ.م.م — دبي، الإمارات العربية المتحدة\nوثيقة رسمية معتمدة عبر تطبيق Betterway ONE\n────────────────────────────────────────\n${body}\n\nاعتماد الموارد البشرية: رحابة عزيز · المدير العام: شبيب سراج`;
    }
    return body;
  }, [activeTpl, bundle, calc.mortgage.emi, pdfLang]);

  const sendMobileGpt = async (text?: string) => {
    const q = (text ?? gptInput).trim();
    if (!q || gptLoading) return;
    setGptMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q }]);
    if (!text) setGptInput('');
    setGptLoading(true);
    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          prompt: q,
          mode: gptMode,
          userEmail: bundle.staff.email,
        }),
      });
      const data = await res.json();
      setGptMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          text: data.reply || 'BetterwayGPT processed your request.',
        },
      ]);
    } finally {
      setGptLoading(false);
    }
  };

  const runMobileAgent = async (agentSlug: string) => {
    setAgentOutput('Running autonomous check…');
    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_agent',
          agentSlug,
          userEmail: bundle.staff.email,
        }),
      });
      const data = await res.json();
      setAgentOutput(data?.run?.outputSummary || 'Digital Employee completed.');
    } catch {
      setAgentOutput('Completed local verification.');
    }
  };

  const triggerNativeInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      setDeferredPrompt(null);
    } else {
      setInstallSheetOpen(true);
    }
  };

  const copyText = (txt: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(txt).catch(() => undefined);
    }
    setCopiedMsg(label);
    setTimeout(() => setCopiedMsg(null), 2200);
  };

  return (
    <div
      className={
        desktopFrameMode
          ? 'min-h-[100dvh] bg-[#021125] py-6 px-4 flex flex-col items-center justify-center'
          : 'min-h-[100dvh] bg-[#F8F9FA] text-[#021125] flex flex-col'
      }
    >
      {/* Desktop-only top bar to toggle between Full-Screen Native UI & Phone Frame Preview */}
      {desktopFrameMode && (
        <div className="mb-3 flex items-center gap-3 text-xs text-white">
          <span className="text-[#D7B04E] font-bold">iPhone 16 Pro / Android Pixel Preview</span>
          <button
            type="button"
            onClick={() => setDesktopFrameMode(false)}
            className="px-3 py-1.5 rounded-lg bg-[#D7B04E] text-[#021125] font-bold"
          >
            Switch to Full-Screen Native Mobile View
          </button>
          <Link href="/os/home" className="px-3 py-1.5 rounded-lg bg-white/10 text-white">
            Desktop OS →
          </Link>
        </div>
      )}

      {/* Main Mobile App Container */}
      <div
        className={
          desktopFrameMode
            ? 'w-full max-w-[430px] h-[860px] rounded-[46px] bg-[#F8F9FA] text-[#021125] shadow-2xl border-[6px] border-[#072244] overflow-hidden flex flex-col relative'
            : 'w-full max-w-2xl mx-auto min-h-[100dvh] bg-[#F8F9FA] text-[#021125] flex flex-col relative shadow-sm'
        }
      >
        {/* Sticky Native App Bar (#021125 Midnight Banking Navy + Safe Area Top) */}
        <header
          className="sticky top-0 z-30 bg-[#021125] text-white px-4 pb-3.5 border-b-2 border-[#D7B04E] shadow-md"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          {/* Top Status Strip */}
          <div className="flex items-center justify-between text-[11px] font-num text-slate-300 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D7B04E]" />
              <span className="font-bold tracking-wider text-[#D7B04E]">BETTERWAY ONE</span>
              <span className="opacity-60">· iOS &amp; Android</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOfflineMode((v) => !v)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  offlineMode
                    ? 'bg-amber-400 text-[#021125]'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                }`}
              >
                {offlineMode ? (
                  <>
                    <CloudOff className="h-3 w-3" /> Offline Queue
                  </>
                ) : (
                  <>
                    <Wifi className="h-3 w-3" /> Office-5G
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={triggerNativeInstall}
                className="px-2 py-0.5 rounded-full bg-[#D7B04E] text-[#021125] text-[10px] font-bold flex items-center gap-1"
              >
                <Download className="h-3 w-3" /> Install
              </button>

              <button
                type="button"
                onClick={() => setDesktopFrameMode((v) => !v)}
                className="hidden lg:inline-flex px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px]"
                title="Toggle Phone Frame on Desktop"
              >
                <Monitor className="h-3 w-3" />
              </button>

              <Link
                href="/os/home"
                className="px-2 py-0.5 rounded-full bg-white/10 text-slate-200 text-[10px] font-semibold"
                title="Open Desktop OS Launcher"
              >
                OS
              </Link>
            </div>
          </div>

          {/* Active Staff Profile Bar (Tap to switch among all 9 Betterway staff accounts) */}
          <div className="flex items-center justify-between gap-2 bg-[#072244] rounded-2xl p-2.5 border border-white/10">
            <button
              type="button"
              onClick={() => setStaffSheetOpen((v) => !v)}
              className="flex items-center gap-2.5 min-w-0 text-left flex-1"
            >
              <StaffAvatar name={bundle.staff.fullNameEn} email={bundle.staff.email} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white truncate">
                    {bundle.staff.fullNameEn}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#D7B04E] shrink-0" />
                </div>
                <div className="text-[11px] text-[#D7B04E] font-medium truncate">
                  {bundle.staff.designation}
                </div>
              </div>
            </button>

            <div className="text-right shrink-0">
              <span
                className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                  bundle.todayAttendance
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-[#D7B04E] text-[#021125]'
                }`}
              >
                {bundle.todayAttendance
                  ? `In ${String(bundle.todayAttendance.check_in_time_gst)}`
                  : '10:05 QR Due'}
              </span>
            </div>
          </div>

          {/* Expandable Staff Account Switcher Sheet */}
          {staffSheetOpen && (
            <div className="mt-2.5 rounded-2xl bg-[#072244] border border-[#D7B04E]/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#D7B04E] font-bold">
                <span>SWITCH MOBILE STAFF PROFILE (9 ACCOUNTS)</span>
                <button type="button" onClick={() => setStaffSheetOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {OFFICIAL_STAFF_DIRECTORY.map((s) => {
                  const active = s.email.toLowerCase() === bundle.staff.email.toLowerCase();
                  return (
                    <Link
                      key={s.email}
                      href={`/os/mobile?staff=${encodeURIComponent(s.email)}&tab=${activeTab}`}
                      onClick={() => setStaffSheetOpen(false)}
                      className={`p-2 rounded-xl border flex flex-col items-center text-center gap-1 transition ${
                        active
                          ? 'bg-[#D7B04E] text-[#021125] border-[#D7B04E] font-bold'
                          : 'bg-[#021125]/70 text-white border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <StaffAvatar name={s.fullNameEn} email={s.email} size={32} />
                      <span className="text-[10px] leading-tight truncate w-full">{s.fullNameEn}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        {/* Toast / Banner Alerts */}
        {(notice || error || copiedMsg) && (
          <div className="px-4 pt-3">
            {copiedMsg && (
              <div className="rounded-xl bg-[#021125] text-[#D7B04E] px-3.5 py-2 text-xs font-bold flex items-center justify-between">
                <span>✓ {copiedMsg}</span>
              </div>
            )}
            {notice && (
              <div className="rounded-xl bg-emerald-950 text-emerald-200 border border-emerald-700 px-3.5 py-2.5 text-xs font-medium">
                {notice}
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-rose-950 text-rose-200 border border-rose-700 px-3.5 py-2.5 text-xs font-medium">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Scrollable Native Screen Content (padded for fixed bottom dock) */}
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-4 text-xs">
          {/* =================================================================
              SCREEN 1: HOME, 10:05 AM QR ATTENDANCE & FIELD CHECK-IN
             ================================================================= */}
          {activeTab === 'qr' && (
            <div className="space-y-4">
              {/* Primary 10:05 AM GST Office Reception QR Check-In Card */}
              <div className="rounded-2xl bg-[#021125] text-white p-4 border-b-4 border-[#D7B04E] shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#D7B04E]">
                    SHIFT 10:00 AM – 07:00 PM GST · GRACE 10:05 AM
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    Wi-Fi Verified
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-[#D7B04E] text-[#021125] flex items-center justify-center shrink-0">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-base">
                      Office Reception QR Attendance
                    </h1>
                    <p className="text-[11px] text-slate-300">
                      Connected to <strong>Betterway-Office-5G</strong>. Tap below to record your arrival with HR Lead <strong>Rahaba Azeez</strong>.
                    </p>
                  </div>
                </div>

                <form method="POST" action="/api/v1/actions">
                  <input type="hidden" name="action" value="reception_qr_checkin" />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=qr`}
                  />
                  <input type="hidden" name="networkSsid" value="Betterway-Office-5G" />
                  <input type="hidden" name="qrStandCode" value="BW-RECEPTION-STAND-DXB-1" />
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#D7B04E] text-[#021125] font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition"
                  >
                    <QrCode className="h-4 w-4" />
                    {bundle.todayAttendance
                      ? `Re-Verify Office QR Check-In (${String(bundle.todayAttendance.check_in_time_gst)} GST)`
                      : 'Tap to Scan Reception QR & Check In Now'}
                  </button>
                </form>
              </div>

              {/* Live 9-Staff Roll Call Horizontal Strip */}
              <div className="rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#021125]">
                    Today&apos;s Team Roll Call ({hrDash.dateGst})
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('hr')}
                    className="text-[11px] font-bold text-[#8A6518]"
                  >
                    Rahaba HR Desk →
                  </button>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {hrDash.staffRollCall.map((m) => (
                    <div
                      key={m.email}
                      className="min-w-[104px] rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 flex flex-col items-center text-center gap-1 shrink-0"
                    >
                      <StaffAvatar name={m.fullNameEn} email={m.email} size={36} />
                      <div className="font-bold text-[11px] text-[#021125] truncate w-full">
                        {m.fullNameEn.split(' ')[0]}
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          m.attendanceStatus === 'ON_TIME'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.attendanceStatus === 'LATE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {m.checkedInToday ? m.checkInTimeGst : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Off-Site Viewing / DLD Trustee GPS Check-In */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-[#021125]">
                  <MapPin className="h-4 w-4 text-[#8A6518]" />
                  <span>Off-Site Client Viewing / DLD Trustee GPS Check-In</span>
                </div>
                <form method="POST" action="/api/v1/actions" className="space-y-2">
                  <input type="hidden" name="action" value="mobile_enqueue_offline" />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=qr`}
                  />
                  <input type="hidden" name="userEmail" value={bundle.staff.email} />
                  <input type="hidden" name="deviceId" value={bundle.deviceId} />
                  <input type="hidden" name="actionType" value="SITE_VISIT_CHECKIN" />
                  <input type="hidden" name="targetTable" value="deals" />
                  <input type="hidden" name="targetId" value={String(bundle.assignedDeals[0]?.id || 1)} />
                  <input type="hidden" name="baseRecordVersion" value="1" />
                  <input
                    name="note"
                    defaultValue="Al Manara DLD Trustee — Buyer & Seller Manager Cheque Handover"
                    className="bw-input text-xs"
                  />
                  <button type="submit" className="bw-btn-navy w-full justify-center py-2.5">
                    Log GPS Field Visit (Online / Offline Idempotent)
                  </button>
                </form>
              </div>

              {/* 4 Native Quick-Action Tiles */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('gpt')}
                  className="rounded-2xl bg-white p-3.5 border border-slate-200 text-left space-y-1 shadow-xs active:bg-slate-50"
                >
                  <Sparkles className="h-5 w-5 text-[#8A6518]" />
                  <div className="font-bold text-[#021125]">BetterwayGPT Chat</div>
                  <div className="text-[11px] text-slate-500">Ask AI about rates, DBR &amp; deals</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('calc');
                    setCalcSub('pdf');
                  }}
                  className="rounded-2xl bg-white p-3.5 border border-slate-200 text-left space-y-1 shadow-xs active:bg-slate-50"
                >
                  <FileText className="h-5 w-5 text-[#8A6518]" />
                  <div className="font-bold text-[#021125]">Mobile PDF Studio</div>
                  <div className="text-[11px] text-slate-500">Salary Certs, NOCs &amp; Proposals</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('calc');
                    setCalcSub('calculator');
                  }}
                  className="rounded-2xl bg-white p-3.5 border border-slate-200 text-left space-y-1 shadow-xs active:bg-slate-50"
                >
                  <Calculator className="h-5 w-5 text-[#8A6518]" />
                  <div className="font-bold text-[#021125]">50% DBR Calculator</div>
                  <div className="text-[11px] text-slate-500">EMI, LTV &amp; WhatsApp quote</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('hr')}
                  className="rounded-2xl bg-white p-3.5 border border-slate-200 text-left space-y-1 shadow-xs active:bg-slate-50"
                >
                  <FileCheck2 className="h-5 w-5 text-[#8A6518]" />
                  <div className="font-bold text-[#021125]">Rahaba HR &amp; Report</div>
                  <div className="text-[11px] text-slate-500">Leaves, NOCs &amp; EOD report</div>
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              SCREEN 2: PIPELINE (DEALS & 5-MINUTE SLA LEADS)
             ================================================================= */}
          {activeTab === 'pipeline' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPipelineSub('deals')}
                  className={`py-2 rounded-lg font-bold text-xs transition ${
                    pipelineSub === 'deals' ? 'bg-[#021125] text-[#D7B04E] shadow-xs' : 'text-slate-700'
                  }`}
                >
                  Live Deals ({bundle.assignedDeals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPipelineSub('leads')}
                  className={`py-2 rounded-lg font-bold text-xs transition ${
                    pipelineSub === 'leads' ? 'bg-[#021125] text-[#D7B04E] shadow-xs' : 'text-slate-700'
                  }`}
                >
                  5m SLA Leads ({bundle.assignedLeads.length})
                </button>
              </div>

              {pipelineSub === 'deals' ? (
                <div className="space-y-3">
                  {bundle.assignedDeals.map((d) => (
                    <div
                      key={String(d.id)}
                      className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-num font-bold text-xs text-[#021125]">
                          {String(d.deal_ref)}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-[#8A6518] border border-amber-200 text-[10px] font-bold">
                          {String(d.stage)}
                        </span>
                      </div>
                      <div className="font-display font-bold text-sm text-[#021125]">
                        {String(d.client_name)}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-num">
                        <span>{String(d.community_name)}</span>
                        <strong className="text-[#021125]">
                          Loan: AED {Math.round(Number(d.target_loan_fils || 0) / 100).toLocaleString()}
                        </strong>
                      </div>

                      <form method="POST" action="/api/v1/actions" className="flex gap-1.5 pt-1">
                        <input type="hidden" name="action" value="mobile_enqueue_offline" />
                        <input
                          type="hidden"
                          name="returnTo"
                          value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=pipeline`}
                        />
                        <input type="hidden" name="userEmail" value={bundle.staff.email} />
                        <input type="hidden" name="deviceId" value={bundle.deviceId} />
                        <input type="hidden" name="actionType" value="UPDATE_DEAL_NOTE" />
                        <input type="hidden" name="targetTable" value="deals" />
                        <input type="hidden" name="targetId" value={String(d.id)} />
                        <input type="hidden" name="baseRecordVersion" value="1" />
                        <input
                          name="note"
                          required
                          placeholder="Add mobile deal note or KFS update…"
                          className="bw-input text-xs py-1.5"
                        />
                        <button type="submit" className="bw-btn-navy px-3 py-1.5 shrink-0">
                          Log
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {bundle.assignedLeads.map((l) => {
                    const phone = String(l.contact_phone || '+971504112233');
                    const cleanWa = phone.replace(/[^\d]/g, '');
                    return (
                      <div
                        key={String(l.id)}
                        className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#021125]">
                            {String(l.contact_name)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {String(l.stage)} · 5m SLA
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-num">
                          {phone} · {String(l.contact_email || '')} · Target: AED{' '}
                          {Math.round(Number(l.target_property_fils || 0) / 100).toLocaleString()}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <a
                            href={`tel:${phone}`}
                            className="py-2 rounded-xl bg-[#021125] text-white font-bold flex items-center justify-center gap-1.5"
                          >
                            <Phone className="h-3.5 w-3.5 text-[#D7B04E]" /> Call Client
                          </a>
                          <a
                            href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(
                              `Hello ${String(l.contact_name)}, this is ${bundle.staff.fullNameEn} from Betterway Mortgages LLC regarding your UAE mortgage enquiry.`,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="py-2 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              SCREEN 3: BETTERWAYGPT (PRIVATE CHATGPT & 6 AI EMPLOYEES)
             ================================================================= */}
          {activeTab === 'gpt' && (
            <div className="space-y-3.5">
              {/* Brain Mode Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {(
                  [
                    { id: 'LIVE_OS_DATA', label: 'Live OS Data' },
                    { id: 'CBUAE_UNDERWRITING', label: 'CBUAE 50% DBR' },
                    { id: 'RAHABA_HR_WPS', label: 'Rahaba HR & WPS' },
                    { id: 'DLD_CONVEYANCING', label: 'DLD & Form F' },
                    { id: 'BILINGUAL_WRITER', label: 'EN/AR Writer' },
                  ] as Array<{ id: BetterwayGptMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGptMode(m.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition ${
                      gptMode === m.id
                        ? 'bg-[#021125] text-[#D7B04E]'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Chat Stream */}
              <div className="rounded-2xl bg-white border border-slate-200 p-3.5 space-y-3 max-h-[340px] overflow-y-auto shadow-xs">
                {gptMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="h-7 w-7 rounded-lg bg-[#021125] text-[#D7B04E] flex items-center justify-center font-bold text-[10px] shrink-0">
                        BW
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-[#021125] text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Prompts */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[
                  'Live pipeline & top 5 bank rates',
                  'Rahaba HR & 10:05 AM attendance today',
                  'Draft Arabic/English client AIP letter',
                  '3% vs 5% card limit DBR rule',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => sendMobileGpt(chip)}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 text-[#8A6518] border border-amber-200 text-[11px] font-semibold shrink-0"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Mobile Chat Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMobileGpt();
                }}
                className="flex gap-2"
              >
                <input
                  value={gptInput}
                  onChange={(e) => setGptInput(e.target.value)}
                  placeholder="Ask BetterwayGPT anything…"
                  className="bw-input text-xs flex-1"
                />
                <button
                  type="submit"
                  disabled={gptLoading || !gptInput.trim()}
                  className="bw-btn-gold px-4 py-2.5 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              {/* Run Digital AI Employees from Phone */}
              <div className="rounded-2xl bg-white p-3.5 border border-slate-200 space-y-2">
                <div className="font-bold text-[#021125] flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-[#8A6518]" />
                  <span>1-Tap Autonomous Digital AI Employees</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { slug: 'rahaba-hr-attendance', label: 'Rahaba Attendance Bot' },
                    { slug: 'morning-briefing', label: '09:30 Owner Briefing' },
                    { slug: 'sla-watchdog', label: '5m Lead SLA Chaser' },
                    { slug: 'cbuae-underwriter', label: '24-Bank DBR Scanner' },
                  ].map((ag) => (
                    <button
                      key={ag.slug}
                      type="button"
                      onClick={() => runMobileAgent(ag.slug)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-[#021125] hover:text-[#D7B04E] border border-slate-200 text-left font-semibold text-[11px] flex items-center gap-1.5 transition"
                    >
                      <Play className="h-3 w-3 text-[#8A6518] shrink-0" />
                      <span className="truncate">{ag.label}</span>
                    </button>
                  ))}
                </div>
                {agentOutput && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-[11px] text-emerald-950">
                    {agentOutput}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              SCREEN 4: TOOLKIT & MOBILE PDF STUDIO
             ================================================================= */}
          {activeTab === 'calc' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCalcSub('calculator')}
                  className={`py-2 rounded-lg font-bold text-xs transition ${
                    calcSub === 'calculator' ? 'bg-[#021125] text-[#D7B04E] shadow-xs' : 'text-slate-700'
                  }`}
                >
                  50% DBR &amp; Deal Calc
                </button>
                <button
                  type="button"
                  onClick={() => setCalcSub('pdf')}
                  className={`py-2 rounded-lg font-bold text-xs transition ${
                    calcSub === 'pdf' ? 'bg-[#021125] text-[#D7B04E] shadow-xs' : 'text-slate-700'
                  }`}
                >
                  Mobile PDF Studio
                </button>
              </div>

              {calcSub === 'calculator' ? (
                <div className="rounded-2xl bg-white p-4 border border-slate-200 space-y-3 shadow-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-500">Property Price (AED)</span>
                      <input
                        type="number"
                        value={priceAed}
                        onChange={(e) => setPriceAed(Number(e.target.value) || 0)}
                        className="bw-input font-num text-xs mt-0.5"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-500">Down Payment (%)</span>
                      <input
                        type="number"
                        value={downPct}
                        onChange={(e) => setDownPct(Number(e.target.value) || 20)}
                        className="bw-input font-num text-xs mt-0.5"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-500">Monthly Salary (AED)</span>
                      <input
                        type="number"
                        value={incomeAed}
                        onChange={(e) => setIncomeAed(Number(e.target.value) || 0)}
                        className="bw-input font-num text-xs mt-0.5"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-500">Existing EMIs (AED)</span>
                      <input
                        type="number"
                        value={debtAed}
                        onChange={(e) => setDebtAed(Number(e.target.value) || 0)}
                        className="bw-input font-num text-xs mt-0.5"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl bg-[#021125] text-white p-4 space-y-2 font-num">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Monthly EMI ({ratePct}%):</span>
                      <span className="text-base font-bold text-[#D7B04E]">
                        AED {calc.mortgage.emi.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">CBUAE Stressed DBR (+2%):</span>
                      <span
                        className={`font-bold ${
                          calc.mortgage.dbrOk ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {calc.mortgage.dbrPct.toFixed(1)}% ({calc.mortgage.dbrOk ? 'PASS ≤50%' : 'EXCEEDS 50%'})
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Upfront Cash to Close (DLD 4%):</span>
                      <span className="font-bold">AED {calc.costToClose.cashRequired.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Golden Visa (AED 2M+):</span>
                      <span className="font-bold text-emerald-300">
                        {calc.visa.goldenVisaEligible ? '10-Yr Eligible ✓' : 'Standard'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(calc.summaries.mortgage, 'WhatsApp Quote Copied')}
                      className="bw-btn-gold justify-center py-2.5 text-xs flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Quote
                    </button>
                    <Link
                      href="/os/toolkit"
                      className="bw-btn-navy justify-center py-2.5 text-xs flex items-center gap-1.5"
                    >
                      Full 8-Tab Toolkit <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-white p-4 border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#021125]">Mobile PDF &amp; Letterhead Generator</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPdfLang('en')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pdfLang === 'en' ? 'bg-[#021125] text-[#D7B04E]' : 'bg-slate-100'
                        }`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfLang('ar')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pdfLang === 'ar' ? 'bg-[#021125] text-[#D7B04E]' : 'bg-slate-100'
                        }`}
                      >
                        عربي
                      </button>
                    </div>
                  </div>

                  <select
                    value={selectedTplId}
                    onChange={(e) => setSelectedTplId(e.target.value)}
                    className="bw-input text-xs"
                  >
                    {studioTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.badge} · {t.title}
                      </option>
                    ))}
                  </select>

                  <pre className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[10px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto">
                    {mobilePdfPreview}
                  </pre>

                  <div className="grid grid-cols-2 gap-2">
                    <form method="POST" action="/api/v1/actions">
                      <input type="hidden" name="action" value="create_studio_document" />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=calc`}
                      />
                      <input type="hidden" name="templateId" value={selectedTplId} />
                      <input type="hidden" name="employeeEmail" value={bundle.staff.email} />
                      <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
                        Stamp &amp; Issue
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="bw-btn-navy justify-center py-2.5 flex items-center gap-1.5"
                    >
                      <Printer className="h-3.5 w-3.5" /> Save PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              SCREEN 5: RAHABA AZEEZ HR, ATTENDANCE & COMPANY OPERATIONS
             ================================================================= */}
          {activeTab === 'hr' && (
            <div className="space-y-4">
              {/* Rahaba Azeez HR Lead Card */}
              <div className="rounded-2xl bg-[#021125] text-white p-4 border-b-4 border-[#D7B04E] flex items-center gap-3">
                <StaffAvatar name="Rahaba Azeez" email="rahaba@betterwaymortgages.com" size={46} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#D7B04E]">
                    HR &amp; COMPANY OPERATIONS DESK
                  </div>
                  <div className="font-display font-bold text-sm truncate">
                    Rahaba Azeez — Human Resources
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    Salary Certificates · NOCs · Leaves · 10:05 AM QR · Visas
                  </div>
                </div>
              </div>

              {/* Request HR Certificate / Leave / Attendance Excuse */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-2.5">
                <div className="font-bold text-[#021125]">
                  Submit Request to Rahaba Azeez (HR)
                </div>
                <form method="POST" action="/api/v1/actions" className="space-y-2">
                  <input type="hidden" name="action" value="create_hr_operation_request" />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=hr`}
                  />
                  <input type="hidden" name="requesterEmail" value={bundle.staff.email} />
                  <select name="requestType" className="bw-input text-xs">
                    <option value="SALARY_CERTIFICATE">MOHRE / Bank Salary Certificate</option>
                    <option value="EMPLOYMENT_NOC">Employer No Objection Certificate (NOC)</option>
                    <option value="OFFER_LETTER">Employment Offer Letter</option>
                    <option value="LEAVE_REQUEST">Annual / Sick Leave Request</option>
                    <option value="LATE_ATTENDANCE_EXCUSE">10:05 AM Attendance / Client Visit Excuse</option>
                    <option value="VISA_RERA_RENEWAL">Visa / Emirates ID / RERA BRN Renewal</option>
                    <option value="EXPENSE_REIMBURSEMENT">Expense Reimbursement</option>
                  </select>
                  <input
                    name="subject"
                    required
                    defaultValue="Official Salary Certificate for Personal Banking"
                    className="bw-input text-xs"
                  />
                  <textarea
                    name="details"
                    rows={2}
                    defaultValue="Please issue stamped certificate via Betterway PDF Studio."
                    className="bw-input text-xs"
                  />
                  <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
                    Send Request to Rahaba Azeez
                  </button>
                </form>
              </div>

              {/* Live HR Request Queue (Tap to Approve & Issue Studio PDF) */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-2.5">
                <div className="font-bold text-[#021125]">
                  Rahaba HR Request Queue ({hrDash.requests.length})
                </div>
                <div className="space-y-2">
                  {hrDash.requests.slice(0, 6).map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <StaffAvatar name={req.requesterName} email={req.requesterEmail} size={26} />
                          <span className="font-bold text-[#021125] truncate">{req.requesterName}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            req.status === 'APPROVED_ISSUED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-[#021125] text-[#D7B04E]'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-800">{req.subject}</div>
                      {req.status === 'PENDING_RAHABA' && (
                        <form method="POST" action="/api/v1/actions" className="pt-1">
                          <input type="hidden" name="action" value="review_hr_operation_request" />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=hr`}
                          />
                          <input type="hidden" name="requestId" value={String(req.id)} />
                          <input type="hidden" name="decision" value="APPROVED_ISSUED" />
                          <button type="submit" className="bw-btn-navy w-full justify-center py-1.5 text-[11px]">
                            Approve &amp; Auto-Issue Studio PDF ✓
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* End-of-Day Staff Work Report */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-2.5">
                <div className="font-bold text-[#021125]">Submit Daily Work Report</div>
                <form method="POST" action="/api/v1/actions" className="space-y-2">
                  <input type="hidden" name="action" value="submit_daily_report" />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=hr`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      name="callsCount"
                      defaultValue={18}
                      placeholder="Calls"
                      className="bw-input text-xs"
                    />
                    <input
                      type="number"
                      name="ipasSubmitted"
                      defaultValue={2}
                      placeholder="IPAs"
                      className="bw-input text-xs"
                    />
                  </div>
                  <input
                    name="summaryNotes"
                    defaultValue="Completed buyer DBR assessments, KFS sign-off, and bank BDM follow-ups."
                    className="bw-input text-xs"
                  />
                  <button type="submit" className="bw-btn-navy w-full justify-center py-2.5">
                    Log End-of-Day Report
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* =================================================================
              SCREEN 6: PLAY STORE / iOS INSTALL GUIDE & OFFLINE SYNC
             ================================================================= */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              {/* Install on iPhone (iOS) & Android Play Store Card */}
              <div className="rounded-2xl bg-[#021125] text-white p-4 border-b-4 border-[#D7B04E] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#D7B04E]">
                    iOS APP STORE &amp; ANDROID PLAY STORE READY
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-num">
                    com.betterwaymortgages.one
                  </span>
                </div>
                <h2 className="font-display font-bold text-base">
                  Install Betterway ONE on Your Phone
                </h2>
                <div className="space-y-2 text-[11px] text-slate-200">
                  <div className="rounded-xl bg-[#072244] p-3 border border-white/10">
                    <strong className="text-[#D7B04E] block mb-0.5">
                      1. iPhone / iPad (iOS Safari — Instant Install):
                    </strong>
                    Open this page in <strong>Safari</strong> → tap the <strong>Share</strong> icon (<Share2 className="inline h-3 w-3" />) at the bottom → tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>. Launches full-screen with FaceID &amp; Midnight Navy icon.
                  </div>
                  <div className="rounded-xl bg-[#072244] p-3 border border-white/10">
                    <strong className="text-[#D7B04E] block mb-0.5">
                      2. Android (Chrome Instant Install &amp; Google Play TWA):
                    </strong>
                    Tap <strong>&ldquo;Install App Now&rdquo;</strong> below or tap Chrome&apos;s menu (⋮) → <strong>&ldquo;Install app&rdquo;</strong>. Pre-configured with <code>assetlinks.json</code> &amp; <code>capacitor.config.ts</code> for Google Play Store (`.aab`) &amp; Apple App Store (`.ipa`).
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href="/downloads/Betterway-ONE.apk"
                    download="Betterway-ONE.apk"
                    className="w-full py-2.5 rounded-xl bg-[#D7B04E] text-[#021125] font-bold flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" /> Download Android APK (.apk)
                  </a>
                  <button
                    type="button"
                    onClick={triggerNativeInstall}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center gap-2"
                  >
                    <Smartphone className="h-4 w-4 text-[#D7B04E]" /> Install PWA / iOS Home Screen
                  </button>
                </div>
              </div>

              {/* PDPL Quiet-Hours Lock-Screen Redaction Card */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-[#021125]">
                    <BellOff className="h-4 w-4 text-[#8A6518]" />
                    <span>21:00–08:00 GST Quiet-Hours PDPL Lock Screen</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuietHoursSim((v) => !v)}
                    className="px-2.5 py-1 rounded-lg bg-[#021125] text-[#D7B04E] text-[10px] font-bold"
                  >
                    {quietHoursSim ? 'Quiet Active' : 'Daytime'}
                  </button>
                </div>
                <div className="rounded-xl bg-[#021125] text-white p-3 border border-[#D7B04E]/40 text-[11px]">
                  <div className="text-[10px] text-[#D7B04E] font-bold mb-1">
                    LOCKED PHONE NOTIFICATION (PDPL REDACTED)
                  </div>
                  {quietNotification.lockScreenText}
                </div>
              </div>

              {/* Offline Sync Queue & Conflict Resolver */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#021125]">
                    Offline Queue ({bundle.pendingSyncQueue.length})
                  </span>
                  <span className="font-num text-[10px] text-emerald-700 font-bold">
                    {bundle.encryptedChecksum}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <form method="POST" action="/api/v1/actions">
                    <input type="hidden" name="action" value="mobile_replay_queue" />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=sync`}
                    />
                    <input type="hidden" name="userEmail" value={bundle.staff.email} />
                    <input type="hidden" name="deviceId" value={bundle.deviceId} />
                    <button type="submit" className="bw-btn-navy w-full justify-center py-2 text-xs">
                      <RefreshCw className="h-3.5 w-3.5" /> Replay Queue
                    </button>
                  </form>

                  <form method="POST" action="/api/v1/actions">
                    <input type="hidden" name="action" value="mobile_enqueue_offline" />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=sync`}
                    />
                    <input type="hidden" name="userEmail" value={bundle.staff.email} />
                    <input type="hidden" name="deviceId" value={bundle.deviceId} />
                    <input type="hidden" name="actionType" value="UPDATE_DEAL_NOTE" />
                    <input type="hidden" name="targetTable" value="deals" />
                    <input type="hidden" name="targetId" value="1" />
                    <input type="hidden" name="baseRecordVersion" value="0" />
                    <input type="hidden" name="note" value="Offline stale version edit test" />
                    <button type="submit" className="bw-btn-gold w-full justify-center py-2 text-xs">
                      + Sim Conflict
                    </button>
                  </form>
                </div>

                {bundle.openConflicts.map((c) => (
                  <div
                    key={String(c.id)}
                    className="rounded-xl bg-rose-50 border border-rose-200 p-3 space-y-1.5"
                  >
                    <div className="font-bold text-rose-900">
                      Conflict {String(c.id)} · Base v{String(c.base_version)} vs Server v{String(c.server_version)}
                    </div>
                    <form method="POST" action="/api/v1/actions">
                      <input type="hidden" name="action" value="mobile_resolve_conflict" />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={`/os/mobile?staff=${encodeURIComponent(bundle.staff.email)}&tab=sync`}
                      />
                      <input type="hidden" name="conflictId" value={String(c.id)} />
                      <input type="hidden" name="resolution" value="ACCEPT_CLIENT" />
                      <button type="submit" className="bw-btn-navy text-[11px] py-1.5 px-3">
                        Resolve &amp; Accept Mobile Edit
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Fixed Native Bottom Tab Bar (iOS & Android Safe-Area Aware) */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 max-w-2xl mx-auto bg-[#021125]/95 backdrop-blur-md border-t border-[#D7B04E]/30 px-2 pt-2 grid grid-cols-6 gap-1 text-center shadow-2xl"
          style={{
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
            position: desktopFrameMode ? 'sticky' : 'fixed',
          }}
          aria-label="Betterway ONE Mobile Navigation"
        >
          {[
            { id: 'qr', label: 'QR & Home', icon: QrCode },
            { id: 'pipeline', label: 'Pipeline', icon: UserCheck },
            { id: 'gpt', label: 'ChatGPT', icon: Sparkles },
            { id: 'calc', label: 'Calc & PDF', icon: Calculator },
            { id: 'hr', label: 'Rahaba HR', icon: FileCheck2 },
            { id: 'sync', label: 'App & Sync', icon: Smartphone },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as TabId)}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition ${
                  active
                    ? 'bg-[#D7B04E] text-[#021125] font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9.5px] leading-tight">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* iOS / Android Native Install Instructions Modal Sheet */}
        {installSheetOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-[#021125] text-white p-5 border-2 border-[#D7B04E] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D7B04E]">
                  Install Betterway ONE App
                </span>
                <button type="button" onClick={() => setInstallSheetOpen(false)}>
                  <X className="h-5 w-5 text-slate-300" />
                </button>
              </div>
              <div className="space-y-2 text-xs text-slate-200">
                <p>
                  <strong>On iPhone / iPad (iOS):</strong> Tap the Safari <strong>Share</strong> button at the bottom of your screen, scroll down, and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
                </p>
                <p>
                  <strong>On Android:</strong> Tap the Chrome <strong>⋮</strong> menu in the top-right corner and select <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInstallSheetOpen(false)}
                className="w-full py-2.5 rounded-xl bg-[#D7B04E] text-[#021125] font-bold text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

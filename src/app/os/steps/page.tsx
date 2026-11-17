import Link from 'next/link';
import { requireStaffUser } from '@/server/auth/request';
import { STEP_WORKFLOWS } from '@/lib/step-workflows';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  {
    key: 'Morning & Leads' as const,
    badge: 'Part 1 · Steps 01 to 05',
    title: 'Morning Check-In, New Clients & Dubai Area Guide',
    desc: 'Start your day with the 10:00 AM QR check-in, add new client inquiries, call them within 5 minutes, and check Dubai area prices.',
  },
  {
    key: 'ID Check & Bank Approval' as const,
    badge: 'Part 2 · Steps 06 to 11',
    title: 'Payment Calculator, Client ID Check & 24-Bank Pre-Approval',
    desc: 'Calculate monthly payments, sign the client consent form (KFS), verify ID, and compare all 24 UAE banks.',
  },
  {
    key: 'Property Transfer & Payout' as const,
    badge: 'Part 3 · Steps 12 to 16',
    title: 'Final Bank Offer, Property Valuation, DLD Cheques & 50/50 Commission',
    desc: 'Record the bank Final Offer Letter, check valuation & Developer NOC, prepare DLD Trustee cheques, and split commission 50/50.',
  },
  {
    key: 'Daily Report & Owner Control' as const,
    badge: 'Part 4 · Steps 17 to 20',
    title: 'Safe Refunds, End-of-Day Work Report & Owner Shabib Siraj Approvals',
    desc: 'Handle deal cancellations safely, submit your 7:00 PM daily report, and manage the Pending Delete Bin & Owner approvals.',
  },
];

export default async function StepByStepDirectoryPage() {
  const user = await requireStaffUser();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Plain-English Hero Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5" />
              Standard Operating Procedures
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3">
              Follow Every Task Step by Step (1 to 20)
            </h1>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Welcome, <strong>{user.full_name_en}</strong>. Every single feature has its own simple, dedicated page
              below. Click <strong>Step 1</strong> to start from the beginning, or click any step button to open that
              exact task with clear instructions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <Link
              href="/os/steps/check-in"
              className="inline-flex items-center justify-center px-5 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition"
            >
              Start at Step 01 (Morning Check-In)
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/os/steps/add-lead"
              className="inline-flex items-center justify-center px-5 py-3 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold transition"
            >
              Jump to Step 02 (Add New Client)
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Simple Parts with Dedicated Step Cards */}
      {CATEGORIES.map((cat) => {
        const steps = STEP_WORKFLOWS.filter((s) => s.category === cat.key);
        return (
          <section key={cat.key} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">{cat.badge}</span>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">{cat.title}</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{cat.desc}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {steps.map((step) => (
                <div
                  key={step.slug}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 font-num">
                        STEP {String(step.stepNumber).padStart(2, '0')} OF 20
                      </span>
                      <Link
                        href={step.fullModuleHref}
                        className="text-[11px] font-medium text-gray-400 hover:text-gray-700 underline"
                      >
                        {step.fullModuleLabel}
                      </Link>
                    </div>

                    <h3 className="text-base font-bold text-gray-900 mt-3">{step.title}</h3>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{step.whatIsThis}</p>

                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Operational Procedure:
                      </div>
                      {step.howToFollow.map((line, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-slate-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>{i + 1}.</strong> {line}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <Link
                      href={`/os/steps/${step.slug}`}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition w-full"
                    >
                      Open Step {String(step.stepNumber).padStart(2, '0')} Page &amp; Execute
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

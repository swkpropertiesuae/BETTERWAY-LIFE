import Link from 'next/link';
import { requireStaffUser } from '@/server/auth/request';
import { ODOO_APPS } from '@/lib/odoo-apps';
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Layers, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SingleDivisionWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffUser();
  const { id } = await params;
  const app = ODOO_APPS.find((a) => a.id === id) ?? ODOO_APPS[0]!;
  const firstStep = app.subApps[0]!;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Odoo Form Sheet Header + Smart Stat Buttons + Arrow Statusbar */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {/* Top Action & Statusbar Row */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={firstStep.href} className="bw-btn-navy">
              <span>Launch Stage 01: {firstStep.title}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href={app.primaryHref} className="bw-btn-ghost">
              <span>Open Master Register</span>
            </Link>
            <Link
              href="/os"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All Applications</span>
            </Link>
          </div>

          {/* Odoo Pipeline Statusbar */}
          <div className="flex items-center overflow-x-auto">
            {app.subApps.map((sub, idx) => (
              <Link
                key={sub.href}
                href={sub.href}
                className={`px-2.5 py-1 text-[11px] font-medium border-y first:border-l first:rounded-l last:border-r last:rounded-r border-r flex items-center gap-1.5 whitespace-nowrap transition ${
                  idx === 0
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`font-num text-[10px] font-bold ${idx === 0 ? 'text-[#d4b475]' : 'text-slate-400'}`}>
                  0{idx + 1}
                </span>
                <span>{sub.title}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Sheet Title + Odoo Smart Stat Buttons (Top-Right) */}
        <div className="p-6 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="font-num text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {app.code} · Isolated Application Sheet
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{app.name}</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">{app.tagline}</p>
          </div>

          {/* Odoo Smart Stat Buttons */}
          <div className="flex flex-wrap gap-2">
            <div className="px-3.5 py-2 rounded-md border border-slate-200 bg-slate-50 flex items-center gap-2.5">
              <Layers className="h-4 w-4 text-slate-600" />
              <div>
                <div className="font-num text-sm font-bold text-slate-900 leading-none">{app.subApps.length}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Workbenches</div>
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-md border border-slate-200 bg-slate-50 flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <div>
                <div className="text-xs font-bold text-slate-900 leading-none">Active</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Blueprint Gate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Zoho Blueprint Sequential Workbenches Inside the Sheet */}
        <div className="px-6 pb-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 pb-2 border-b border-slate-100">
            Sequential Blueprint Stages &amp; Workbenches ({app.subApps.length})
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {app.subApps.map((sub, idx) => (
              <Link
                key={sub.href}
                href={sub.href}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-900 hover:shadow-sm transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 text-white font-num text-[10px] font-bold">
                      <span>STAGE 0{idx + 1}</span>
                      <span className="text-[#d4b475]">· {sub.code}</span>
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-slate-300 group-hover:text-slate-900 transition" />
                  </div>

                  <h2 className="text-sm font-bold text-slate-900 mt-3">{sub.title}</h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{sub.desc}</p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs font-semibold text-slate-800 group-hover:text-slate-950">
                  <span>Open Stage 0{idx + 1}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { OsBanner } from '@/components/os-banner';
import { canPrintReceptionQr } from '@/server/engines/swk-enterprise-engine';

export const dynamic = 'force-dynamic';

const OFFICE_RECEPTION_QR_TOKEN = 'BW-RECEPTION-STAND-DXB-1';

export default async function ReceptionQrPage({
  searchParams,
}: {
  searchParams: Promise<{ print?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const sp = await searchParams;
  const wantsPoster = sp.print === '1';
  const allowedToPrint = canPrintReceptionQr(user);

  const db = getDb();
  const attendanceLogs = db
    .prepare('SELECT * FROM office_attendance_logs ORDER BY id DESC LIMIT 25')
    .all() as Array<Record<string, unknown>>;

  const contemptorAlerts = db
    .prepare('SELECT * FROM late_contemptor_alerts ORDER BY id DESC LIMIT 10')
    .all() as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Header Banner */}
      <div className="rounded-2xl bg-white text-gray-900 p-6 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">
            Step 10 · Office Attendance &amp; Punctuality Enforcement
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
            Office Reception QR Attendance &amp; Working Hours
          </h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Mon–Fri <code>10:00 AM – 7:00 PM</code> · Sat <code>10:00 AM – 4:00 PM</code> · Sun Holiday. Grace window
            until <code>10:05 AM</code>. Three or more late arrivals in 7 days automatically alert Supreme Owner{' '}
            <strong>Shabib Siraj</strong> and Operations Manager <strong>Mohammad Haseeb</strong>.
          </p>
        </div>

        {/* HARD RULE: Only Owner Shabib Siraj, Admin, or Operations Manager Mohammad Haseeb can open Print QR Poster */}
        {allowedToPrint ? (
          <Link
            href={wantsPoster ? '/os/reception-qr' : '/os/reception-qr?print=1'}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
          >
            {wantsPoster ? 'Close Printable QR Poster' : 'Print Reception QR Poster (Owner / Ops Only)'}
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[11px] text-gray-500">
            Poster Printing Restricted to Owner &amp; Operations Manager
          </span>
        )}
      </div>

      {/* Printable Reception Stand QR Poster (Restricted by HARD RULE `canPrintReceptionQr`) */}
      {wantsPoster && allowedToPrint && (
        <div className="bg-white rounded-2xl border-2 border-slate-900 p-8 shadow-xl max-w-2xl mx-auto text-center space-y-4">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-700">
            Betterway Mortgages LLC · Dubai Reception Stand Poster
          </div>
          <h2 className="font-display text-3xl font-bold text-slate-900">Scan on Arrival Before 10:05 AM</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Authorized for display at the Betterway Mortgages Reception Desk by <strong>Shabib Siraj</strong> (Owner)
            &amp; <strong>Mohammad Haseeb</strong> (Operations Manager).
          </p>
          <div className="w-56 h-56 mx-auto rounded-2xl bg-slate-900 text-white border-4 border-slate-900 flex flex-col items-center justify-center p-4 shadow-inner">
            <div className="grid grid-cols-5 gap-1.5 w-32 h-32">
              {Array.from({ length: 25 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`rounded-sm ${idx % 2 === 0 || idx % 7 === 0 ? 'bg-[#f1e3c2]' : 'bg-gray-900'}`}
                />
              ))}
            </div>
            <div className="font-num text-[10px] font-bold tracking-widest mt-3 text-slate-700">
              {OFFICE_RECEPTION_QR_TOKEN}
            </div>
          </div>
          <div className="text-xs text-slate-700 font-semibold">
            Mon–Fri: 10:00 AM – 7:00 PM · Sat: 10:00 AM – 4:00 PM · Sun: Official Holiday
          </div>
        </div>
      )}

      {/* Working Hours & Scan Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bw-card p-5 space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Reception Stand Check-In
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">Scan Office Reception QR</h2>
            <p className="text-xs text-slate-600 mt-1">
              Logged in as <strong>{user.full_name_en}</strong> ({user.email}). Scanning after <code>10:05 AM</code> is
              recorded as <strong>LATE</strong>.
            </p>
          </div>

          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
            <input type="hidden" name="action" value="reception_qr_checkin" />
            <input type="hidden" name="returnTo" value="/os/reception-qr" />
            <label className="block">
              <span className="font-semibold text-slate-700">Reception Stand QR Token</span>
              <input
                type="text"
                name="qrStandCode"
                defaultValue={OFFICE_RECEPTION_QR_TOKEN}
                required
                className="bw-input mt-1 w-full font-num"
              />
            </label>
            <label className="block">
              <span className="font-semibold text-slate-700">Arrival Time (GST HH:MM)</span>
              <input
                type="text"
                name="checkInTimeGst"
                defaultValue="09:58"
                required
                className="bw-input mt-1 w-full font-num"
              />
            </label>
            <label className="block">
              <span className="font-semibold text-slate-700">Office Wi-Fi SSID</span>
              <input type="text" name="networkSsid" defaultValue="Betterway-Office-5G" className="bw-input mt-1 w-full" />
            </label>
            <button type="submit" className="bw-btn-gold w-full justify-center">
              Complete Reception QR Check-In
            </button>
          </form>
        </div>

        {/* Continuous Contemptor Alerts + Today's Roll Call */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bw-card p-5 border-rose-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  10:30 AM Owner &amp; Operations Escalation
                </span>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Continuous Contemptor Alerts (3+ Late Arrivals in 7 Days)
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200">
                {contemptorAlerts.length} Active Alert(s)
              </span>
            </div>
            {contemptorAlerts.length === 0 ? (
              <p className="text-xs text-slate-600">
                Zero continuous contemptors in the current 7-day rolling window. All staff within punctuality
                threshold.
              </p>
            ) : (
              <div className="space-y-2">
                {contemptorAlerts.map((c) => (
                  <div
                    key={String(c.id)}
                    className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{String(c.employee_name)}</span> ({String(c.email)}) —{' '}
                      <strong className="text-rose-700">{Number(c.late_count_7d)} late arrivals in 7 days</strong>
                    </div>
                    <span className="font-num text-[11px] font-bold text-rose-800">
                      Notified: Shabib Siraj &amp; Mohammad Haseeb
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bw-card p-5">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-3">
              Office Reception Attendance Log ({attendanceLogs.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Staff Member</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3">Arrival (GST)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Minutes Late</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceLogs.map((a) => (
                    <tr key={String(a.id)}>
                      <td className="py-2.5 px-3 font-num">{String(a.check_in_date)}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{String(a.employee_name)}</td>
                      <td className="py-2.5 px-3">{String(a.shift_name)}</td>
                      <td className="py-2.5 px-3 font-num font-bold">{String(a.check_in_time_gst)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'ON_TIME'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {String(a.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-num">
                        {Number(a.late_minutes) > 0 ? `${Number(a.late_minutes)} mins` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

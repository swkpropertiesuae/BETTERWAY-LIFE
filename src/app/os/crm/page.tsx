import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAed, tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const leads = db
    .prepare(
      `SELECT l.*, u.full_name_en as advisor_name, ag.company_name as partner_company, pa.rera_brn
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_advisor_id
       LEFT JOIN partner_agents pa ON pa.id = l.partner_agent_id
       LEFT JOIN partner_agencies ag ON ag.id = pa.agency_id
       ORDER BY l.id DESC`,
    )
    .all() as Record<string, unknown>[];

  const selectedLeadId = sp.leadId ? Number(sp.leadId) : Number(leads[0]?.id || 0);
  const selectedLead = leads.find((l) => Number(l.id) === selectedLeadId);

  const messages = selectedLeadId
    ? (db
        .prepare('SELECT * FROM comm_messages WHERE lead_id = ? ORDER BY id ASC')
        .all(selectedLeadId) as Record<string, unknown>[])
    : [];

  const banks = db.prepare('SELECT id, name_en FROM banks ORDER BY id ASC').all() as { id: number; name_en: string }[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <PageHeader app="Sales" appHref="/os/crm" title="Leads" sub={tr(lang, 'Mortgage Lead Pipeline, Desk Routing & Unified Threader', 'خط أنابيب العملاء وتوجيه المكاتب والمحادثات الموحدة')} />

      <div className="bw-card p-5">
        <h2 className="font-display font-bold text-sm text-[#021125] mb-3">
          {tr(lang, 'Capture New Omnichannel Lead (Starts 5-Minute Response Clock)', 'إضافة عميل محتمل جديد')}
        </h2>
        <form method="POST" action="/api/v1/actions" className="grid sm:grid-cols-6 gap-2.5">
          <input type="hidden" name="action" value="create_lead" />
          <input type="hidden" name="returnTo" value="/os/crm" />
          <input name="contactName" required placeholder="Borrower Full Name" className="bw-input" />
          <input name="contactPhone" required placeholder="+97150..." className="bw-input font-num" />
          <select name="sourceChannel" className="bw-input">
            <option value="WEBSITE_CALC">Website Calculator</option>
            <option value="QUALIFIER">60s Qualifier</option>
            <option value="WHATSAPP">WhatsApp Direct</option>
            <option value="PROPERTY_FINDER">Property Finder</option>
            <option value="BAYUT">Bayut</option>
            <option value="SELF_GEN">Advisor Self-Gen (1.25x Slab)</option>
          </select>
          <select name="transactionType" className="bw-input">
            <option value="READY_PURCHASE">Ready Purchase</option>
            <option value="OFFPLAN_HANDOVER">Off-Plan Handover</option>
            <option value="BUYOUT">Refinance / Buyout</option>
            <option value="EQUITY_RELEASE">Equity Release</option>
            <option value="COMMERCIAL">Commercial Property</option>
          </select>
          <input name="targetPropertyAed" type="number" placeholder="Property AED (e.g. 3500000)" className="bw-input font-num" />
          <button type="submit" className="bw-btn-gold">
            + Log Lead
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bw-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 font-display font-bold text-sm text-[#021125]">
            Active Leads ({leads.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-start">Client</th>
                  <th className="px-4 py-2.5 text-start">Channel / Partner</th>
                  <th className="px-4 py-2.5 text-end">Target Property</th>
                  <th className="px-4 py-2.5 text-start">5m SLA</th>
                  <th className="px-4 py-2.5 text-start">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => {
                  const id = Number(l.id);
                  const responded = Boolean(l.first_responded_at);
                  return (
                    <tr
                      key={id}
                      className={`hover:bg-amber-50/40 ${id === selectedLeadId ? 'bg-amber-50/70' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <a href={`/os/crm?leadId=${id}`} className="font-bold text-[#021125] hover:underline block">
                          {String(l.contact_name)}
                        </a>
                        <span className="font-num text-slate-500">{String(l.contact_phone)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{String(l.source_channel)}</div>
                        {l.partner_company ? (
                          <div className="text-[11px] text-[#8A6518]">
                            {String(l.partner_company)} ({String(l.rera_brn)})
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">{String(l.desk)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end font-num font-semibold">
                        {formatAed(Number(l.target_property_fils))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`bw-badge ${responded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                          {responded ? 'MET' : 'ACTIVE 5m'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <form method="POST" action="/api/v1/actions" className="flex items-center gap-1">
                          <input type="hidden" name="action" value="update_lead_stage" />
                          <input type="hidden" name="leadId" value={id} />
                          <input type="hidden" name="returnTo" value={`/os/crm?leadId=${id}`} />
                          <select name="stage" defaultValue={String(l.stage)} className="rounded border border-slate-300 px-1.5 py-1 text-[11px]">
                            <option value="NEW">NEW</option>
                            <option value="CONTACTED">CONTACTED</option>
                            <option value="FACT_FIND">FACT_FIND</option>
                            <option value="CONVERTED_TO_DEAL">CONVERTED_TO_DEAL</option>
                            <option value="NURTURE">NURTURE</option>
                            <option value="DISQUALIFIED">DISQUALIFIED</option>
                          </select>
                          <button type="submit" className="rounded bg-slate-800 text-white px-2 py-1 text-[10px] cursor-pointer">
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-5">
          {selectedLead && (
            <>
              <div className="bw-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-[#021125]">
                    Convert Lead #{String(selectedLead.id)} ({String(selectedLead.contact_name)}) → 24-Bank LOS Deal
                  </h3>
                </div>
                <form method="POST" action="/api/v1/actions" className="grid grid-cols-2 gap-2.5 text-xs">
                  <input type="hidden" name="action" value="convert_lead" />
                  <input type="hidden" name="leadId" value={String(selectedLead.id)} />
                  <input type="hidden" name="returnTo" value="/os/los" />
                  <div>
                    <label className="block font-semibold mb-1">Residency</label>
                    <select name="residencyType" className="bw-input">
                      <option value="EXPAT_RESIDENT">Expat Resident</option>
                      <option value="UAE_NATIONAL">UAE National</option>
                      <option value="NON_RESIDENT">Non-Resident</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Community</label>
                    <input name="communityName" defaultValue="Dubai Hills Estate" className="bw-input" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Basic Salary (AED/mo)</label>
                    <input name="basicSalaryAed" type="number" defaultValue={30000} className="bw-input font-num" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Allowances (AED/mo)</label>
                    <input name="allowancesAed" type="number" defaultValue={12000} className="bw-input font-num" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Property Price (AED)</label>
                    <input
                      name="purchasePriceAed"
                      type="number"
                      defaultValue={Math.max(1_500_000, Math.round(Number(selectedLead.target_property_fils) / 100))}
                      className="bw-input font-num"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Target Loan (AED)</label>
                    <input
                      name="targetLoanAed"
                      type="number"
                      defaultValue={Math.max(1_200_000, Math.round((Number(selectedLead.target_property_fils) * 0.8) / 100))}
                      className="bw-input font-num"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Preferred Bank</label>
                    <select name="selectedBankId" className="bw-input">
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>{b.name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Direct Client Fee (AED)</label>
                    <input name="directClientFeeAed" type="number" defaultValue={0} className="bw-input font-num" />
                  </div>
                  <div className="col-span-2 pt-1">
                    <button type="submit" className="bw-btn-gold w-full">
                      Convert Lead to Active Mortgage Deal →
                    </button>
                  </div>
                </form>
              </div>

              <div className="bw-card p-5 space-y-3">
                <h3 className="font-display font-bold text-sm text-[#021125]">
                  Unified WhatsApp / Email / Call / Internal Thread
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="text-xs text-slate-400">No messages logged yet for this lead.</div>
                  ) : (
                    messages.map((m) => (
                      <div key={String(m.id)} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                          <span>{String(m.channel)} · {String(m.sender_name)}</span>
                          <span className="font-num">{String(m.created_at)}</span>
                        </div>
                        <div className="mt-1 text-slate-800">{String(m.body)}</div>
                      </div>
                    ))
                  )}
                </div>
                <form method="POST" action="/api/v1/actions" className="space-y-2">
                  <input type="hidden" name="action" value="add_comm_message" />
                  <input type="hidden" name="leadId" value={String(selectedLead.id)} />
                  <input type="hidden" name="returnTo" value={`/os/crm?leadId=${String(selectedLead.id)}`} />
                  <div className="flex gap-2">
                    <select name="channel" className="bw-input w-40">
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="EMAIL">Email</option>
                      <option value="CALL_LOG">Call Log</option>
                      <option value="INTERNAL_NOTE">Internal Note</option>
                    </select>
                    <input name="body" required placeholder="Log WhatsApp template, call outcome or advisor note..." className="bw-input" />
                    <button type="submit" className="bw-btn-navy shrink-0">Send</button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

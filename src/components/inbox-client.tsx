'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';

export interface InboxLeadItem {
  id: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  sourceChannel: string;
  transactionType: string;
  targetPropertyAed: number;
  stage: string;
  advisorName: string;
  responded: boolean;
  createdAt: string;
}

export interface InboxMessageItem {
  id: number;
  leadId: number;
  channel: string;
  senderName: string;
  body: string;
  createdAt: string;
}

const RECOMMENDED_BANK_OFFERS = [
  {
    code: 'FAB',
    bank: 'First Abu Dhabi Bank',
    rate: '3.89% 3Yr Fixed',
    reversion: '3M EIBOR + 1.65%',
    ltv: '80% LTV',
    note: '50% Arrangement Fee Waiver for Salary Transfer',
  },
  {
    code: 'ENBD',
    bank: 'Emirates NBD',
    rate: '3.99% 3Yr Fixed',
    reversion: '3M EIBOR + 1.75%',
    ltv: '80% LTV',
    note: 'Zero Processing Fee on Refinance / Buyout',
  },
  {
    code: 'DIB',
    bank: 'Dubai Islamic Bank (Ijara)',
    rate: '4.05% 3Yr Fixed',
    reversion: '3M EIBOR + 1.80%',
    ltv: '85% UAE National / 80% Expat',
    note: 'Fast-Track DLD Takaful & Valuation Desk',
  },
];

export function InboxClient({
  leads,
  initialMessages,
  initialLeadId,
  currentUserName,
}: {
  leads: InboxLeadItem[];
  initialMessages: InboxMessageItem[];
  initialLeadId: number;
  currentUserName: string;
}) {
  const [selectedLeadId, setSelectedLeadId] = useState<number>(initialLeadId || (leads[0]?.id ?? 0));
  const [filter, setFilter] = useState<'all' | 'sla' | 'ai'>('all');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL' | 'CALL_LOG' | 'INTERNAL_NOTE'>('WHATSAPP');
  const [draft, setDraft] = useState('');
  const [aiHandlingMap, setAiHandlingMap] = useState<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {};
    leads.forEach((l, idx) => {
      map[l.id] = idx % 2 === 0;
    });
    return map;
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filter === 'sla' && l.responded) return false;
      if (filter === 'ai' && !aiHandlingMap[l.id]) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          l.contactName.toLowerCase().includes(q) ||
          l.contactPhone.toLowerCase().includes(q) ||
          l.sourceChannel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, filter, search, aiHandlingMap]);

  const activeLead = leads.find((l) => l.id === selectedLeadId) || filteredLeads[0] || leads[0];

  const threadMessages = useMemo(() => {
    if (!activeLead) return [];
    return initialMessages.filter((m) => m.leadId === activeLead.id);
  }, [activeLead, initialMessages]);

  const isAiActive = activeLead ? Boolean(aiHandlingMap[activeLead.id]) : false;

  const generateAiSuggestion = () => {
    if (!activeLead) return;
    const loanAed = Math.round(activeLead.targetPropertyAed * 0.8);
    if (channel === 'INTERNAL_NOTE') {
      setDraft(
        `[Internal Underwriting Note] Verified ${activeLead.contactName}'s target property of AED ${activeLead.targetPropertyAed.toLocaleString('en-US')}. Recommend FAB 3.89% 3Yr Fixed or ENBD 3.99% (80% LTV = AED ${loanAed.toLocaleString('en-US')}). Ready for KFS & AECB pull.`,
      );
    } else {
      setDraft(
        `Hi ${activeLead.contactName.split(' ')[0]}, this is ${currentUserName} from Betterway Mortgages. For your AED ${activeLead.targetPropertyAed.toLocaleString('en-US')} property, you qualify for up to AED ${loanAed.toLocaleString('en-US')} (80% LTV) at 3.89% 3-Year Fixed with FAB. Please share your Emirates ID and last 6 months bank statements here to issue your IPA within 48 hours.`,
      );
    }
  };

  return (
    <div className="bw-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
      {/* PANE 1: CONVERSATION LIST */}
      <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col bg-[#fdf9f4]">
        <div className="p-3.5 border-b border-[var(--border)] space-y-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search borrower, +971, channel..."
            className="bw-input !h-9 !text-xs"
          />
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all', label: `All (${leads.length})` },
                { id: 'sla', label: '5m SLA' },
                { id: 'ai', label: 'AI Concierge' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  filter === tab.id
                    ? 'bg-[#2a1418] text-white'
                    : 'bg-white text-[var(--text-2)] border border-[var(--border)] hover:text-[var(--text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
          {filteredLeads.map((lead) => {
            const active = activeLead?.id === lead.id;
            const aiOn = Boolean(aiHandlingMap[lead.id]);
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => setSelectedLeadId(lead.id)}
                className={`w-full text-left p-3.5 transition-colors hover:bg-white ${
                  active ? 'bg-white border-l-[3px] border-l-[#7a1f2b]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[13px] text-[var(--text)] truncate">
                    {lead.contactName}
                  </span>
                  <span
                    className={`bw-badge !text-[10px] ${
                      lead.responded
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {lead.responded ? 'SLA Met' : '5m Clock'}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-3)] font-num mt-0.5">
                  {lead.contactPhone} · AED {(lead.targetPropertyAed / 1_000_000).toFixed(2)}M
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10.5px] font-medium text-[var(--text-2)] bg-[var(--bg-2)] px-2 py-0.5 rounded">
                    {lead.sourceChannel}
                  </span>
                  {aiOn ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#7a1f2b]">
                      <Bot className="w-3 h-3" /> AI Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700">
                      <UserCheck className="w-3 h-3" /> {lead.advisorName.split(' ')[0]}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PANE 2: UNIFIED THREAD & COMPOSER */}
      <div className="lg:col-span-6 flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-white">
        {activeLead ? (
          <>
            {/* Thread Header */}
            <div className="px-5 py-3.5 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[15px] text-[var(--text)]">{activeLead.contactName}</h3>
                  <span className="bw-badge bg-[var(--bg-2)] text-[var(--text-2)]">{activeLead.stage}</span>
                  {isAiActive && (
                    <span className="bw-badge bg-[#7a1f2b]/12 text-[#7a1f2b] border-[#7a1f2b]/25">
                      <Bot className="w-3 h-3" /> AI Concierge Responding
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-[var(--text-3)] font-num mt-0.5">
                  {activeLead.contactPhone} · Advisor: {activeLead.advisorName} · Source: {activeLead.sourceChannel}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAiHandlingMap((prev) => ({ ...prev, [activeLead.id]: !prev[activeLead.id] }))
                  }
                  className={isAiActive ? 'bw-btn-gold !py-1.5 !px-3 !text-xs' : 'bw-btn-ghost !py-1.5 !px-3 !text-xs'}
                >
                  {isAiActive ? 'Take Over as Advisor' : 'Hand Back to AI'}
                </button>
                <Link href={`/os/crm?leadId=${activeLead.id}`} className="bw-btn-ghost !py-1.5 !px-3 !text-xs">
                  CRM Desk <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 p-5 space-y-3.5 overflow-y-auto bg-[#f7f2ea]/60 max-h-[440px]">
              {threadMessages.map((m) => {
                const isInternal = m.channel === 'INTERNAL_NOTE';
                const isAi = m.channel === 'AI_CONCIERGE' || m.senderName.includes('AI');
                const isClient = m.senderName === activeLead.contactName;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl p-3.5 text-xs leading-relaxed border ${
                        isInternal
                          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                          : isAi
                            ? 'bg-[#f6e6e6] border-[#7a1f2b]/30 text-[#2a1418]'
                            : isClient
                              ? 'bg-white border-[var(--border)] text-[var(--text)]'
                              : 'bg-[#2a1418] border-[#2a1418] text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1.5 text-[10.5px] opacity-75 font-medium">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {isInternal && <Lock className="w-3 h-3 text-amber-700" />}
                          {isAi && <Sparkles className="w-3 h-3 text-[#7a1f2b]" />}
                          {m.channel} · {m.senderName}
                        </span>
                        <span className="font-num">{m.createdAt}</span>
                      </div>
                      <div>{m.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Composer */}
            <form method="POST" action="/api/v1/actions" className="p-4 border-t border-[var(--border)] bg-white space-y-2.5">
              <input type="hidden" name="action" value="add_comm_message" />
              <input type="hidden" name="leadId" value={activeLead.id} />
              <input type="hidden" name="returnTo" value={`/os/inbox?leadId=${activeLead.id}`} />
              <input type="hidden" name="channel" value={channel} />

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
                      { id: 'EMAIL', label: 'Email', icon: Mail },
                      { id: 'CALL_LOG', label: 'Call Log', icon: Phone },
                      { id: 'INTERNAL_NOTE', label: 'Team Note (Private)', icon: Lock },
                    ] as const
                  ).map((ch) => {
                    const Icon = ch.icon;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setChannel(ch.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          channel === ch.id
                            ? ch.id === 'INTERNAL_NOTE'
                              ? 'bg-amber-600 text-white'
                              : 'bg-[#2a1418] text-white'
                            : 'bg-[var(--bg-2)] text-[var(--text-2)] hover:text-[var(--text)]'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {ch.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={generateAiSuggestion}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#7a1f2b]/12 text-[#7a1f2b] hover:bg-[#7a1f2b]/20 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  AI Draft Reply
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  name="body"
                  required
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    channel === 'INTERNAL_NOTE'
                      ? 'Write internal team note (visible only to Betterway Mortgages staff)...'
                      : `Reply to ${activeLead.contactName} via ${channel} (marks 5m SLA clock met)...`
                  }
                  className="bw-input flex-1"
                />
                <button type="submit" className="bw-btn-navy shrink-0">
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-3">
            <div className="text-sm font-bold text-[var(--ink)]">
              No borrower conversations yet
            </div>
            <p className="text-xs text-[var(--muted)] max-w-xs">
              Log your first borrower enquiry in Leads &amp; 5m SLA (/os/crm) to start omnichannel WhatsApp, Email, and Internal Team Note threads.
            </p>
            <Link href="/os/crm" className="bw-btn-gold">
              + Open Leads &amp; 5m SLA Desk →
            </Link>
          </div>
        )}
      </div>

      {/* PANE 3: BORROWER UNDERWRITING & BANK PRODUCT MATCHES */}
      <div className="lg:col-span-3 p-4 bg-[#fdf9f4] space-y-4 overflow-y-auto">
        {activeLead && (
          <>
            <div className="bw-card p-3.5 space-y-2.5">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                Borrower Qualification Snapshot
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-[var(--bg)]">
                  <div className="text-[10px] text-[var(--text-3)]">Target Property</div>
                  <div className="font-bold font-num text-[var(--text)] mt-0.5">
                    AED {activeLead.targetPropertyAed.toLocaleString('en-US')}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[var(--bg)]">
                  <div className="text-[10px] text-[var(--text-3)]">Est. 80% LTV Loan</div>
                  <div className="font-bold font-num text-emerald-700 mt-0.5">
                    AED {Math.round(activeLead.targetPropertyAed * 0.8).toLocaleString('en-US')}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="bw-badge bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> WhatsApp Opt-In
                </span>
                <span className="bw-badge bg-blue-50 text-blue-700 border-blue-200">
                  <ShieldCheck className="w-3 h-3" /> CBUAE 50% DBR Ready
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                Matched UAE Bank Offers (Click to Insert)
              </div>
              {RECOMMENDED_BANK_OFFERS.map((offer) => (
                <div key={offer.code} className="bw-card p-3 space-y-1.5 hover:border-[#7a1f2b]/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[var(--text)]">{offer.bank}</span>
                    <span className="font-num font-bold text-xs text-[#7a1f2b]">{offer.rate}</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-3)]">
                    {offer.ltv} · Reversion: <span className="font-num">{offer.reversion}</span>
                  </div>
                  <div className="text-[10.5px] text-emerald-700 font-medium">{offer.note}</div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft(
                        `Hi ${activeLead.contactName.split(' ')[0]}, we have matched your AED ${activeLead.targetPropertyAed.toLocaleString('en-US')} purchase with ${offer.bank} at ${offer.rate} (${offer.ltv}, ${offer.note}). Shall I send your Key Facts Statement (KFS)?`,
                      )
                    }
                    className="w-full mt-1 py-1 px-2 rounded bg-[var(--bg-2)] hover:bg-[#2a1418] hover:text-white text-[11px] font-semibold text-[var(--text-2)] transition-colors"
                  >
                    + Insert {offer.code} Quote into Reply
                  </button>
                </div>
              ))}
            </div>

            <div className="bw-card p-3.5 space-y-2">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                Internal Next Step
              </div>
              <Link href={`/os/crm?leadId=${activeLead.id}`} className="bw-btn-gold w-full justify-center !text-xs">
                Convert to 24-Bank LOS Deal →
              </Link>
              <Link href="/os/toolkit" className="bw-btn-ghost w-full justify-center !text-xs">
                Open CBUAE 50% DBR Calculator
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { StaffAvatar } from '@/components/staff-avatar';
import type { BetterwayGptMode } from '@/server/engines/betterway-gpt-engine';
import {
  Bot,
  CheckCircle2,
  MessageSquarePlus,
  PhoneIncoming,
  Play,
  Send,
  Sparkles,
  Terminal,
} from 'lucide-react';

export interface GptThreadItem {
  id: string;
  userEmail: string;
  title: string;
  mode: BetterwayGptMode;
  updatedAt: string;
  messages: Array<{
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations: Array<{ slug: string; clauseRef: string; policyVersion: string }>;
    createdAt: string;
  }>;
}

export interface DigitalEmployeeItem {
  slug: string;
  name: string;
  roleTitle: string;
  department: string;
  scheduleLabel: string;
  ownerGuardrail: string;
  description: string;
  latestRun: {
    id: number;
    status: string;
    outputSummary: string;
    triggeredByEmail: string;
    createdAt: string;
  } | null;
}

const MODE_LABELS: Array<{ id: BetterwayGptMode; label: string; desc: string }> = [
  { id: 'LIVE_OS_DATA', label: 'BetterwayGPT-4o · Live OS Data', desc: 'Queries SQLite deals, 24 banks, EIBOR & HR' },
  { id: 'CBUAE_UNDERWRITING', label: 'CBUAE 50% DBR Underwriter', desc: 'Stress test, LTV ladder & card limit rules' },
  { id: 'RAHABA_HR_WPS', label: 'Rahaba HR, QR & MOHRE WPS', desc: '10:05 AM attendance, EOSB, NOCs & visas' },
  { id: 'DLD_CONVEYANCING', label: 'DLD & Form F Counsel', desc: 'MOU clauses, RICS valuation & cheque splits' },
  { id: 'BILINGUAL_WRITER', label: 'Bilingual EN/AR Writer', desc: 'Executive English & Arabic legal drafting' },
];

const QUICK_PROMPTS = [
  'Show our live mortgage pipeline, 3M EIBOR, and top 5 UAE bank fixed rates',
  'Give me Rahaba Azeez HR & 10:05 AM GST Reception QR attendance status today',
  'Which UAE banks assess 3% vs 5% credit card limit in CBUAE 50% DBR?',
  'Draft a bilingual English & Arabic mortgage pre-qualification letter for our client',
  'Explain our 50/50 commission split, 180-day clawback reserve, and Form F cheque pack',
];

export function BetterwayGptClient({
  userEmail,
  userName,
  initialThreads,
  initialEmployees,
}: {
  userEmail: string;
  userName: string;
  initialThreads: GptThreadItem[];
  initialEmployees: DigitalEmployeeItem[];
}) {
  const [workspaceTab, setWorkspaceTab] = useState<'chat' | 'employees' | 'voice'>('chat');
  const [threads, setThreads] = useState<GptThreadItem[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(initialThreads[0]?.id);
  const [mode, setMode] = useState<BetterwayGptMode>('LIVE_OS_DATA');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<DigitalEmployeeItem[]>(initialEmployees);
  const [runningSlug, setRunningSlug] = useState<string | null>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const sendPrompt = async (customText?: string, customMode?: BetterwayGptMode) => {
    const q = (customText ?? prompt).trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          threadId: activeThreadId,
          prompt: q,
          mode: customMode || mode,
          userEmail,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.threads)) {
        setThreads(data.threads);
        setActiveThreadId(data.threadId);
        if (!customText) setPrompt('');
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerAgentRun = async (agentSlug: string) => {
    setRunningSlug(agentSlug);
    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_agent',
          agentSlug,
          userEmail,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.digitalEmployees)) {
        setEmployees(data.digitalEmployees);
      }
    } finally {
      setRunningSlug(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Sub-Navigation */}
      <div className="bw-card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWorkspaceTab('chat')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              workspaceTab === 'chat'
                ? 'bg-[#021125] text-[#D7B04E]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            BetterwayGPT — Private Company ChatGPT
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab('employees')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              workspaceTab === 'employees'
                ? 'bg-[#021125] text-[#D7B04E]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Bot className="h-4 w-4" />
            Digital AI Employees ({employees.length} Autonomous Agents)
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab('voice')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              workspaceTab === 'voice'
                ? 'bg-[#021125] text-[#D7B04E]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <PhoneIncoming className="h-4 w-4" />
            24/7 Bilingual AI Voice Receptionist (EN/AR)
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <StaffAvatar name={userName} email={userEmail} size={26} />
          <span>
            Signed in as <strong>{userName}</strong> · 100% Private On-Prem SQLite Grounding
          </span>
        </div>
      </div>

      {/* TAB 1: BETTERWAYGPT CHAT WORKSPACE */}
      {workspaceTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Thread Sidebar */}
          <div className="lg:col-span-3 bw-card p-4 space-y-3 text-xs">
            <button
              type="button"
              onClick={() => setActiveThreadId(undefined)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#021125] text-[#D7B04E] font-bold flex items-center justify-center gap-2 shadow-xs"
            >
              <MessageSquarePlus className="h-4 w-4" />+ New BetterwayGPT Chat
            </button>

            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Specialist Brain Mode
              </div>
              {MODE_LABELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition ${
                    mode === m.id
                      ? 'bg-amber-50/90 border-[#D7B04E] text-[#021125]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-[11px]">{m.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Recent Conversations ({threads.length})
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveThreadId(t.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] truncate transition ${
                      activeThread?.id === t.id
                        ? 'bg-[#021125] text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Main Chat Canvas */}
          <div className="lg:col-span-9 bw-card overflow-hidden flex flex-col min-h-[580px]">
            <div className="bg-[#021125] text-white px-5 py-3.5 border-b-2 border-[#D7B04E] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-[#D7B04E] text-[#021125] flex items-center justify-center font-bold">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-display font-bold text-sm">
                    BetterwayGPT · Private Sovereign Mortgage &amp; Operations Intelligence
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Live SQLite Grounded · 24 UAE Banks · CBUAE 50% DBR · Rahaba Azeez HR &amp; WPS
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-[#D7B04E] text-[10px] font-bold">
                Mode: {mode}
              </span>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[440px] bg-slate-50/50 text-xs">
              {!activeThread || activeThread.messages.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
                  <div className="font-display font-bold text-base text-[#021125]">
                    Welcome to BetterwayGPT, {userName}
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Unlike generic public AI, BetterwayGPT is connected directly to Betterway Mortgages LLC&apos;s live SQLite database — including our 24-bank rate cards, CBUAE 50% DBR engine, DLD Form F cheque splits, FTA VAT 201 ledger, and Rahaba Azeez&apos;s 10:05 AM GST HR &amp; Attendance desk.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {QUICK_PROMPTS.map((qp) => (
                      <button
                        key={qp}
                        type="button"
                        onClick={() => sendPrompt(qp)}
                        className="text-left px-3 py-2 rounded-xl bg-slate-100 hover:bg-[#021125] hover:text-[#D7B04E] text-slate-800 font-medium transition text-[11px]"
                      >
                        {qp}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                activeThread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role !== 'user' && (
                      <div className="h-8 w-8 rounded-lg bg-[#021125] text-[#D7B04E] flex items-center justify-center shrink-0 font-bold">
                        BW
                      </div>
                    )}
                    <div
                      className={`max-w-3xl rounded-2xl p-4 space-y-2 ${
                        m.role === 'user'
                          ? 'bg-[#021125] text-white'
                          : 'bg-white border border-slate-200 text-slate-900 shadow-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                      {m.citations && m.citations.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                          {m.citations.map((c, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-amber-50 text-[#8A6518] border border-amber-200 text-[10px] font-num font-bold"
                            >
                              Cite: {c.clauseRef} ({c.policyVersion})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {m.role === 'user' && (
                      <StaffAvatar name={userName} email={userEmail} size={32} />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Prompt Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendPrompt();
              }}
              className="p-3.5 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask BetterwayGPT anything about live deals, 24-bank rates, DBR, DLD cheques, or Rahaba HR..."
                className="bw-input text-xs flex-1"
              />
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="bw-btn-gold text-xs px-4 py-2.5 flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {loading ? 'Thinking…' : 'Ask BetterwayGPT'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: DIGITAL AI EMPLOYEES ROSTER */}
      {workspaceTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map((ag) => (
            <div key={ag.slug} className="bw-card p-5 space-y-3 text-xs flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#021125] text-[#D7B04E] text-[10px] font-bold">
                    {ag.department}
                  </span>
                  <span className="text-[11px] font-num text-emerald-700 font-bold">
                    Schedule: {ag.scheduleLabel}
                  </span>
                </div>
                <h3 className="font-display font-bold text-base text-[#021125]">{ag.name}</h3>
                <div className="text-[11px] font-semibold text-[#8A6518]">{ag.roleTitle}</div>
                <p className="text-slate-600 leading-relaxed">{ag.description}</p>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                  <strong>Governance Guardrail:</strong> {ag.ownerGuardrail}
                </div>

                {ag.latestRun && (
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-emerald-900">
                      <span className="flex items-center gap-1">
                        <Terminal className="h-3 w-3" /> LATEST EXECUTION OUTPUT
                      </span>
                      <span>{ag.latestRun.status}</span>
                    </div>
                    <div className="text-[11px] text-emerald-950">{ag.latestRun.outputSummary}</div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={runningSlug === ag.slug}
                  onClick={() => triggerAgentRun(ag.slug)}
                  className="bw-btn-navy w-full justify-center text-xs flex items-center gap-2"
                >
                  <Play className="h-3.5 w-3.5" />
                  {runningSlug === ag.slug ? 'Executing Autonomous Routine…' : 'Run Digital Employee Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: 24/7 BILINGUAL AI VOICE RECEPTIONIST */}
      {workspaceTab === 'voice' && (
        <div className="bw-card p-6 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A6518]">
                24/7 Instant Call Pickup (&lt;1s) · English &amp; Arabic IVR
              </span>
              <h2 className="font-display text-xl font-bold text-[#021125] mt-0.5">
                Betterway Bilingual AI Voice Receptionist &amp; Lead Router
              </h2>
              <p className="text-slate-600 mt-1">
                Qualifies inbound mortgage callers on property price, residency, and monthly income, logs UAE PDPL consent, and routes warm transfers to our advisory desk.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerAgentRun('voice-receptionist')}
              className="bw-btn-gold text-xs"
            >
              Run Voice Receptionist Health Check
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: 'Daniel Xavier',
                email: 'daniel@betterwaymortgages.com',
                role: 'Team Manager & Mortgage Advisor',
                routingRule: 'VIP / Jumbo (> AED 5M), Commercial & Complex Structuring Calls',
              },
              {
                name: 'Reshma Rajan',
                email: 'reshma@betterwaymortgages.com',
                role: 'Telesales cum Mortgage Advisor',
                routingRule: 'Inbound Website Enquiries, First-Time Buyer Qualification & Rapid Callbacks',
              },
              {
                name: 'Asif Khan',
                email: 'asif@betterwaymortgages.com',
                role: 'Mortgage Advisor',
                routingRule: 'Ready Villa/Apartment Purchases, Islamic Ijara/Murabaha & Refinance Buyouts',
              },
            ].map((adv) => (
              <div key={adv.email} className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-2.5">
                  <StaffAvatar name={adv.name} email={adv.email} size={40} />
                  <div>
                    <div className="font-bold text-slate-900">{adv.name}</div>
                    <div className="text-[11px] text-[#8A6518] font-semibold">{adv.role}</div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600">
                  <strong>Auto-Routing Rule:</strong> {adv.routingRule}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Live Warm-Transfer Extension Active
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

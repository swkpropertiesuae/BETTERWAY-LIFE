import {
  Activity,
  ArrowLeftRight,
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  Calculator,
  CalendarClock,
  CalendarDays,
  ChartArea,
  CheckSquare,
  ClipboardCheck,
  CreditCard,
  Database,
  DatabaseZap,
  FileSignature,
  FileText,
  Gauge,
  Handshake,
  Home,
  Inbox,
  Landmark,
  LayoutDashboard,
  LineChart,
  Lock,
  PhoneCall,
  Plug,
  Printer,
  QrCode,
  Repeat,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '@/estate-os/lib/permissions';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  cap?: Capability;
  href?: string;
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'sales', label: 'Sales intelligence', icon: LineChart, cap: 'reports.view' },
      { key: 'activity', label: 'Activity feed', icon: Activity, cap: 'leads.view' },
    ],
  },
  {
    section: 'Sales',
    items: [
      { key: 'leads', label: 'Leads', icon: UserRound, cap: 'leads.view' },
      { key: 'contacts', label: 'Contacts', icon: Users, cap: 'leads.view' },
      { key: 'properties', label: 'Properties', icon: Building2, cap: 'leads.view' },
      { key: 'deals', label: 'Deals', icon: Handshake, cap: 'leads.view' },
      { key: 'appointments', label: 'Appointments', icon: CalendarDays, cap: 'leads.view' },
      { key: 'tasks', label: 'Tasks', icon: CheckSquare, cap: 'leads.view' },
    ],
  },
  {
    section: 'Communications',
    items: [
      { key: 'inbox', label: 'Unified inbox', icon: Inbox, cap: 'inbox.reply' },
      { key: 'calls', label: 'Calls', icon: PhoneCall, cap: 'calls.place' },
      { key: 'followups', label: 'Follow-ups', icon: Repeat, cap: 'inbox.reply' },
    ],
  },
  {
    section: 'AI operations',
    items: [
      { key: 'pilot', label: 'Pilot operations', icon: Gauge, cap: 'logs.view' },
      { key: 'agents', label: 'AI agents', icon: Bot, cap: 'logs.view' },
      { key: 'automations', label: 'Automations', icon: CalendarClock, cap: 'leads.view' },
      { key: 'workflows', label: 'Workflows', icon: Workflow, cap: 'logs.view' },
      { key: 'approvals', label: 'Approvals', icon: ClipboardCheck, cap: 'approvals.decide' },
      { key: 'dataquality', label: 'Data quality', icon: DatabaseZap, cap: 'leads.view' },
      { key: 'logs', label: 'Execution logs', icon: SquareTerminal, cap: 'logs.view' },
    ],
  },
  {
    section: 'Business',
    items: [
      { key: 'team', label: 'Team', icon: UsersRound, cap: 'team.view' },
      { key: 'finance', label: 'Finance', icon: BadgeDollarSign, cap: 'finance.view' },
      { key: 'reports', label: 'Reports', icon: BarChart3, cap: 'reports.view' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { key: 'documents', label: 'Documents', icon: FileText, cap: 'documents.edit' },
      { key: 'integrations', label: 'Integrations', icon: Plug, cap: 'integrations.manage' },
      { key: 'audit', label: 'Audit logs', icon: ShieldCheck, cap: 'audit.view' },
      { key: 'settings', label: 'Settings', icon: Settings, cap: 'settings.manage' },
    ],
  },
  {
    section: 'UAE Mortgage & DLD',
    items: [
      { key: 'os-crm', label: 'UAE Leads & 5m SLA', icon: UserPlus, href: '/os/crm' },
      { key: 'os-deals', label: 'UAE Mortgage Pipeline', icon: ArrowLeftRight, href: '/os/deals' },
      { key: 'os-los', label: '24-Bank Underwriting', icon: Landmark, href: '/os/los' },
      { key: 'os-toolkit', label: 'CBUAE 50% DBR Toolkit', icon: Calculator, href: '/os/toolkit' },
      { key: 'os-banks-apl', label: 'Bank Rates & APL', icon: Building2, href: '/os/banks-apl' },
      { key: 'os-loan-risk-pdc', label: 'Loans & PDC Vault', icon: CreditCard, href: '/os/loan-risk-pdc' },
      { key: 'os-conveyancing', label: 'DLD & Cheque Pack', icon: Send, href: '/os/conveyancing' },
      { key: 'os-handover', label: 'Off-Plan Handover', icon: Home, href: '/os/handover' },
      { key: 'os-cross-sell', label: '360° Cross-Sell Desk', icon: Sparkles, href: '/os/cross-sell' },
    ],
  },
  {
    section: 'UAE Finance, Tax & HR',
    items: [
      { key: 'os-erp', label: 'Accounting & FTA VAT', icon: TrendingUp, href: '/os/erp' },
      { key: 'os-expenses', label: 'Expenses, P&L & BS', icon: Wallet, href: '/os/accounts-expenses' },
      { key: 'os-withdrawals', label: '50/50 Splits & Refunds', icon: FileSignature, href: '/os/withdrawals' },
      { key: 'os-hrm', label: 'Payroll & MOHRE WPS', icon: Users, href: '/os/hrm' },
      { key: 'os-team', label: 'UAE Staff & Workload', icon: UsersRound, href: '/os/team' },
      { key: 'os-inbox', label: 'UAE Omnichannel Desk', icon: Inbox, href: '/os/inbox' },
      { key: 'os-activities', label: 'UAE Tasks & Viewings', icon: CheckSquare, href: '/os/activities' },
      { key: 'os-compliance', label: 'KFS & FIU goAML', icon: Shield, href: '/os/compliance' },
      { key: 'os-market', label: 'DLD Market Pulse', icon: Target, href: '/os/market' },
      { key: 'os-operations', label: 'Company Operations', icon: Activity, href: '/os/operations' },
      { key: 'os-reception-qr', label: 'Reception QR Check-In', icon: QrCode, href: '/os/reception-qr' },
      { key: 'os-print', label: '6-Doc Print Suite', icon: Printer, href: '/os/print/proposal/1' },
      { key: 'os-copilot', label: 'AI Policy Co-Pilot', icon: ChartArea, href: '/os/bi-copilot' },
      { key: 'os-wiki', label: 'Credit Policy Wiki', icon: BookOpen, href: '/os/wiki' },
      { key: 'os-data', label: 'Data Hub & UAT', icon: Database, href: '/os/data' },
      { key: 'os-privacy', label: 'PDPL Privacy', icon: Lock, href: '/os/privacy' },
      { key: 'os-bin', label: 'Pending Delete Bin', icon: Trash2, href: '/os/recycle-bin' },
      { key: 'os-golive', label: 'Go-Live Checklist', icon: CheckSquare, href: '/os/golive' },
    ],
  },
];

export const NAV_FLAT = NAV.flatMap((s) => s.items.map((i) => ({ ...i, section: s.section })));

export const PAGE_TITLE: Record<string, string> = Object.fromEntries(NAV_FLAT.map((i) => [i.key, i.label]));

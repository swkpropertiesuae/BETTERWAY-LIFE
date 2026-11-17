import { DAY } from '@/estate-os/lib/format';
import type {
  Activity,
  Agent,
  Appointment,
  Approval,
  AuditLog,
  Call,
  Commission,
  Contact,
  Conversation,
  Deal,
  DocumentRec,
  Expense,
  FollowUp,
  Integration,
  Lead,
  MarketingSource,
  Member,
  Notification,
  Organization,
  Property,
  Run,
  Task,
  UsageRecord,
  WebhookEvent,
  Workflow,
} from './types';

export interface OrgData {
  members: Member[];
  contacts: Contact[];
  leads: Lead[];
  properties: Property[];
  deals: Deal[];
  appointments: Appointment[];
  tasks: Task[];
  conversations: Conversation[];
  calls: Call[];
  agents: Agent[];
  workflows: Workflow[];
  runs: Run[];
  approvals: Approval[];
  followUps: FollowUp[];
  integrations: Integration[];
  webhookEvents: WebhookEvent[];
  usage: UsageRecord[];
  commissions: Commission[];
  expenses: Expense[];
  documents: DocumentRec[];
  audit: AuditLog[];
  activities: Activity[];
  notifications: Notification[];
  sources: MarketingSource[];
}

export const PROPERTY_IMAGES = [
  'photo-1600596542815-ffad4c1539a9',
  'photo-1600585154340-be6161a56a0c',
  'photo-1512917774080-9991f1c4c750',
  'photo-1502672260266-1c1ef2d93688',
  'photo-1522708323590-d24dbb6b0267',
  'photo-1560448204-e02f11c3d0e2',
  'photo-1493809842364-78817add7ffb',
  'photo-1545324418-cc1a3fa10c00',
  'photo-1515263487990-61b07816b324',
  'photo-1486406146926-c627a92ad1ab',
  'photo-1580587771525-78b9dba3b914',
  'photo-1613490493576-7fde63acd811',
  'photo-1600607687939-ce8a6c25118c',
  'photo-1484154218962-a197022b5858',
];

export const AMENITIES = [
  'Garage',
  'Gym',
  'Pool',
  'Lake view',
  'Clubhouse',
  'Gated',
  'In-unit laundry',
  'Pet friendly',
  'Balcony',
  'Elevator',
];

interface OrgConfig {
  org: Organization;
  seed: number;
  scale: number;
  domain: string;
  localities: { name: string; psf: number; rentPsf: number }[];
  team: Omit<Member, 'orgId' | 'joinedAt' | 'id'>[];
  projects: string[];
}

export const ORG_CONFIGS: OrgConfig[] = [
  {
    seed: 7,
    scale: 1,
    domain: 'betterwaymortgages.com',
    org: {
      id: 'org_skyline',
      name: 'Betterway Mortgages',
      slug: 'betterway-mortgages',
      city: 'Dubai, UAE',
      timezone: 'Asia/Dubai',
      currency: 'AED',
      country: 'AE',
      businessHours: { start: 9, end: 19, days: [1, 2, 3, 4, 5, 6] },
      callingHours: { start: 9, end: 20 },
      outboundPaused: false,
      leadStages: [
        'new',
        'attempting',
        'contacted',
        'qualified',
        'matching',
        'visit_scheduled',
        'visit_completed',
        'negotiation',
        'won',
        'lost',
        'nurture',
      ],
      assignment: 'by_locality',
      slaMinutes: 5,
      webhookSecretVersion: 1,
    },
    localities: [
      { name: 'Downtown Dubai', psf: 2950, rentPsf: 18.5 },
      { name: 'Dubai Hills Estate', psf: 2350, rentPsf: 14.8 },
      { name: 'Palm Jumeirah', psf: 4100, rentPsf: 24.0 },
      { name: 'Dubai Marina', psf: 2150, rentPsf: 15.2 },
      { name: 'Business Bay', psf: 2050, rentPsf: 14.0 },
      { name: 'DIFC', psf: 3400, rentPsf: 21.0 },
      { name: 'Jumeirah Golf Estates', psf: 1950, rentPsf: 12.5 },
      { name: 'Arabian Ranches', psf: 1780, rentPsf: 11.2 },
      { name: 'Dubai Creek Harbour', psf: 2250, rentPsf: 14.2 },
      { name: 'JVC', psf: 1320, rentPsf: 9.4 },
    ],
    projects: [
      'Golf Place Villas',
      'Burj Crown Residences',
      'Address Harbour Point',
      'Marina Gate Towers',
      'One Zaabeel',
      'Six Senses The Palm',
      'Emaar Beachfront',
      'Sobha Hartland',
      'Tilal Al Ghaf',
      'Arabian Ranches III',
      'Jumeirah Islands',
      'Collective 2.0',
    ],
    team: [
      {
        name: 'Shabib Siraj',
        email: 'shabib@betterwaymortgages.com',
        phone: '+971501000001',
        role: 'owner',
        title: 'Founder & Managing Director',
        status: 'active',
        hue: 210,
        localities: [],
      },
      {
        name: 'Betterway Admin',
        email: 'admin@betterwaymortgages.com',
        phone: '+971501000000',
        role: 'admin',
        title: 'System Administrator',
        status: 'active',
        hue: 200,
        localities: [],
      },
      {
        name: 'Mohammad Haseeb',
        email: 'haseeb@betterwaymortgages.com',
        phone: '+971501000002',
        role: 'manager',
        title: 'Operations Manager',
        status: 'active',
        hue: 190,
        localities: [],
      },
      {
        name: 'Talha Shabbir',
        email: 'talha@betterwaymortgages.com',
        phone: '+971501000003',
        role: 'agent',
        title: 'BDM & IT Specialist',
        status: 'active',
        hue: 165,
        localities: ['Downtown Dubai', 'Business Bay', 'DIFC'],
      },
      {
        name: 'Fareed',
        email: 'fareed@betterwaymortgages.com',
        phone: '+971501000004',
        role: 'admin',
        title: 'Compliance Officer & MLRO',
        status: 'active',
        hue: 225,
        localities: [],
      },
      {
        name: 'Shahid',
        email: 'shahid@betterwaymortgages.com',
        phone: '+971501000005',
        role: 'agent',
        title: 'Senior Mortgage Advisor',
        status: 'active',
        hue: 150,
        localities: ['Dubai Hills Estate', 'Palm Jumeirah', 'Dubai Marina'],
      },
      {
        name: 'Umar',
        email: 'umar@betterwaymortgages.com',
        phone: '+971501000006',
        role: 'operations',
        title: 'Credit Underwriter',
        status: 'active',
        hue: 240,
        localities: ['Dubai Creek Harbour', 'Arabian Ranches'],
      },
      {
        name: 'Saifullah',
        email: 'saifullah@betterwaymortgages.com',
        phone: '+971501000007',
        role: 'operations',
        title: 'DLD & Conveyancing Officer',
        status: 'active',
        hue: 180,
        localities: ['JVC', 'Jumeirah Golf Estates'],
      },
      {
        name: 'Samarth',
        email: 'samarth@betterwaymortgages.com',
        phone: '+971501000008',
        role: 'finance',
        title: 'Finance & Accounting Controller',
        status: 'active',
        hue: 45,
        localities: [],
      },
    ],
  },
];

const SOURCES: [string, MarketingSource['kind']][] = [
  ['Property Finder', 'portal'],
  ['Bayut', 'portal'],
  ['Dubizzle', 'portal'],
  ['Meta Ads', 'ads'],
  ['Google Ads', 'ads'],
  ['Website form', 'website'],
  ['Referral', 'referral'],
  ['Open house', 'offline'],
];

export function generateOrg(cfg: OrgConfig, now: number): OrgData {
  const orgId = cfg.org.id;
  let n = 0;
  const id = (p: string) => `${p}_${cfg.seed}_${(n++).toString(36)}`;

  /* Official Internal Staff Members */
  const members: Member[] = cfg.team.map((t, i) => ({
    ...t,
    id: i === 0 ? 'mem_me' : id('mem'),
    orgId,
    joinedAt: now - (365 - i * 20) * DAY,
  }));

  /* 8 Production AI Agents */
  const agents: Agent[] = [
    {
      id: id('agt'),
      orgId,
      name: 'AI Lead Intake Agent',
      type: 'lead_intake',
      purpose: 'Captures every enquiry from forms, portals and imports, checks it, spots repeat enquiries and assigns an owner.',
      status: 'active',
      autonomy: 'bounded_auto',
      tools: ['create_lead', 'find_duplicates', 'assign_owner', 'request_human_handoff'],
      channel: null,
      model: 'claude-opus-5-5',
      version: 3,
      dailyBudget: 5,
      maxSteps: 6,
      escalation: ['Possible duplicate with conflicting details'],
      createdAt: now - 30 * DAY,
    },
    {
      id: id('agt'),
      orgId,
      name: 'AI Voice Calling Agent',
      type: 'voice_calling',
      purpose: 'Calls new enquiries (with AI-call consent, inside calling hours) to capture budget, area, configuration and timeline.',
      status: 'active',
      autonomy: 'bounded_auto',
      tools: ['get_lead', 'update_lead_fields', 'create_task', 'request_human_handoff'],
      channel: 'phone',
      model: 'claude-opus-5-5',
      version: 7,
      dailyBudget: 40,
      maxSteps: 12,
      escalation: ['Caller asks for a human', 'Legal or pricing negotiation', 'Low extraction confidence'],
      createdAt: now - 30 * DAY,
    },
    {
      id: id('agt'),
      orgId,
      name: 'AI Sales & Qualification Agent',
      type: 'qualification',
      purpose: 'Scores how ready each lead is to buy or rent, explains the score and lists the details still missing.',
      status: 'active',
      autonomy: 'approval_required',
      tools: ['get_lead', 'score_lead', 'create_task'],
      channel: null,
      model: 'claude-opus-5-5',
      version: 4,
      dailyBudget: 8,
      maxSteps: 6,
      escalation: ['Borderline score', 'Conflicting requirements'],
      createdAt: now - 30 * DAY,
    },
    {
      id: id('agt'),
      orgId,
      name: 'AI Property Matching Agent',
      type: 'property_matching',
      purpose: 'Ranks active, verified listings against each lead’s hard requirements and explains every match.',
      status: 'active',
      autonomy: 'suggest_only',
      tools: ['get_lead', 'search_properties', 'get_verified_property_details'],
      channel: null,
      model: 'claude-opus-5-5',
      version: 3,
      dailyBudget: 6,
      maxSteps: 6,
      escalation: ['No listing meets the hard requirements'],
      createdAt: now - 30 * DAY,
    },
    {
      id: id('agt'),
      orgId,
      name: 'AI Follow-Up Agent',
      type: 'follow_up',
      purpose: 'Drafts the next message from real matches and missing details; a person approves and sends it.',
      status: 'active',
      autonomy: 'approval_required',
      tools: ['get_lead', 'draft_customer_message', 'send_approved_message', 'create_task'],
      channel: 'sms',
      model: 'claude-opus-5-5',
      version: 5,
      dailyBudget: 10,
      maxSteps: 6,
      escalation: ['Lead replied with an objection', 'No channel has consent'],
      createdAt: now - 30 * DAY,
    },
    {
      id: id('agt'),
      orgId,
      name: 'AI Appointment Agent',
      type: 'appointment',
      purpose: 'Offers only verified free times and books showings without double-booking; reschedules and cancels.',
      status: 'active',
      autonomy: 'approval_required',
      tools: ['check_appointment_availability', 'request_appointment_booking', 'create_task'],
      channel: null,
      model: 'claude-opus-5-5',
      version: 2,
      dailyBudget: 5,
      maxSteps: 5,
      escalation: ['No free slot in the requested window'],
      createdAt: now - 30 * DAY,
    },
    {
      id: id('agt'),
      orgId,
      name: 'AI CRM & Data Intelligence Agent',
      type: 'data_quality',
      purpose: 'Finds duplicates and inconsistent records, proposes fixes and merges; a person approves every change.',
      status: 'active',
      autonomy: 'suggest_only',
      tools: ['scan_records', 'propose_merge', 'propose_fix'],
      channel: null,
      model: 'claude-opus-5-5',
      version: 2,
      dailyBudget: 5,
      maxSteps: 4,
      escalation: ['High-severity finding'],
      createdAt: now - 30 * DAY,
    },
    {
      id: id('agt'),
      orgId,
      name: 'AI Sales Intelligence Agent',
      type: 'sales_intelligence',
      purpose: 'Computes the funnel, sources and team metrics with fixed definitions and suggests where to focus. Never commits to terms.',
      status: 'active',
      autonomy: 'suggest_only',
      tools: ['run_metrics', 'create_task'],
      channel: null,
      model: 'claude-opus-5-5',
      version: 1,
      dailyBudget: 5,
      maxSteps: 5,
      escalation: ['Any contractual question'],
      createdAt: now - 30 * DAY,
    },
  ];

  /* 8 Production Workflow Templates */
  const wf = (
    key: string,
    name: string,
    description: string,
    trigger: string,
    steps: [string, Workflow['steps'][number]['kind']][],
    exitRules: string[],
    status: Workflow['status'] = 'active',
    owner: Workflow['owner'] = 'app',
  ): Workflow => ({
    id: id('wf'),
    orgId,
    key,
    name,
    description,
    trigger,
    status,
    version: 1,
    owner,
    maxRetries: 3,
    exitRules,
    steps: steps.map(([label, kind], i) => ({ key: `s${i}`, label, kind })),
  });

  const workflows: Workflow[] = [
    wf(
      'new_lead',
      'New lead acknowledgement & qualification',
      'Acknowledge within minutes, then run an AI qualification call during calling hours.',
      'lead.created.v1',
      [
        ['Lead created', 'trigger'],
        ['Check consent & calling hours', 'condition'],
        ['Send text acknowledgement', 'action'],
        ['AI qualification call', 'ai'],
        ['Validate & save extracted fields', 'action'],
        ['Create follow-up task', 'action'],
      ],
      ['Lead opts out', 'Human takes over', 'Lead disqualified'],
    ),
    wf(
      'no_answer',
      'No-answer callback sequence',
      'Retry unanswered calls with backoff — at most three attempts, then hand to a person.',
      'call.completed.v1 (no_answer)',
      [
        ['Call not answered', 'trigger'],
        ['Wait 2 hours', 'delay'],
        ['Retry call', 'ai'],
        ['Wait 1 day', 'delay'],
        ['Final attempt', 'ai'],
        ['Create callback task', 'action'],
      ],
      ['Lead replies', 'Max 3 attempts reached', 'Opt-out'],
    ),
    wf(
      'recommend',
      'Qualified lead property recommendations',
      'Match verified inventory and send the top three with reasons.',
      'lead.qualified.v1',
      [
        ['Lead qualified', 'trigger'],
        ['Match properties', 'ai'],
        ['Exclude stale listings', 'condition'],
        ['Draft recommendation', 'ai'],
        ['Request approval', 'action'],
        ['Send by text', 'action'],
      ],
      ['Lead books visit', 'Opt-out'],
    ),
    wf(
      'reminder',
      'Appointment confirmation & reminder',
      'Confirm on booking, remind 24 hours and 2 hours before the visit.',
      'appointment.booked.v1',
      [
        ['Appointment booked', 'trigger'],
        ['Send confirmation', 'action'],
        ['Wait until T-24h', 'delay'],
        ['Send reminder', 'action'],
        ['Wait until T-2h', 'delay'],
        ['Send final reminder', 'action'],
      ],
      ['Appointment cancelled', 'Rescheduled'],
    ),
    wf(
      'feedback',
      'Post-site-visit feedback',
      'Ask for feedback after a completed visit and update the lead.',
      'appointment.completed.v1',
      [
        ['Visit completed', 'trigger'],
        ['Wait 3 hours', 'delay'],
        ['Ask for feedback', 'action'],
        ['Summarize reply', 'ai'],
        ['Update lead', 'action'],
      ],
      ['No reply in 48h'],
    ),
    wf(
      'reengage',
      'Stale lead re-engagement',
      'Re-engage nurture leads with new matching inventory, where permitted.',
      'schedule (weekly)',
      [
        ['Weekly schedule', 'trigger'],
        ['Select nurture leads with consent', 'condition'],
        ['Find new matches', 'ai'],
        ['Send update', 'action'],
      ],
      ['Opt-out', 'Lead responds'],
      'paused',
    ),
    wf(
      'integration_alert',
      'Failed integration alert',
      'Notify admins when a provider fails repeatedly.',
      'integration.health_changed.v1',
      [
        ['Health degraded', 'trigger'],
        ['Check failure threshold', 'condition'],
        ['Notify admins', 'action'],
      ],
      [],
      'active',
      'n8n',
    ),
    wf(
      'sla',
      'Lead response SLA escalation',
      'Escalate to the manager when no first contact happens within the SLA.',
      'schedule (every 5 min)',
      [
        ['SLA timer', 'trigger'],
        ['Find leads past SLA', 'condition'],
        ['Notify manager', 'action'],
        ['Reassign if unclaimed', 'action'],
      ],
      ['First contact made'],
    ),
  ];

  /* Provider Integrations */
  const integ = (
    provider: string,
    category: Integration['category'],
    description: string,
    status: Integration['status'],
    scopes: string[],
    capabilities: string[],
  ): Integration => ({
    id: id('int'),
    orgId,
    provider,
    category,
    description,
    status,
    scopes,
    capabilities,
    error: null,
    lastSync: status === 'disconnected' ? null : now,
  });

  const integrations: Integration[] = [
    integ('Website form', 'lead_source', 'Embeddable enquiry form with signed submissions.', 'connected', ['leads:write'], ['Lead intake', 'Spam scoring']),
    integ('Generic webhook', 'lead_source', 'HMAC-signed endpoint for any portal or ad platform.', 'connected', ['leads:write'], ['Lead intake', 'Idempotency']),
    integ('Property Finder', 'lead_source', 'UAE portal leads via partner webhook.', 'connected', ['leads:read'], ['Lead intake']),
    integ('Bayut & Dubizzle', 'lead_source', 'TruCheck & portal lead notifications.', 'connected', ['leads:read'], ['Lead intake']),
    integ('Meta Lead Ads', 'lead_source', 'Instant-form leads from Facebook and Instagram.', 'connected', ['leads_retrieval', 'pages_show_list'], ['Lead intake', 'Campaign attribution']),
    integ('Retell AI Voice', 'voice', 'Outbound and inbound AI calling with recording.', 'connected', ['calls:write', 'recordings:read'], ['Outbound calls', 'Inbound calls', 'Recording', 'Status webhooks']),
    integ('Twilio SMS & WhatsApp', 'messaging', 'Two-way messaging from registered UAE sender.', 'connected', ['messages:write', 'messages:read'], ['Send', 'Receive', 'Opt-out handling', 'Delivery receipts']),
    integ('Google Workspace', 'email', 'Gmail, Calendar, Drive, Sheets, Contacts and Meet in one sign-in.', 'connected', ['gmail.send', 'gmail.readonly', 'calendar.events', 'drive.file'], ['Send', 'Receive', 'Calendar sync', 'Drive files']),
    integ('Postmark', 'email', 'Transactional email and inbound parsing.', 'connected', ['send', 'inbound'], ['Send', 'Receive']),
    integ('Anthropic', 'ai', 'Model provider for agents (no training on customer data).', 'connected', ['messages'], ['Extraction', 'Drafting', 'Summaries']),
    integ('n8n', 'automation', 'Connector-heavy workflows with run tracking.', 'connected', ['workflows:execute'], ['Integration alerts']),
  ];

  const sources: MarketingSource[] = SOURCES.map(([name, kind]) => ({
    id: id('src'),
    orgId,
    key: name.toLowerCase().replace(/\W+/g, '_'),
    name,
    kind,
    monthlySpend: 0,
    active: true,
  }));

  /* Commercial Production Ready: Zero Seeded Transactional Data */
  const contacts: Contact[] = [];
  const leads: Lead[] = [];
  const properties: Property[] = [];
  const deals: Deal[] = [];
  const appointments: Appointment[] = [];
  const tasks: Task[] = [];
  const conversations: Conversation[] = [];
  const calls: Call[] = [];
  const runs: Run[] = [];
  const approvals: Approval[] = [];
  const followUps: FollowUp[] = [];
  const webhookEvents: WebhookEvent[] = [];
  const usage: UsageRecord[] = [];
  const commissions: Commission[] = [];
  const expenses: Expense[] = [];
  const documents: DocumentRec[] = [];
  const audit: AuditLog[] = [];
  const activities: Activity[] = [];
  const notifications: Notification[] = [];

  return {
    members,
    contacts,
    leads,
    properties,
    deals,
    appointments,
    tasks,
    conversations,
    calls,
    agents,
    workflows,
    runs,
    approvals,
    followUps,
    integrations,
    webhookEvents,
    usage,
    commissions,
    expenses,
    documents,
    audit,
    activities,
    notifications,
    sources,
  };
}

export function generateAll(now = Date.now()) {
  const orgs = ORG_CONFIGS.map((c) => c.org);
  const data = ORG_CONFIGS.map((c) => generateOrg(c, now));
  const merged = {} as OrgData;
  for (const key of Object.keys(data[0]) as (keyof OrgData)[]) {
    (merged[key] as unknown[]) = data.flatMap((d) => d[key] as unknown[]);
  }
  return { orgs, ...merged };
}

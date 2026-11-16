// The 12 case milestones from the requirements register, mapped onto the OS stage track.
import type { DatabaseSync } from 'node:sqlite';
import { STAGES } from './workflow-engine';
import { approvedQuote } from './quotes';

const M = [
  ['01', 'New enquiry', 'Sales'], ['02', 'Fact-find', 'Advisor'], ['03', 'Indicative shortlist', 'Advisor'],
  ['04', 'Document review', 'Operations'], ['05', 'Bank submission', 'Bank Desk'], ['06', 'Decision and pre-approval', 'Bank Desk'],
  ['07', 'Property and valuation', 'Progression'], ['08', 'Final offer and conditions', 'Bank Desk'],
  ['09', 'Registration and transfer', 'Progression'], ['10', 'Disbursal', 'Progression'],
  ['11', 'Financial settlement', 'Finance'], ['12', 'Close or service', 'Operations'],
] as const;

export function milestonesFor(db: DatabaseSync, dealId: number) {
  const d = db.prepare('SELECT stage FROM deals WHERE id = ?').get(dealId) as { stage: string };
  const at = (s: string) => STAGES.indexOf(s as (typeof STAGES)[number]);
  const i = at(d.stage);
  const closed = d.stage === 'DECLINED' || d.stage === 'WITHDRAWN';
  const quote = !!approvedQuote(db, dealId) || (db.prepare("SELECT COUNT(*) c FROM deal_quotes WHERE deal_id = ? AND status IN ('APPROVED','SUPERSEDED')").get(dealId) as { c: number }).c > 0;
  const settled = (db.prepare("SELECT COUNT(*) c FROM commission_settlements WHERE deal_id = ? AND reconciliation_status = 'RECONCILED'").get(dealId) as { c: number }).c > 0;
  const done = [
    true, i >= at('DOC_COLLECTION'), quote || i >= at('UNDERWRITING_READY'), i >= at('UNDERWRITING_READY'), i >= at('IPA_SUBMITTED'), i >= at('IPA_APPROVED'),
    i >= at('VALUATION_RECEIVED'), i >= at('FOL_SIGNED'), i >= at('CHEQUES_READY'), i >= at('TRANSFERRED_DISBURSED'), settled,
    closed || (settled && i >= at('TRANSFERRED_DISBURSED')),
  ];
  const firstOpen = done.findIndex((x) => !x);
  return M.map(([no, label, owner], k) => ({ no, label, owner, state: closed && !done[k] ? 'closed' : done[k] ? 'done' : k === firstOpen ? 'current' : 'todo' }));
}

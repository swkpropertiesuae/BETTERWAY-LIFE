# Betterway OS: Deal Workflow

One track per deal. Screen: `/os/workflow` (Deal Desk + 37 playbooks). Code: `src/server/engines/workflow-engine.ts`, `scenarios.ts`.

Stages: Fact-find → KFS/CDD → Documents → Underwriting → IPA → IPA approved → MOU (Form F) → Valuation ordered → Valuation received → FOL issued → FOL signed → NOC/clearance → Cheques → Disbursed.
Buyout, equity release and construction skip MOU (no seller).

Rules:
- Forward move is blocked until its guard passes (KFS for every borrower, CDD, documents per scenario, valuation vs price, FOL audit, NOC, liability letters).
- IPA submission and disbursal keep their own screens (bank submission gate; ERP commission booking).
- Exceptions: promote backup bank, step back, withdraw, decline, reopen. Reason is required. Disbursed deals use ERP clawback.
- Every move writes the audit log and replaces the `[WF]` task for the next owner with an SLA due time.
- Scenario tags come from deal data (residency, employment, PEP, joint, FX/variable/rental income, off-plan, second home, over AED 5M, Islamic, grant, partner lead, APL status, seller mortgage, liabilities to clear). Tags choose required documents and playbooks.

Not verified against official sources: LTV tables, DLD fees, e-invoicing dates. Confirm before go-live.

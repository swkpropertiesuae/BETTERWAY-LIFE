# Requirements register coverage

Source: "Betterway Mortgages OS Requirements" (Nov 2026): 20 feature areas, 12 case milestones, 50 Excel file specs (35 launch, 10 phase 2, 5 conditional).
Status: **Built** = works and is tested. **Partial** = part works. **Not built** = needs accounts, keys or a scope decision.

## 20 feature areas

| # | Feature | Status | Where / gap |
|---|---|---|---|
| 01 | CRM and lead intake | Partial | Leads, sources, 5-min SLA, partner leads built. Missing: dedupe, WhatsApp/calls, suppression, lost reasons. Lead_Sources spec importable (10). |
| 02 | Borrower and fact-find | Built | Per-borrower income, liabilities, residency, KFS per borrower, per-borrower document list. |
| 03 | Eligibility and affordability | Partial | DBR/LTV/EMI/stress engine built. **New:** every quote saves inputs, rule version, offers, knock-out reasons. Rules still in code; imported Eligibility rules (04) stored, not yet read by the engine. |
| 04 | Bank and rate desk | Partial | Rate cards with maker-checker and validity dates exist. Bank/product/SLA specs (1-3, 5) importable and held until sourced/approved; engine does not yet read them. |
| 05 | Quote and disclosures | Built | Versioned quote, cash-to-close, 14-day expiry, advisor approval, override reason. Approved quote gates underwriting. KFS per borrower existed. |
| 06 | Documents and secure intake | Partial | Encrypted vault, validity checks, per-borrower checklist built. **New:** Document_Checklist_Rules (06) add mandatory docs. Missing: versions, e-sign, lender sharing log. |
| 07 | Case and bank workflow | Built | Primary + backup submissions, decline → promote backup, IPA expiry alerts, audit trail. |
| 08 | Property and handover | Partial | APL status, handover/off-plan, valuation shortfall options. Missing: auto manual-review on expired project eligibility. |
| 09 | Progression and closing | Built | Form F, valuation, liability letter, NOC, 72h cheques, disbursal only through ERP booking. |
| 10 | Finance and commissions | Built | Pay-when-paid, clawbacks, VAT, PINT-AE. Missing: payout approval evidence, duplicate-payment guard beyond status. |
| 11 | Security and compliance | Partial | Roles, audit log, encryption, complaints. **New:** export purpose + export log. Missing: MFA, retention jobs, incident and data-request workflows. |
| 12 | Reports and integrations | Partial | **New:** 15 generated Excel reports. Missing: connectors with retry. |
| 13 | Client workspace (Ph2) | Partial | Portal exists; no UAE PASS, no offer downloads. |
| 14 | Partner Hub (Ph2) | Partial | Built; no statement export (40 template only), no disputes. |
| 15 | OCR and AI (Ph2) | Not built | Needs OCR provider. |
| 16 | Growth and website (Ph2) | Not built | |
| 17 | Non-resident desk (Ph2) | Partial | Non-resident tag and lender knock-out; spec 36 importable. |
| 18 | Retention and HR (Ph2) | Partial | Radar, HR/WPS built; retention export (41) built. |
| 19 | Extended lending (cond.) | Partial | Commercial DSCR, cross-sell referrals. |
| 20 | Screenings and connectors (cond.) | Partial | AML screening local engine; no live connectors. |

## 12 case milestones

Mapped onto the 14 OS stages by `milestones.ts` and shown as a 12-segment bar on the deal form. 03 Indicative shortlist = approved quote. 11 Financial settlement = bank cash reconciled. 12 Close = settled or closed with reason.

## 50 Excel files

Catalog: `src/server/data-hub/specs.ts` (exact columns). Screen: `/os/data`.

- **Setup (21 files) and Migration (8) and Test (2):** blank template download (with guide sheet), CSV or XLSX import, per-row validation (types, dates, percentages, duplicates, effective window), rows without source/approver held and never used, new setup version supersedes old, batch reconciliation (source = accepted + held + rejected) and sign-off with evidence.
- **Engines that read imported setup:** 01 Bank master, 03 Products and rates, 04 Eligibility rules, 05 Employer/income policies (underwriting, tighten-only), 02 Bank contacts and SLAs (due dates, chase tasks, breach alerts, contacts on the deal), 06 Document checklist, 07 Fees (quote cash-to-close and the cheque pack), 08 Stage SLAs, owners and reason codes. Others stored only.
- **Exports built (15):** 24-33, 41, 43, 44, plus audit of every export. Restricted files (26, 31, 32, 33, 45, 47, 50) need role and purpose. Not generated yet: 36-39 are setup (import), 40, 42, 45, 47, 50 (template only).
- **Test:** 34 UAT cases generated from the 37 playbooks. 35 DR log is import-only; the actual restore test has not been run.

## Open decisions for Betterway (from the PDF itself)
- The "historical 24-hour payout target" needs sign-off and funding before it is enforced.
- AML scope (DNFBP) depends on actual licensed activities; spec 46-47 are conditional.
- Commercial/SME and ancillary referrals need service scope sign-off.
- The business owner must supply the real setup data (bank products, rules, fees, APL). The OS holds uncertain rows until sourced and approved.

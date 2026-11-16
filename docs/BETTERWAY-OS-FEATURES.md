# Betterway OS: Features List and Competitor Comparison

Niche: UAE mortgage brokerage (Dubai, Al Nasr Plaza). Status: features list only. Nothing new built yet.

Legend for **Status**:
- **IN ZIP**: exists in the uploaded `betterway-os.zip` (schema, engine or page found). Not yet run, tested or verified by me.
- **PARTIAL**: spec or table exists, UI or integration is thin or missing.
- **NEW**: not in the zip. Proposed.

---

## 1. Market snapshot (secondary sources, verify before relying on)

| Fact | Source quality |
|---|---|
| Huspy claims ~25-30% of Dubai residential home financing and a brokerage network that grew 75% since Jan 2026 | Company and directory claims, not audited |
| Holo markets AI document checks, income verification and lender formatting; 20+ lenders | Press release |
| Mortgage Finder (Property Finder Group) markets the widest panel, 15+ banks | Directory claim |
| 30+ digital mortgage platforms compete, pushing margins down | Paid research summary |
| Broker-executed property transactions in Dubai: 96,440 in 2025 (+54%) | Dubai Media Office (all brokered deals, not mortgages only) |
| DBR cap 50%. DLD mortgage registration fee 0.25% of loan + AED 290 | Consistent across blogs; confirm on CBUAE and DLD |
| LTV caps (80/75/70% by residency, price band, first or second home; off-plan lower) | **Sources conflict. Confirm in CBUAE rulebook before coding.** |
| Peppol PINT-AE e-invoicing: go-live dates reported inconsistently (July 2026 pilot, 1 Jan 2027 for large firms) | **Confirm on Ministry of Finance page; ASP appointment is critical path** |

Implication: rivals win on lead volume and AI document speed. A single-company OS wins on margin control (pay-when-paid commissions, clawbacks, VAT and WPS in one ledger), not on lead gen.

Sources: [Huspy / directory ranking](https://realestateclubdubai.com/business-directory/mortgage-brokers/rankings-2026), [Huspy growth](https://pulse2.com/huspy-acquires-luxuryx-as-uae-network-grows-75/), [Holo](https://www.arabianbusiness.com/tags/mortgages), [Dubai broker stats](https://mediaoffice.ae/en/news/2026/march/09-03/dubai-brokerage-sector-strengthens-its-role-as-a-key-driver-of-market-growth-in-2025), [UAE mortgage rules](https://realestateclubdubai.com/blog/buying-guide/uae-central-bank-50-percent-rule-2026-ltv-debt-burden-aed-5m-properties-explained), [Odoo UAE localization](https://ecosire.com/ar/blog/odoo-uae-localization-guide-2026).

---

## 2. Feature list by module

### M01 CRM and Omnichannel Inbox
| Feature | Status |
|---|---|
| Lead capture API (website calculators, HMAC + CORS) | IN ZIP |
| Households, applicants (primary, co-borrower, guarantor), liabilities | IN ZIP |
| Lead pipeline kanban, source and campaign attribution | IN ZIP |
| Comm log (messages table) | PARTIAL |
| WhatsApp Business API two-way inbox, templates, opt-in | NEW |
| Click-to-call / CTI, call recording, auto-log | NEW |
| Portal lead import (Bayut, Property Finder, Dubizzle), Meta/Google lead forms | NEW |
| Lead scoring, round-robin and skill-based routing, SLA timers | NEW |
| Duplicate detection (Emirates ID, phone) | NEW |
| Email sync, sequences, drip nurture | NEW |
| Tasks, reminders, calendar, meeting booking link | PARTIAL |
| Bilingual EN/AR templates | IN ZIP |

### M02 Loan Origination (LOS) and 24-Bank Engine
| Feature | Status |
|---|---|
| Fact-find, income types (salaried, self-employed, bonus, FX haircuts) | IN ZIP |
| 50% DBR, LTV tiers, tenure cap, EMI, stress tests | IN ZIP |
| Run one deal across 24 banks, ranked offers, knockouts | IN ZIP |
| Proposal pack EN/AR | IN ZIP |
| Government schemes (MRHE, SZHP) grants | IN ZIP |
| Commercial DSCR, HNW/SPV | IN ZIP |
| AECB credit report ingestion and liability reconciler | PARTIAL |
| Bank statement analyzer (EMI, BNPL, bounces) | IN ZIP |
| Document OCR: Emirates ID, passport, visa, salary certificate, payslip, trade licence | NEW |
| Document checklist per bank and per employment type, expiry rules | PARTIAL |
| Bank-formatted submission pack auto-build | NEW |
| Bank status tracking (IPA, valuation, FOL, disbursal) with BDM contacts | IN ZIP |
| Off-plan and handover mortgage flow | NEW |
| Buy-to-let, refinance, equity release, top-up, buyout flows | PARTIAL |
| Early-settlement and switching cost calculator (1% / AED 10k cap) | IN ZIP |

### M03 Bank Policy, Rates and Approved Project List
| Feature | Status |
|---|---|
| Rate cards with maker-checker approval | IN ZIP |
| EIBOR fixings and sync | IN ZIP |
| Tower-level APL, developers, projects | IN ZIP |
| Bank policy wiki with citations | IN ZIP |
| Rate-change alerts to open deals | NEW |
| Bank BDM scorecards (TAT, approval rate) | NEW |

### M04 Conveyancing and Progression
| Feature | Status |
|---|---|
| Contract F annexures, special conditions | IN ZIP |
| 72h trustee cheque splitter, down-valuation options | IN ZIP |
| Seller liability letter clock, developer NOC tracker | IN ZIP |
| Valuation order and appeal pack | PARTIAL |
| DLD fee calculator (transfer 4%, mortgage 0.25%, admin) | PARTIAL |
| Oqood / off-plan registration tracker | NEW |
| Completion checklist and client updates by WhatsApp | NEW |

### M05 Client Portal
| Feature | Status |
|---|---|
| Self-registration and magic-link invites | IN ZIP |
| Encrypted document vault (AES-256-GCM) | IN ZIP |
| Multi-applicant KFS e-sign | IN ZIP |
| 5-stage tracker, 90-day pre-revert refinance radar | IN ZIP |
| UAE PASS login and e-sign | NEW |
| Mobile app or PWA, push notifications | NEW |
| Arabic RTL polish, accessibility | PARTIAL |

### M06 Partner (Agency and BRN Agent) Hub
| Feature | Status |
|---|---|
| Agency admin vs agent isolation, masked deal view | IN ZIP |
| Instant lead drop, co-branded links and QR | IN ZIP |
| ORN/BRN verification, agreement gate, payout hold | IN ZIP |
| Self-billed partner tax invoices | IN ZIP |
| RERA broker card live verification | NEW |
| Partner leaderboard, tiering, marketing assets | NEW |

### M07 Cross-Sell (360)
| Feature | Status |
|---|---|
| Referral tracking to partners | IN ZIP |
| Life, property, home-contents insurance quotes | PARTIAL |
| Golden visa eligibility check by property value | NEW |
| Wills (DIFC/Abu Dhabi), FX, conveyancing add-ons | NEW |
| Property management and resale referral | NEW |

### M08 ERP and Finance
| Feature | Status |
|---|---|
| Chart of accounts, double-entry GL, trial balance | IN ZIP |
| Pay-when-paid commissions on bank bordereau, pro-rata tranches | IN ZIP |
| House clawback provision (GL 2200), next-deal offset | IN ZIP |
| Retro-slab month-end bank subvention revaluation | IN ZIP |
| VAT 201 with partial exemption, 9% corporate tax | IN ZIP |
| PINT-AE UBL 2.1 XML export | IN ZIP |
| Peppol ASP transmission (Accredited Service Provider) | NEW |
| Vendor bills with input-VAT category | IN ZIP |
| Legacy back-book importer | IN ZIP |
| Bank reconciliation from statement import | PARTIAL |
| Accounts payable and receivable aging, payment runs | NEW |
| Fixed assets, depreciation, prepayments | NEW |
| Budgets vs actuals, cost centres per branch/team | NEW |
| Multi-currency (AED, USD) | NEW |
| Petty cash and expense claims with receipt OCR | NEW |
| Financial statements (P&L, balance sheet, cash flow) | PARTIAL |
| Audit-ready exports, year-end close lock | NEW |
| Optional sync to external accounting (Zoho Books, QuickBooks, Xero) | NEW |

### M09 HRM and Payroll
| Feature | Status |
|---|---|
| Employee master (visa, Emirates ID, labour card, RERA card) | IN ZIP |
| Document expiry watchdog | IN ZIP |
| MOHRE WPS .SIF generator | IN ZIP |
| EOSB gratuity (basic-pay formula, cap) | IN ZIP |
| Advisor comp plans: slabs, draws, deficit rollover, lead-source multipliers | IN ZIP |
| Nafis / Emiratisation tracker, GPSSA | IN ZIP |
| Leave management per Decree-Law 33/2021 | PARTIAL |
| Recruitment ATS, offer letters, onboarding checklist | NEW |
| Health insurance and ILOE unemployment insurance tracking | NEW |
| Attendance, timesheets, geo check-in | NEW |
| Performance reviews, OKRs, training and CPD logs | NEW |
| Employee self-service app (payslips, leave, letters) | NEW |
| Disciplinary, grievance, termination workflow | NEW |
| Visa and PRO task workflow | NEW |

### M10 Compliance and Risk
| Feature | Status |
|---|---|
| KFS hard-gate for every obligated applicant | IN ZIP |
| CDD/EDD, sanctions and PEP screening | PARTIAL (local engine; live list feed NEW) |
| goAML STR/SAR XML vault, MLRO-only wall | IN ZIP |
| Sanadak complaint SLA register | IN ZIP |
| Append-only audit log | IN ZIP |
| UN/EOCN sanctions list auto-update | NEW |
| Record retention (5y) and legal hold | NEW |
| PDPL consent register, data-subject requests, breach log | NEW |
| Ad permit tracking (Trakheesi) and marketing approval | NEW |
| Staff training and attestation register | NEW |
| Quality audit sampling (10% monthly) | PARTIAL |

### M11 Internal Operations
| Feature | Status |
|---|---|
| Morning command board, ops tasks | IN ZIP |
| Wiki and bilingual templates | IN ZIP |
| Internal chat and announcements | NEW |
| Contract and e-sign (staff, partners) | NEW |
| Asset, licence and subscription register (trade licence renewal) | NEW |
| Vendor management | PARTIAL |
| Approvals engine (rates, payouts, expenses) | PARTIAL |

### M12 BI and Co-Pilot
| Feature | Status |
|---|---|
| Weighted cash forecast | IN ZIP |
| Attribution BI | IN ZIP |
| Deterministic policy co-pilot with citations | IN ZIP |
| Funnel, TAT, bank approval-rate, advisor productivity dashboards | PARTIAL |
| Commission and clawback exposure report | PARTIAL |
| Scheduled report email and export (CSV, PDF) | NEW |
| LLM assistant over OS data (read-only, role-aware) | NEW |

### Platform and Security (cross-cutting)
| Feature | Status |
|---|---|
| 10-role RBAC, Chinese walls | IN ZIP |
| Integer fils/bps math, unit-tested engines | IN ZIP |
| Single-company SQLite (zero-install) | IN ZIP |
| Production DB (Postgres), backups, point-in-time restore | NEW |
| MFA, SSO, IP allowlist, session controls | NEW |
| Field-level encryption for PII, key rotation | PARTIAL |
| UAE data residency hosting plan | NEW |
| Public API and webhooks, integration adapters | PARTIAL |
| Notifications (email, SMS, WhatsApp, in-app) | NEW |
| Full-text search across entities | NEW |
| Bilingual EN/AR across all screens | PARTIAL |
| Automated tests in CI, staging, deploy pipeline | NEW |

---

## 3. Comparison

Odoo/Zoho cells reflect general product scope plus the thin sources I found; **confirm with vendors**. Huspy/Holo are closed consumer platforms, so internal tooling is inferred from public marketing only.

| Capability | Betterway OS (target) | Odoo (Enterprise + UAE partner) | Zoho One | Huspy / Holo (closed) |
|---|---|---|---|---|
| Generic CRM, pipeline | Yes | Yes | Yes (Zoho CRM) | Internal only |
| 24-bank DBR/LTV/EMI ranking | Yes, native | Custom dev | Custom dev (Deluge) | Yes (their product) |
| Tower-level APL, bank policy | Yes | Custom | Custom | Partial |
| KFS gate, CDD, goAML MLRO wall | Yes | Custom | Custom | Unknown |
| Contract F / DLD trustee cheque split | Yes | No | No | Unknown |
| Pay-when-paid commissions on bank bordereau | Yes | Custom | Custom | Internal |
| Clawback provision and next-deal offset | Yes | Custom | Custom | Unknown |
| Double-entry GL, VAT 201, 9% CT | Yes | Yes (mature) | Yes (Zoho Books) | N/A |
| PINT-AE e-invoice | XML export; ASP link NEW | Enterprise module (ASP needed) | Reported "updating" | N/A |
| WPS .SIF payroll | Yes | Not native (reported) | Reported limited | N/A |
| EOSB, Nafis, GPSSA | Yes | Partner add-on | Limited | N/A |
| Arabic RTL | Partial | Yes | Yes | Yes |
| Marketplace of apps, accounting depth, inventory/projects | Weak | Very strong | Very strong | N/A |
| Per-seat licence cost | None | Yes | ~AED 130/user/month (one vendor listing) | N/A |
| Time to run | Exists, unverified | Weeks to months | Weeks | N/A |
| Lead flow and brand | None | None | None | Strong |

Where Betterway OS should not compete: generic inventory, manufacturing, projects, app marketplace. Integrate instead (Zoho Books or QuickBooks sync option, M08).

---

## 4. Proposed build priority

1. **Verify the zip**: install, run tests, `next build`, smoke every page. Unknown today.
2. **Regulatory correctness**: confirm LTV caps, DLD fees, e-invoicing dates, WPS format with official documents.
3. **Revenue engine**: WhatsApp inbox, portal lead import, lead routing and SLA, OCR document intake, AECB.
4. **Production readiness**: Postgres, backups, MFA, UAE hosting, CI.
5. **Finance depth**: AP/AR, bank recon, ASP for Peppol.
6. **HR depth**: ATS, attendance, ESS, ILOE and insurance.
7. **Compliance depth**: live sanctions feeds, PDPL, Trakheesi.

## 5. Open questions for you

- Headcount and number of advisors (drives HR depth and ASP choice).
- Does Betterway hold a CBUAE or only a DLD/RERA brokerage licence? Affects which compliance duties apply.
- Hosting: keep zero-install local SQLite, or move to UAE-hosted cloud with Postgres?
- Which accounting system, if any, must stay as master?

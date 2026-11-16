# Betterway OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete, standalone, 12-module single-company UAE Mortgage Brokerage Operating System (**Betterway OS**) in `C:\Users\shamh\.gemini\antigravity\scratch\betterway-os` running on port `3001` with ACID SQLite persistence, 10-role RBAC + Chinese walls, encrypted document vault, and real UAE `.SIF`, `PINT-AE UBL 2.1 XML`, and `goAML XML` file exporters.

**Architecture:** Modular full-stack Next.js 15 App Router system backed by Node 26 native `node:sqlite` (`WAL` mode, 41 tables initialized upfront, append-only `audit_logs` triggers, integer `fils` and `bps` arithmetic) and 6 pure deterministic TypeScript domain engines (`underwriting`, `conveyancing`, `commission-clawback`, `ledger-tax`, `wps-gratuity`, and `compliance-aml` / `statement-policy-copilot`).

**Tech Stack:** Next.js `15.5`, React `19`, TypeScript `5.9`, Tailwind CSS `v4`, `node:sqlite`, `node:crypto` (`scryptSync`, `AES-256-GCM`, `HMAC-SHA256`), `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-16-betterway-os-design.md`

## Global Constraints
- Single-company proprietary OS for **Betterway Mortgages** (`Al Nasr Plaza, Oud Metha, Dubai, UAE`); zero multi-tenancy overhead.
- Port `3001` (`http://localhost:3001`) so `swk.property` (`port 3000`) runs concurrently without conflict.
- Integer UAE `fils` (`1 AED = 100 fils`) for all currency storage/math; integer `bps` (`1.00% = 100 bps`) for rates/margins; `micro_pct` (`1.00000% = 100000`) for 5-decimal CBUAE EIBOR fixings.
- **Pay-when-paid** Partner & Advisor commissions triggered only upon bank bordereau cash receipt (pro-rata on partial receipts); B2B Partner `split_bps` applies **exclusively to Bank Subvention**, never to `direct_client_fee_fils`.
- **100% settlement payout** upon bank cash receipt + **House IFRS-15 Clawback Provision (`GL 2200`)** + recoverable Partner/Advisor Clawback Debit Offset on next settlement/payroll if an early bank clawback occurs.
- **Chinese Walls:** `goaml_reports` accessible strictly when `user.is_mlro === 1`; `PARTNER_AGENT` isolated to own `partner_agent_id` masked deals (instant lead-drop allowed; payout gated on `VERIFIED` ORN + `SIGNED` agreement) vs. `PARTNER_AGENCY_ADMIN` viewing agency-wide masked deals, IBAN/TRN, and tax invoices; `CLIENT` isolated to own `household_id` with **every obligated applicant (`PRIMARY`, `CO_BORROWER`, `GUARANTOR`)** required to sign `kfs_acknowledgements` before passing `IPA_SUBMITTED`.

## Review Focus
1. Partial bank bordereau cash receipt (`e.g., 50% tranche`) followed by remainder tranche must never double-pay Partner or Advisor commissions above 100% of entitlement.
2. Joint mortgage deal where `PRIMARY` signed KFS + cleared CDD, while `CO_BORROWER` has not signed KFS, must hard-block transition to `IPA_SUBMITTED`.
3. `SUPER_ADMIN` with `is_mlro = 0` attempting to read or export `goaml_reports` must receive a `403` Chinese-wall rejection.
4. `PARTNER_AGENT` querying `/api/v1/partners/overview` must never receive borrower salary, AECB score, vault files, colleague BRN deals, or agency IBAN.
5. `LEGACY_BACKBOOK` CSV import must populate `homeowner_radar_monitors` and `clawback_ledger` without creating current-period `GL 4100` revenue or `GL 2300` Output VAT entries.

---

### Task 1: Unified 41-Table SQLite Schema, Seeders, Auth/RBAC & Encrypted Vault Core
- [ ] RED test `src/server/db/db-and-auth.test.ts` (41 tables, `audit_logs` append-only trigger, scrypt/session lifecycle, 10-role Chinese-wall guards, AES-256-GCM vault round-trip + tamper detection)
- [ ] Implement `src/server/db/schema.ts`, `src/server/db/index.ts`, `src/server/db/seed.ts`, `src/server/auth/index.ts`, `src/server/vault/crypto.ts`
- [ ] Verify GREEN & commit

### Task 2: Wave 1 Domain Engines — 24-Bank CBUAE Underwriting, Maker-Checker & Conveyancing / 72h Cheque Splitter
- [ ] RED test `src/server/engines/underwriting-conveyancing.test.ts` (50% DBR w/ 3% vs 5% cards, FX & bonus haircuts, self-employed net profit × ownership %, MRHE/SZHP grants, Tower APL knockouts, self-approval block on rate cards, 72h DLD Trustee cheque fils split & down-valuation options)
- [ ] Implement `src/server/engines/underwriting-engine.ts` and `src/server/engines/conveyancing-engine.ts`
- [ ] Verify GREEN & commit

### Task 3: Wave 2 & 3 Domain Engines — Multi-Applicant KFS / `goAML` Isolation + Pay-When-Paid ERP, Clawback Offset, FTA VAT/CT, `PINT-AE` XML & Back-Book Importer
- [ ] RED test `src/server/engines/erp-compliance.test.ts` (joint KFS hard-gate, MLRO `goAML` isolation & XML export, balanced GL enforcement, pay-when-paid pro-rata tranches on Bank Subvention only, ORN payout hold, House `GL 2200` clawback provision + next-deal Partner/Advisor debit offset, FTA `VAT 201` w/ partial exemption, `9%` CT > `AED 375k`, `PINT-AE UBL 2.1 XML`, and `LEGACY_BACKBOOK` importer)
- [ ] Implement `src/server/engines/compliance-aml-engine.ts`, `src/server/engines/ledger-tax-engine.ts`, `src/server/engines/commission-clawback-engine.ts`, and `src/server/engines/backbook-importer.ts`
- [ ] Verify GREEN & commit

### Task 4: Wave 4 Domain Engines — UAE HRM, MOHRE WPS `.SIF`, Statutory `EOSB` Gratuity, `Nafis`/`GPSSA` & Deterministic Statement/Policy Co-Pilot
- [ ] RED test `src/server/engines/hrm-copilot.test.ts` (MOHRE `.SIF` `EDR`+`SCR` fixed/variable & unpaid leave math, Basic-Salary-only `EOSB` 21d/30d formula + 24m cap, `Nafis` headcount & `GPSSA` split, deterministic bank-statement EMI/BNPL/bounce detector & citation policy search)
- [ ] Implement `src/server/engines/wps-gratuity-engine.ts` and `src/server/engines/statement-and-policy-copilot.ts`
- [ ] Verify GREEN & commit

### Task 5: Unified Server Actions / REST API Layer & Complete Bilingual UI Across All 12 Modules (`/login`, `/os/*`, `/portal`, `/partners`, `/api/v1/*`)
- [ ] RED test `src/server/api-integration.test.ts` exercising end-to-end API/service workflows (`Intake Lead -> Fact-Find -> Joint KFS -> IPA -> Conveyancing Cheque Split -> Disbursal -> Bordereau Pay-When-Paid -> PINT-AE XML -> Payroll .SIF`)
- [ ] Implement `src/server/services/os-service.ts` + Next.js Route Handlers (`/api/v1/...` including `.SIF`, `PINT-AE XML`, `goAML XML`, Vault encrypted file download, EIBOR sync, and Lead Intake webhook)
- [ ] Implement Midnight Banking Navy & Sovereign Gold UI theme (`EN` LTR + `العربية` RTL) and interactive workspaces across `/login`, `/os/command`, `/os/crm`, `/os/los`, `/os/banks-apl`, `/os/conveyancing`, `/os/cross-sell`, `/os/erp`, `/os/hrm`, `/os/compliance`, `/os/wiki`, `/os/bi-copilot`, `/portal`, and `/partners`
- [ ] Verify GREEN (`npm test` + `npm run build`) & commit

### Task 6: Whole-Branch Code Review, Live Browser Verification (`localhost:3001`) & Clean `betterway-os.zip` Delivery
- [ ] Dispatch independent `self` code-reviewer subagent across the full branch; fix any Critical/Important findings via RED→GREEN TDD
- [ ] Merge `feat/betterway-os-complete` to `main`, start persistent `next start -p 3001`, verify live workflows across Internal OS, Client Portal, and Partner Hub via `browser` subagent, and archive `C:\Users\shamh\.gemini\antigravity\scratch\betterway-os.zip`

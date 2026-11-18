# Betterway OS design system

Composition follows SWK OS ("the calm operating wallet"): light header with breadcrumb, dark per-app sidebar,
floating white surfaces on an Institutional Alabaster ledger-grid canvas, capsule controls.
Palette is unified 1:1 with the public `BetterwayMortgages` website so there is zero color shift between Website and OS.

## Palette: Midnight Banking Navy, Sovereign Gold, Institutional Alabaster

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--bg` | `#f8f9fa` Institutional Alabaster |
| Surface | `--surface` | `#ffffff` |
| Ink | `--text` / `--navy` | `#021125` Midnight Banking Navy |
| Body / muted | `--text-2` / `--text-3` | `#4a5868` / `#64748b` |
| Lines | `--border` / `--border-strong` | `#e2e6ea` / `#cbd5e1` |
| Primary action | `--primary` / `--accent` | `#021125` Midnight Banking Navy (hover `#072244`) |
| Accent | `--champ` | `#d7b04e` Sovereign Gold (text on light: `#8a6518` Deep Bullion) |
| Success | `--success` | `#0d8a52` Emerald |
| Warning | `--warning` | `#b45309` Amber |
| Danger | `--danger` | `#bc3a26` Brick |
| Info | `--info` | `#072244` Royal Navy |

## Structure

- `src/lib/os-apps.ts`: the single app/page model (10 apps). Estate OS workspace pages are `/os#/<key>`.
- `src/lib/staff-directory.ts` & `src/components/staff-avatar.tsx`: 9 official Betterway Mortgages LLC accounts (`Shabib Siraj`, `Warda`, `Betterway Admin`, `Daniel Xavier`, `Rahaba Azeez`, `Mohammad Nusrik`, `Elton Frank`, `Reshma Rajan`, `Asif Khan`) with studio-retouched portraits in `/public/staff/*.jpg` rendered wherever their name appears in the OS.
- `src/lib/uae-deal-toolkit.ts` & `src/app/os/toolkit/page.tsx`: 8-tool SWK-grade UAE Deal & Mortgage Toolkit.
- `src/app/os/reception-qr/page.tsx` & `src/components/reception-qr-client.tsx`: Real scannable Reception QR Stand (`?print=1`) + Office Wi-Fi & Device Anti-Loophole Check-In (`?scan=1`).
- `src/components/os-chrome.tsx`: `OsFrame` (header, per-app sidebar, mobile drawer), `QuickAdd`, `DubaiClock`, `BrandMark`.
- `src/components/swk-shell.tsx`: frame for server-rendered `/os/*` pages. `src/estate-os/layout/Shell.tsx`: frame for `/os`.
- `src/styles/swk-os.css`: header, sidebar, launcher, dashboard desk, capsule buttons/tabs, tables, cards.

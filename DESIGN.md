# Betterway OS design system

Composition follows SWK OS ("the calm operating wallet"): light header with breadcrumb, dark per-app sidebar,
floating white surfaces on a bone ledger-grid canvas, capsule controls. Palette is Betterway's own.

## Palette: oxblood, brass, bone

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--bg` | `#f6f1ea` bone |
| Surface | `--surface` | `#ffffff` |
| Ink | `--text` | `#2a1418` |
| Body / muted | `--text-2` / `--text-3` | `#4d3a3c` / `#76665f` |
| Lines | `--border` / `--border-strong` | `#e7dccd` / `#d3c4ae` |
| Primary action | `--primary` / `--accent` | `#7a1f2b` oxblood (hover `#651822`, deep `#5a1620`) |
| Accent | `--champ` | `#b08a3e` brass (on dark: `#c9a257`, text on light: `#7d5f1f`) |
| Success | `--success` | `#587536` moss |
| Warning | `--warning` | `#9a6f1f` ochre |
| Danger | `--danger` | `#bc3a26` brick, kept apart from the oxblood brand |
| Info | `--info` | `#3b566d` ink slate |

Launcher tiles use six tones (oxblood, brass, moss, ink, copper, plum). No stock blue, teal or purple gradients.
Tailwind's default `slate/gray/emerald/rose/amber/teal/blue/violet` ramps are remapped in `src/app/globals.css` (`@theme`),
so utility classes follow the brand. Estate OS tokens live in `src/estate-os/styles/tokens.css`; the dark theme is deep oxblood-black.

## Structure

- `src/lib/os-apps.ts`: the single app/page model (10 apps). Estate OS workspace pages are `/os#/<key>`.
- `src/components/os-chrome.tsx`: `OsFrame` (header, per-app sidebar, mobile drawer), `QuickAdd`, `DubaiClock`, `BrandMark`.
- `src/components/swk-shell.tsx`: frame for server-rendered `/os/*` pages. `src/estate-os/layout/Shell.tsx`: frame for `/os`.
- `src/styles/swk-os.css`: header, sidebar, launcher, dashboard desk, capsule buttons/tabs, tables, cards.

## Type and shape

Plus Jakarta Sans (display), Inter (body), Instrument Serif (greeting and italic emphasis), JetBrains Mono (eyebrows, figures).
Surfaces 20-24px radius, fields 12px, buttons/nav/tabs/chips are capsules, icon buttons are circles.

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Clock3,
  Inbox,
  Landmark,
  LayoutDashboard,
  QrCode,
  Search,
  Send,
  UserPlus,
  X,
} from 'lucide-react';
import { CORPORATE_NAV_SECTIONS } from '@/components/swk-shell';

function dubaiGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function dubaiToday() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

const RECENT_SHORTCUTS = [
  { label: 'Overview', to: '/os', icon: LayoutDashboard },
  { label: 'Leads & 5m SLA', to: '/os/crm', icon: UserPlus },
  { label: 'Unified Inbox', to: '/os/inbox', icon: Inbox },
  { label: '24-Bank Underwriting', to: '/os/los', icon: Landmark },
  { label: 'DLD & Cheque Pack', to: '/os/conveyancing', icon: Send },
  { label: 'Reception QR', to: '/os/reception-qr', icon: QrCode },
];

export function LauncherClient({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const shownApps = useMemo(() => {
    return CORPORATE_NAV_SECTIONS.filter(
      (a) =>
        !needle ||
        a.label.toLowerCase().includes(needle) ||
        a.blurb.toLowerCase().includes(needle),
    );
  }, [needle]);

  const matchingFeatures = useMemo(() => {
    if (!needle) return [];
    return CORPORATE_NAV_SECTIONS.flatMap((a) =>
      a.items.map((i) => ({ ...i, app: a.label })),
    ).filter(
      (i) =>
        i.title.toLowerCase().includes(needle) ||
        i.desc.toLowerCase().includes(needle) ||
        i.app.toLowerCase().includes(needle),
    );
  }, [needle]);

  const openFirst = () => {
    const target = matchingFeatures[0]?.url ?? shownApps[0]?.items[0]?.url;
    if (target) router.push(target);
  };

  return (
    <div className="swk-launch">
      {/* Dark Obsidian Hero Banner (.swk-launch-hero) */}
      <header className="swk-launch-hero">
        <img
          src="/brand/logo-white-gold-transparent.svg"
          alt="Betterway Mortgages OS"
          className="swk-launch-logo"
        />
        <div className="swk-eyebrow swk-launch-date">
          Betterway Mortgages LLC · Business Workspace · {dubaiToday()}
        </div>
        <h1>
          {dubaiGreeting()}
          {firstName ? `, ${firstName}` : ''}.
        </h1>
        <form
          className="swk-launch-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            openFirst();
          }}
        >
          <Search size={18} aria-hidden />
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Search apps or pages…"
            aria-label="Search apps and features"
            autoFocus
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-[#9d9a94] hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </form>
      </header>

      {/* Recently Opened Shortcuts */}
      {!needle && (
        <section className="swk-launch-recent" aria-label="Recently opened">
          <span className="lbl">
            <Clock3 size={14} />
            Recent
          </span>
          {RECENT_SHORTCUTS.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.to} href={r.to} className="swk-launch-chip">
                <Icon size={15} />
                {r.label}
              </Link>
            );
          })}
        </section>
      )}

      {/* Search Results */}
      {matchingFeatures.length > 0 && (
        <section aria-label="Matching features" className="mb-6 max-w-[780px] mx-auto">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2 px-1">
            Pages ({matchingFeatures.length})
          </h2>
          <ul className="list-none m-0 p-1.5 bg-white border border-[var(--line)] rounded-2xl shadow-sm divide-y divide-[var(--line)]">
            {matchingFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.url}>
                  <Link
                    href={f.url}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#eaf2f9] transition-colors"
                  >
                    <span className="w-9 h-9 rounded-lg grid place-items-center bg-[var(--soft)] text-[var(--ink)] shrink-0">
                      <Icon size={17} />
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <b className="text-[13.5px] font-semibold text-[var(--ink)]">{f.title}</b>
                      <small className="text-xs text-[var(--muted)] truncate">{f.desc}</small>
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0f4c81] shrink-0">
                      {f.app}
                    </span>
                    <ArrowUpRight size={16} className="text-[var(--muted)] shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 4-Column App Tile Grid (.swk-launch-grid) */}
      {shownApps.length > 0 && (
        <section className="swk-launch-grid" aria-label="Apps">
          {shownApps.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.key}
                href={app.items[0]!.url}
                className="swk-app-tile"
                title={app.blurb}
              >
                <span className="swk-app-icon">
                  <Icon size={28} strokeWidth={1.8} />
                </span>
                <span className="swk-app-name">{app.label}</span>
                <span className="swk-app-sub">{app.items.length} apps</span>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}

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
import { BrandMark } from '@/components/os-chrome';
import { OS_APPS } from '@/lib/os-apps';

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
    return OS_APPS.filter(
      (a) =>
        !needle ||
        a.label.toLowerCase().includes(needle) ||
        a.blurb.toLowerCase().includes(needle),
    );
  }, [needle]);

  const matchingFeatures = useMemo(() => {
    if (!needle) return [];
    return OS_APPS.flatMap((a) =>
      a.items.map((i) => ({ ...i, app: a.label })),
    ).filter(
      (i) =>
        i.label.toLowerCase().includes(needle) ||
        i.desc.toLowerCase().includes(needle) ||
        i.app.toLowerCase().includes(needle),
    );
  }, [needle]);

  const openFirst = () => {
    const target = matchingFeatures[0]?.href ?? shownApps[0]?.items[0]?.href;
    if (!target) return;
    if (target.startsWith('/os#')) window.location.href = target;
    else router.push(target);
  };

  return (
    <div className="swk-launch">
      <header className="swk-launch-hero">
        <div className="swk-launch-logo">
          <BrandMark size={52} />
          <span className="name">
            Betterway Mortgages<i>OS</i>
          </span>
        </div>
        <div className="swk-launch-date">
          Betterway Mortgages LLC · Business Workspace · {dubaiToday()}
        </div>
        <h1>
          {dubaiGreeting()}
          {firstName ? (
            <>
              , <em>{firstName}</em>
            </>
          ) : null}
          .
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
        <section aria-label="Matching features" className="swk-launch-results">
          <h2>Pages ({matchingFeatures.length})</h2>
          <ul>
            {matchingFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.href}>
                  <a href={f.href}>
                    <span className="ic">
                      <Icon size={17} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <b className="t">{f.label}</b>
                      <small className="s">{f.desc}</small>
                    </span>
                    <span className="swk-eyebrow" style={{ margin: '0 0 0 auto' }}>{f.app}</span>
                    <ArrowUpRight size={16} className="go" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {needle && matchingFeatures.length === 0 && shownApps.length === 0 && (
        <p className="swk-launch-empty">Nothing matches “{query}”. Try “DBR”, “KFS”, “payroll” or “bank”.</p>
      )}

      {/* 4-Column App Tile Grid (.swk-launch-grid) */}
      {shownApps.length > 0 && (
        <section className="swk-launch-grid" aria-label="Apps">
          {shownApps.map((app) => {
            const Icon = app.icon;
            const first = app.items[0]!.href;
            return (
              <a key={app.key} href={first} className={`swk-app-tile tone-${app.tone}`} title={app.blurb}>
                <span className="swk-app-icon">
                  <Icon size={30} strokeWidth={1.7} />
                </span>
                <span className="swk-app-name">{app.label}</span>
                <span className="swk-app-sub">{app.items.length} apps</span>
                <span className="swk-app-blurb">{app.blurb}</span>
              </a>
            );
          })}
        </section>
      )}
    </div>
  );
}

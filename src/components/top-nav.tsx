'use client';
import { usePathname } from 'next/navigation';
import { appFor, APPS } from '@/lib/apps';

export function TopNav({ lang }: { lang: 'en' | 'ar' }) {
  const path = usePathname();
  const app = appFor(path);
  const t = (a: { en: string; ar: string }) => (lang === 'ar' ? a.ar : a.en);
  const here = (href: string) => path === href.split('?')[0] && (!href.includes('?') || typeof window === 'undefined' || window.location.search.includes(href.split('?')[1]));
  return (
    <nav className="flex items-center gap-1 min-w-0 overflow-x-auto order-last w-full md:order-none md:w-auto md:flex-1">
      <a href="/os" aria-label="All apps" className="grid place-items-center h-9 w-9 rounded-full bg-[#2a1418] shrink-0 hover:scale-105 transition">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="#c9a257">{[0, 6, 12].flatMap((x) => [0, 6, 12].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="4.5" height="4.5" rx="1.2" />))}</svg>
      </a>
      <span className="font-display font-extrabold text-sm text-[#2a1418] px-3 shrink-0">{app ? t(app) : 'Betterway OS'}</span>
      <span className="flex gap-0.5 rounded-full bg-slate-100/80 p-1">
        {app
          ? app.menus.map((m) => <a key={m.href} href={m.href} className={`bw-pill shrink-0 ${here(m.href) ? 'bw-pill-active' : 'bw-pill-idle'}`}>{t(m)}</a>)
          : APPS.map((a) => <a key={a.key} href={a.home} className="bw-pill bw-pill-idle shrink-0">{t(a)}</a>)}
      </span>
    </nav>
  );
}

'use client';
import { usePathname } from 'next/navigation';
import { appFor } from '@/lib/apps';

export function TopNav({ lang }: { lang: 'en' | 'ar' }) {
  const path = usePathname();
  const app = appFor(path);
  const t = (a: { en: string; ar: string }) => (lang === 'ar' ? a.ar : a.en);
  return (
    <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
      <a href="/os" aria-label="Apps" className="grid place-items-center h-8 w-8 rounded hover:bg-white/10 shrink-0">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="#D7B04E">{[0, 6, 12].flatMap((x) => [0, 6, 12].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="4.5" height="4.5" rx="1" />))}</svg>
      </a>
      {app ? (
        <>
          <span className="font-bold text-sm text-white px-2 shrink-0">{t(app)}</span>
          {app.menus.map((m) => (
            <a key={m.href} href={m.href} className={`px-2.5 py-1.5 rounded text-xs shrink-0 ${path === m.href.split('?')[0] ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10'}`}>{t(m)}</a>
          ))}
        </>
      ) : <span className="font-bold text-sm text-white px-2">Betterway OS</span>}
    </div>
  );
}

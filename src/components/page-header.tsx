import type { ReactNode } from 'react';

// Shared page header: breadcrumb (app / page), title, optional subtitle and right-side actions.
export function PageHeader({ app, appHref = '/os', title, sub, children }: { app: string; appHref?: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-slate-500">
          <a className="underline" href={appHref}>{app}</a>
        </div>
        <h1 className="font-display text-xl font-bold text-[#021125] leading-tight">{title}</h1>
        {sub && <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 items-center">{children}</div>}
    </div>
  );
}

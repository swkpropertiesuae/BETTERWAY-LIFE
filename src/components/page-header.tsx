import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  app,
  appHref = '/os',
  title,
  sub,
  children,
}: {
  app: string;
  appHref?: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="swk-module-head">
      <div className="min-w-0 space-y-1">
        <div className="swk-eyebrow">
          <Link href={appHref} className="hover:underline">
            Betterway Mortgages LLC · {app}
          </Link>
        </div>
        <h1 className="swk-module-title">{title}</h1>
        {sub && <p className="swk-module-sub">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
    </header>
  );
}

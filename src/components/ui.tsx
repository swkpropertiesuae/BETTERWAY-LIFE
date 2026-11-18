import type { ReactNode } from 'react';
import { Users, Landmark, KeyRound, Wallet, UserCog, ShieldCheck, ListChecks, Database, BookOpen, ChartColumn, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { sales: Users, mortgage: Landmark, conveyancing: KeyRound, accounting: Wallet, hr: UserCog, compliance: ShieldCheck, activities: ListChecks, data: Database, knowledge: BookOpen, reporting: ChartColumn };
export const AppIcon = ({ k, size = 22 }: { k: string; size?: number }) => { const I = ICONS[k] ?? Database; return <I size={size} strokeWidth={1.8} />; };

const PALETTE = ['#dcae8e', '#e0b9bd', '#c9a257', '#e8b2b8', '#b3c79c', '#dcc183', '#e3a79a'];
export const Avatar = ({ name, size = 32 }: { name: string; size?: number }) => {
  const i = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
  const ini = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span style={{ width: size, height: size, background: PALETTE[i], fontSize: size * 0.38 }} className="inline-grid place-items-center rounded-full font-bold text-[#021125] shrink-0 ring-2 ring-white">{ini}</span>;
};

/** Colour KPI tile (pastel gradient, big number). */
export function Tile({ tone, title, value, sub, href, icon }: { tone: string; title: string; value: ReactNode; sub?: string; href?: string; icon?: ReactNode }) {
  const body = (
    <>
      <div className="flex items-center justify-between text-[11px] font-semibold text-[#021125]/70">
        <span>{title}</span>{icon && <span className="grid place-items-center h-7 w-7 rounded-full bg-white/60">{icon}</span>}
      </div>
      <div className="font-display text-2xl font-extrabold text-[#021125] mt-2 leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[#021125]/60 mt-1.5">{sub}</div>}
    </>
  );
  const cls = `bw-tile bw-tone-${tone} bw-rise`;
  return href ? <a href={href} className={cls}>{body}</a> : <div className={cls}>{body}</div>;
}

/** Semi-circle gauge, 0-100. */
export function Gauge({ value, label, color = '#b84a58' }: { value: number; label?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const len = Math.PI * 52;
  return (
    <svg viewBox="0 0 120 70" className="w-full max-w-[150px]" role="img" aria-label={`${label ?? ''} ${v}%`}>
      <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="#efe7da" strokeWidth="12" strokeLinecap="round" />
      <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(len * v) / 100} ${len}`} />
      <text x="60" y="58" textAnchor="middle" className="font-display" fontSize="22" fontWeight="800" fill="#021125">{Math.round(v)}%</text>
    </svg>
  );
}

/** Small ring, 0-100. */
export function Ring({ value, size = 44, color = '#b84a58', children }: { value: number; size?: number; color?: string; children?: ReactNode }) {
  const v = Math.max(0, Math.min(100, value)), r = 16, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size} className="-rotate-90"><circle cx="20" cy="20" r={r} fill="none" stroke="#efe7da" strokeWidth="5" /><circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} /></svg>
      <span className="absolute text-[10px] font-bold text-[#021125]">{children ?? `${Math.round(v)}`}</span>
    </span>
  );
}

/** Rounded vertical bars like the finance mock-ups. */
export function Bars({ data, color = '#e0b9bd', highlight }: { data: { label: string; value: number }[]; color?: string; highlight?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d, i) => (
        <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
          <span className="text-[10px] font-semibold text-slate-500">{d.value || ''}</span>
          <div className="w-8 max-w-full rounded-full" style={{ height: Math.max(10, (d.value / max) * 64), background: i === highlight ? '#021125' : color, opacity: d.value ? 1 : 0.35 }} />
          <span className="text-[9px] text-slate-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

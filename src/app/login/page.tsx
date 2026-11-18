import Link from 'next/link';
import { defaultHomeForRole, getCurrentUser } from '@/server/auth/request';
import { ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck } from 'lucide-react';

function FloatingPathsSvg({ position }: { position: number }) {
  const paths = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    width: 0.5 + i * 0.03,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${
      312 - i * 5 * position
    } ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${
      470 - i * 6
    } ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full" style={{ color: '#c9a257' }} fill="none" viewBox="0 0 696 316">
        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            stroke="currentColor"
            strokeOpacity={0.06 + p.id * 0.018}
            strokeWidth={p.width}
          />
        ))}
      </svg>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;

  const staffProfiles = [
    {
      label: 'Shabib Siraj',
      role: 'Founder & Managing Director',
      email: 'shabib@betterwaymortgages.com',
    },
    {
      label: 'Betterway Admin',
      role: 'System Administrator',
      email: 'admin@betterwaymortgages.com',
    },
    {
      label: 'Mohammad Haseeb',
      role: 'Operations Manager',
      email: 'haseeb@betterwaymortgages.com',
    },
    {
      label: 'Talha Shabbir',
      role: 'BDM & IT Specialist',
      email: 'talha@betterwaymortgages.com',
    },
    {
      label: 'Fareed',
      role: 'Compliance & MLRO',
      email: 'fareed@betterwaymortgages.com',
    },
    {
      label: 'Shahid',
      role: 'Senior Mortgage Advisor',
      email: 'shahid@betterwaymortgages.com',
    },
    {
      label: 'Umar',
      role: 'Credit Underwriter',
      email: 'umar@betterwaymortgages.com',
    },
    {
      label: 'Saifullah',
      role: 'DLD & Conveyancing',
      email: 'saifullah@betterwaymortgages.com',
    },
    {
      label: 'Samarth',
      role: 'Finance & Accounting',
      email: 'samarth@betterwaymortgages.com',
    },
  ];

  return (
    <div className="swk-login2">
      {/* Left Oxblood brand aside (.swk-login2-aside) */}
      <aside className="swk-login2-aside">
        <div className="swk-login2-fade" aria-hidden />
        <FloatingPathsSvg position={1} />
        <FloatingPathsSvg position={-1} />
        <div className="relative z-10 flex items-center gap-3.5">
          <img
            src="/brand/icon-gold-squircle-midnight.svg"
            alt="Betterway Mortgages Icon"
            className="h-12 w-12 rounded-xl border border-[#c9a257]/40 shadow-lg"
          />
          <div>
            <div className="text-xl font-bold tracking-tight text-white">
              Betterway <span className="text-[#c9a257]">Mortgages</span>
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#a89a90]">
              Corporate Operating System
            </div>
          </div>
        </div>
        <figure className="swk-login2-quote">
          <blockquote>
            Every enquiry, 24-bank underwriting and DLD transfer in one place,{' '}
            <em>from first call to disbursal</em>.
          </blockquote>
          <figcaption>
            Betterway Mortgages LLC <span aria-hidden>|</span> Dubai, UAE
          </figcaption>
        </figure>
      </aside>

      {/* Right Main Editorial Sign-In Panel (.swk-login2-main) */}
      <main className="swk-login2-main">
        <div className="swk-login2-glow" aria-hidden />
        <div className="swk-login2-panel">
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/brand/icon-gold-squircle-midnight.svg"
              alt="Betterway Mortgages"
              className="h-10 w-10 rounded-xl border border-[#2a1418]/15 shadow-xs"
            />
            <div>
              <div className="text-base font-bold tracking-tight text-[#2a1418]">
                Betterway <span className="text-[#7a1f2b] font-mono">OS</span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#766661]">
                Betterway Mortgages LLC · Dubai
              </div>
            </div>
          </div>

          <h1>Welcome back.</h1>
          <p className="swk-login2-sub">Sign in to your Betterway Mortgages OS workspace.</p>

          {user && (
            <div className="mb-4 rounded-xl bg-[#f6e6e6] border border-[#c9b9a2] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={16} className="text-[#7a1f2b] shrink-0" />
                <div className="text-xs text-[#2a1418] truncate">
                  Active session: <b>{user.full_name_en}</b>
                </div>
              </div>
              <Link
                href={defaultHomeForRole(user.role)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2a1418] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#7a1f2b] transition shrink-0"
              >
                <span>Open OS</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {sp.error && (
            <div className="mb-4 rounded-xl bg-[#fbebe7] border border-[#ecb4a8] p-3 text-[#8c2a1c] text-xs font-medium">
              {sp.error}
            </div>
          )}

          <form className="grid gap-4" method="POST" action="/api/v1/auth/login" aria-label="Sign in">
            <div>
              <label
                htmlFor="email"
                className="block mb-1.5 text-[12.5px] font-semibold text-[#4d3a3c]"
              >
                Email address
              </label>
              <div className="swk-login2-field">
                <Mail size={17} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  defaultValue="shabib@betterwaymortgages.com"
                  required
                  placeholder="you@betterwaymortgages.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-[12.5px] font-semibold text-[#4d3a3c]">
                  Password
                </label>
                <span className="text-xs font-semibold text-[#7a1f2b]">Internal SSO Active</span>
              </div>
              <div className="swk-login2-field">
                <Lock size={17} />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  defaultValue="Betterway#2026"
                  required
                  placeholder="••••••••••"
                />
              </div>
            </div>

            <div className="pt-1">
              <button type="submit" className="swk-login2-btn">
                <span>Sign in</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </form>

          {/* 1-Click Authorized Internal Staff Directory Access */}
          <div className="mt-6 pt-5 border-t border-[#e7dccd]">
            <div className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#766661] mb-2.5">
              1-Click Internal Staff Directory Sign-In
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {staffProfiles.map((u) => (
                <form key={u.email} method="POST" action="/api/v1/auth/login">
                  <input type="hidden" name="email" value={u.email} />
                  <input type="hidden" name="password" value="Betterway#2026" />
                  <button
                    type="submit"
                    className="w-full text-left p-2 border border-[#e0d4c2] rounded-lg bg-[#faf6f0] hover:bg-[#f6e6e6] hover:border-[#7a1f2b] transition cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-[#2a1418] truncate">{u.label}</div>
                    <div className="text-[10px] text-[#766661] truncate">{u.role}</div>
                  </button>
                </form>
              ))}
            </div>
          </div>

          <p className="mt-6 flex items-center gap-1.5 text-[11.5px] text-[#766661]">
            <ShieldCheck size={14} className="text-[#7a1f2b]" />
            Encrypted session · activity is audited · © {new Date().getFullYear()} Betterway Mortgages LLC
          </p>
        </div>
      </main>
    </div>
  );
}

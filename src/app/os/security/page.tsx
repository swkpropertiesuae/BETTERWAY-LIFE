import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { OsBanner } from '@/components/os-banner';
import { PageHeader } from '@/components/page-header';
import { otpauthUri } from '@/server/auth/totp';

export default async function Security({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffUser();
  await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();
  const me = db.prepare('SELECT mfa_enabled, totp_secret FROM users WHERE id = ?').get(user.id) as { mfa_enabled: number; totp_secret: string };
  const staff = user.role === 'SUPER_ADMIN' ? (db.prepare("SELECT id, full_name_en, role, mfa_enabled FROM users WHERE role NOT IN ('CLIENT','PARTNER_AGENCY_ADMIN','PARTNER_AGENT') ORDER BY id").all() as Record<string, any>[]) : [];
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />
      <PageHeader app="Compliance" appHref="/os/compliance" title="My security" sub="Sign-in protection with an authenticator app (TOTP)." />
      <div className="bw-card p-5 text-sm space-y-3">
        <div>Multi-factor sign-in: <b className={me.mfa_enabled ? 'text-emerald-700' : 'text-amber-700'}>{me.mfa_enabled ? 'ON' : 'OFF'}</b></div>
        {!me.mfa_enabled && !me.totp_secret && (
          <form method="POST" action="/api/v1/actions"><input type="hidden" name="action" value="mfa_start" /><input type="hidden" name="returnTo" value="/os/security" /><button className="bw-btn-gold">Set up authenticator</button></form>
        )}
        {!me.mfa_enabled && me.totp_secret && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">In your authenticator app choose “enter a setup key” and type this key, or open the link on your phone:</p>
            <div className="font-num bg-slate-100 rounded-xl p-3 tracking-widest break-all">{me.totp_secret}</div>
            <a className="text-xs underline" href={otpauthUri(user.email, me.totp_secret)}>Open in authenticator app</a>
            <form method="POST" action="/api/v1/actions" className="flex gap-2 pt-2"><input type="hidden" name="action" value="mfa_confirm" /><input type="hidden" name="returnTo" value="/os/security" /><input name="code" inputMode="numeric" maxLength={6} required placeholder="6-digit code" className="bw-input !w-40 font-num" /><button className="bw-btn-gold">Turn on</button></form>
          </div>
        )}
        {me.mfa_enabled === 1 && (
          <form method="POST" action="/api/v1/actions" className="flex gap-2"><input type="hidden" name="action" value="mfa_disable" /><input type="hidden" name="returnTo" value="/os/security" /><input name="code" inputMode="numeric" maxLength={6} required placeholder="Code to confirm" className="bw-input !w-40 font-num" /><button className="bw-btn-navy">Turn off</button></form>
        )}
      </div>
      {staff.length > 0 && (
        <div className="bw-card p-5 text-xs"><h2 className="font-bold mb-2">Staff MFA status (admin)</h2>
          {staff.map((s) => <div key={s.id} className="flex justify-between items-center py-1 border-b border-slate-100"><span>{s.full_name_en} · {s.role}</span>
            <span className="flex items-center gap-2"><b className={s.mfa_enabled ? 'text-emerald-700' : 'text-amber-700'}>{s.mfa_enabled ? 'ON' : 'OFF'}</b>
              {s.mfa_enabled === 1 && s.id !== user.id && <form method="POST" action="/api/v1/actions"><input type="hidden" name="action" value="mfa_disable" /><input type="hidden" name="userId" value={s.id} /><input type="hidden" name="returnTo" value="/os/security" /><button className="underline">Reset (lost device)</button></form>}</span></div>)}
        </div>
      )}
    </div>
  );
}

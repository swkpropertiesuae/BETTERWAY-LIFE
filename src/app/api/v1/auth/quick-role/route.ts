import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { createSession, SESSION_COOKIE_NAME, type UserRole } from '@/server/auth';
import { defaultHomeForRole, LANG_COOKIE_NAME } from '@/server/auth/request';
import { normalizeLoginAlias } from '@/server/engines/swk-enterprise-engine';
import { getProductionSecurityStatus } from '@/server/engines/commercial-workflows-engine';

export async function POST(req: Request) {
  const db = getDb();
  const form = await req.formData();
  const action = String(form.get('action') || 'switch_role');
  const rawReturnTo = String(form.get('returnTo') || '');
  const safeReturnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '';

  if (action === 'set_lang') {
    const lang = String(form.get('lang') || 'en') === 'ar' ? 'ar' : 'en';
    const referer = req.headers.get('referer') || '';
    let fallbackDest = '/os';
    try {
      if (referer) {
        const refUrl = new URL(referer);
        const reqUrl = new URL(req.url);
        if (refUrl.origin === reqUrl.origin) {
          fallbackDest = refUrl.pathname + refUrl.search;
        }
      }
    } catch {
      fallbackDest = '/os';
    }
    const dest = safeReturnTo || fallbackDest;
    const res = NextResponse.redirect(new URL(dest, req.url), 303);
    res.cookies.set(LANG_COOKIE_NAME, lang, { path: '/', maxAge: 365 * 86_400, sameSite: 'lax' });
    return res;
  }

  const host = req.headers.get('host') || '';
  const reqHost = new URL(req.url).hostname;
  const isStrictLoopback =
    /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) && (reqHost === 'localhost' || reqHost === '127.0.0.1');
  if (!isStrictLoopback && process.env.BW_ENABLE_ROLE_SWITCHER !== '1') {
    return NextResponse.json({ error: 'Quick role switcher is only enabled on loopback localhost' }, { status: 403 });
  }

  const prodStatus = getProductionSecurityStatus(db);
  if (prodStatus.productionLockEnabled) {
    return NextResponse.redirect(
      new URL('/os/security?error=Production+Security+Lock+is+active.+Role+switcher+is+disabled+in+production+mode.', req.url),
      303,
    );
  }

  const email = normalizeLoginAlias(String(form.get('email') || ''));
  const user = db
    .prepare('SELECT id, role, preferred_lang FROM users WHERE email = ? AND status = ?')
    .get(email, 'ACTIVE') as { id: number; role: UserRole; preferred_lang: string } | undefined;

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=Demo+account+not+found', req.url), 303);
  }

  const token = createSession(db, user.id, '127.0.0.1', 'quick-role-switcher');
  const dest = safeReturnTo || defaultHomeForRole(user.role);
  const res = NextResponse.redirect(new URL(dest, req.url), 303);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 14 * 86_400,
  });
  return res;
}

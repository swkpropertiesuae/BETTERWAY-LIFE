import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db';
import { resolveSession, SESSION_COOKIE_NAME, type UserRecord, type UserRole } from '@/server/auth';
import type { Lang } from '@/lib/format';

export const LANG_COOKIE_NAME = 'bw_os_lang';

export async function getCurrentUser(): Promise<UserRecord | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return resolveSession(getDb(), raw);
}

export async function getActiveLang(user?: UserRecord | null): Promise<Lang> {
  const jar = await cookies();
  const c = jar.get(LANG_COOKIE_NAME)?.value;
  if (c === 'ar' || c === 'en') return c;
  return user?.preferred_lang === 'ar' ? 'ar' : 'en';
}

export function defaultHomeForRole(role: UserRole): string {
  if (role === 'CLIENT') return '/portal';
  if (role === 'PARTNER_AGENCY_ADMIN' || role === 'PARTNER_AGENT') return '/partners';
  return '/os/command';
}

export async function requireStaffUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === 'CLIENT') redirect('/portal');
  if (user.role === 'PARTNER_AGENCY_ADMIN' || user.role === 'PARTNER_AGENT') redirect('/partners');
  return user;
}

export async function requirePortalUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?tab=borrower');
  if (user.role !== 'CLIENT') redirect(defaultHomeForRole(user.role));
  return user;
}

export async function requirePartnerUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?tab=partner');
  if (user.role !== 'PARTNER_AGENCY_ADMIN' && user.role !== 'PARTNER_AGENT') {
    redirect(defaultHomeForRole(user.role));
  }
  return user;
}

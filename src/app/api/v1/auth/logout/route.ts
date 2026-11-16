import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { revokeSession, SESSION_COOKIE_NAME } from '@/server/auth';

export async function POST(req: Request) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (raw) {
    revokeSession(getDb(), raw);
  }
  const res = NextResponse.redirect(new URL('/login', req.url), 303);
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}

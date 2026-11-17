// RFC 6238 TOTP (SHA-1, 30 s, 6 digits) with node:crypto. Works with Google/Microsoft Authenticator, 1Password, etc.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newTotpSecret(): string {
  const b = randomBytes(20);
  let bits = '';
  for (const x of b) bits += x.toString(2).padStart(8, '0');
  return (bits.match(/.{1,5}/g) ?? []).map((c) => ALPHA[parseInt(c.padEnd(5, '0'), 2)]).join('');
}
const decode = (s: string) => {
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += ALPHA.indexOf(c).toString(2).padStart(5, '0');
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((x) => parseInt(x, 2)));
};
export function totpCode(secret: string, atMs = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 30_000)));
  const h = createHmac('sha1', decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0');
}
/** Accepts the previous, current and next 30-second window (clock drift). */
export function verifyTotp(secret: string, code: string, atMs = Date.now()): boolean {
  const c = Buffer.from(String(code).replace(/\s/g, ''));
  return [-1, 0, 1].some((w) => { const e = Buffer.from(totpCode(secret, atMs + w * 30_000)); return e.length === c.length && timingSafeEqual(e, c); });
}
export const otpauthUri = (email: string, secret: string) => `otpauth://totp/Betterway%20OS:${encodeURIComponent(email)}?secret=${secret}&issuer=Betterway%20OS`;

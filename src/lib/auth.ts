import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, timingSafeEqual } from 'crypto';
export { hashPin, checkPin } from './pin';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, type User } from '@/db/schema';

const COOKIE = 'idc_session';
const secret = () => process.env.SESSION_SECRET || 'dev-secret-change-me';

const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');

export async function createSession(userId: string) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 14;
  const v = `${userId}.${exp}`;
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 14 });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expect = sign(`${uid}.${exp}`);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) || Number(exp) < Date.now()) return null;
  const [u] = await db.select().from(users).where(eq(users.id, uid));
  return u && u.active ? u : null;
}
export async function requireUser(roles?: User['role'][]) {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (roles && !roles.includes(u.role) && u.role !== 'ADMIN') redirect('/');
  return u;
}

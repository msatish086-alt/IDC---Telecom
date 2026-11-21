import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
export function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(pin, salt, 32).toString('hex');
}
export function checkPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = scryptSync(pin, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

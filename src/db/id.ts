import { randomBytes } from 'crypto';
/** Short, URL-safe unique id. */
export const createId = () => randomBytes(12).toString('base64url');

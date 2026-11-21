import 'server-only';
import { mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { createId } from '@/db/id';

const ROOT = path.resolve(process.env.STORAGE_DIR || './storage');

/** Save an uploaded file to local storage (MVP). Swap for S3 / Azure Blob in production. */
export async function saveUpload(file: File, folder: string) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const rel = path.posix.join(folder.replace(/[^a-zA-Z0-9_-]/g, ''), `${createId()}.${ext}`);
  const abs = path.join(ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return rel;
}
export async function readUpload(rel: string) {
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT + path.sep)) throw new Error('bad path');
  return readFile(abs);
}

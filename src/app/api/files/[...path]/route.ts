import { currentUser } from '@/lib/auth';
import { readUpload } from '@/lib/storage';
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await currentUser())) return new Response('Not signed in', { status: 401 });
  const rel = (await params).path.join('/');
  try {
    const buf = await readUpload(rel);
    const ext = rel.split('.').pop()?.toLowerCase();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
    return new Response(new Uint8Array(buf), { headers: { 'content-type': type, 'cache-control': 'private, max-age=86400' } });
  } catch { return new Response('Not found', { status: 404 }); }
}

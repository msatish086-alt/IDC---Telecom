import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { taskPhotos, tasks } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { addPhoto, completeTask } from '@/lib/services';
import { saveUpload } from '@/lib/storage';
import { CHECKLIST } from '@/lib/checklist';


/** Close a task from the field app: multipart with photos[], checklist (JSON), remarks, lat, lng. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.assigneeId, u.id)));
  if (!t) return NextResponse.json({ error: 'This task is not assigned to you' }, { status: 403 });
  const f = await req.formData();
  const lat = f.get('lat') ? Number(f.get('lat')) : undefined, lng = f.get('lng') ? Number(f.get('lng')) : undefined;
  for (const p of f.getAll('photos')) {
    if (p instanceof File && p.size) {
      if (!p.type.startsWith('image/') || p.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'Photos must be images under 12 MB' }, { status: 422 });
      await addPhoto(id, u.id, await saveUpload(p, 'tasks'), lat, lng);
    }
  }
  if (f.get('photosOnly')) return NextResponse.json({ ok: true });
  let checklist: number[] = [];
  try { checklist = JSON.parse(String(f.get('checklist') ?? '[]')); } catch { /* ignore */ }
  const [{ n }] = await db.select({ n: count() }).from(taskPhotos).where(eq(taskPhotos.taskId, id));
  if (new Set(checklist).size < CHECKLIST.length) return NextResponse.json({ error: 'Tick every checklist item' }, { status: 422 });
  if (n < 1) return NextResponse.json({ error: 'Add at least one site photo' }, { status: 422 });
  const r = await completeTask(id, u.id, { checklist, remarks: String(f.get('remarks') ?? '') || undefined });
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}

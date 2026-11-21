import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { startTask } from '@/lib/services';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const [mine] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.assigneeId, u.id)));
  if (!mine) return NextResponse.json({ error: 'This task is not assigned to you' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const r = await startTask(id, u.id, { lat: typeof body.lat === 'number' ? body.lat : undefined, lng: typeof body.lng === 'number' ? body.lng : undefined });
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}

import { NextResponse } from 'next/server';
import { scanAlerts } from '@/lib/services';
/** Call every hour from a scheduler: GET /api/cron/scan?key=CRON_SECRET */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ raised: await scanAlerts() });
}

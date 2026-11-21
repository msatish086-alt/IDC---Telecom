import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { alerts, type Alert } from '@/db/schema';

/**
 * Send an alert out. MVP: if NOTIFY_WEBHOOK_URL is set, POST the alert as JSON
 * (plug in the WhatsApp / SMS / email provider there); otherwise it is logged and shown in-app.
 */
export async function notify(a: Alert) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  try {
    if (url) {
      await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        code: a.code, level: a.level, recipients: a.recipients, channels: a.channels, message: a.message, poId: a.poId, taskId: a.taskId,
      }) });
    } else if (process.env.NODE_ENV !== 'test') {
      console.log(`[alert ${a.code}] → ${a.recipients} (${a.channels}): ${a.message}`);
    }
    await db.update(alerts).set({ sentAt: new Date() }).where(eq(alerts.id, a.id));
  } catch (e) {
    console.error('notify failed', a.id, e);
  }
}

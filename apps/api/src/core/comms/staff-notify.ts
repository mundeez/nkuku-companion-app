// ── STAFF PUSH ALERTS (ntfy) ─────────────────────────────
// Fire-and-forget operational alerts for platform staff, published to the
// fixed ntfy topic `platform-ops` (admin-mobile subscribes in P6; today
// it's readable via any ntfy client). Used for: cron failures, new
// support tickets, payment webhook/verify terminal failures.
//
// NEVER throws and never awaited by callers — a broken ntfy must not
// break the code path that tried to report a problem.

const NTFY_BASE_URL = process.env.NTFY_BASE_URL;
const NTFY_AUTH_TOKEN = process.env.NTFY_AUTH_TOKEN || '';
const TOPIC = 'platform-ops';

export function notifyStaff(
  title: string,
  body: string,
  priority: number = 3,
  tags: string[] = [],
): void {
  if (!NTFY_BASE_URL) return; // ntfy not configured — silent no-op
  const base = NTFY_BASE_URL.replace(/\/+$/, '');
  fetch(`${base}/${TOPIC}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Title: title.slice(0, 250),
      Priority: String(Math.min(5, Math.max(1, priority))),
      ...(tags.length ? { Tags: tags.join(',') } : {}),
      ...(NTFY_AUTH_TOKEN ? { Authorization: `Bearer ${NTFY_AUTH_TOKEN}` } : {}),
    },
    body: String(body).slice(0, 3800),
  }).catch(() => {
    // Best-effort: swallow — callers must not be able to fail via ntfy.
  });
}

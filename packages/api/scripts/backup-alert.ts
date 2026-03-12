/**
 * Optional backup failure/success alert via webhook (Slack, PagerDuty, etc.).
 * Set BACKUP_ALERT_WEBHOOK_URL in env to enable.
 */
export async function sendBackupAlert(
    env: { BACKUP_ALERT_WEBHOOK_URL?: string },
    kind: 'failure' | 'success',
    message: string,
    details?: Record<string, unknown>
): Promise<void> {
    const url = (env as any).BACKUP_ALERT_WEBHOOK_URL;
    if (!url || typeof url !== 'string' || url.length === 0) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: message,
                backup_event: kind,
                message,
                ...details,
                ts: new Date().toISOString(),
            }),
        });
    } catch (e) {
        console.error('[Backup] Failed to send alert webhook:', (e as Error).message);
    }
}

/**
 * Exponential backoff delay for chat WebSocket reconnects.
 * @param attempt 1-based attempt number (1 = first retry)
 * @param baseMs base delay in ms (default 1000)
 * @param maxMs cap in ms (default 30000)
 * @returns delay in milliseconds
 */
export function getReconnectDelay(attempt: number, baseMs = 1000, maxMs = 30000): number {
    return Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
}

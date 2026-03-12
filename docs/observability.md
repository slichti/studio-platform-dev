# Observability & Golden Signals

## Target SLOs (Service Level Objectives)

Minimal targets for key API behavior; use these for alerts and load-test thresholds.

| Signal | Target | Scope |
|--------|--------|--------|
| **Latency (read)** | p95 &lt; 500 ms | GET /classes, GET /bookings, public schedule |
| **Latency (write)** | p95 &lt; 1 s | POST /bookings, POST /classes/:id/book |
| **Error rate** | &lt; 1% | All non-5xx; 4xx allowed for validation/auth |
| **Availability** | 99%+ | Health/diagnostics endpoints |

Load tests (k6) in `packages/api/k6/` enforce these locally or against a staging URL when `BASE_URL` is set. CI can run them on a schedule or when `LOAD_TEST_BASE_URL` is configured.

## Structured Logging

All API requests emit structured JSON logs with:

- `timestamp` — ISO 8601
- `level` — info | warn | error | debug
- `message` — Log message
- `traceId` — Request correlation ID (from `X-Request-Id` or generated)
- `tenantId` — Set after tenant middleware (when applicable)
- `userId` — Set after auth middleware (when applicable)
- `status` — HTTP status code (on request completion)
- `durationMs` — Request duration in milliseconds

**Example:**
```json
{"timestamp":"2026-02-23T12:00:00.000Z","level":"info","message":"Request completed: GET /classes","traceId":"abc-123","tenantId":"tenant_xyz","userId":"user_456","status":200,"durationMs":45.2}
```

## Golden Signals Endpoint

**GET /diagnostics/golden-signals** (platform admin only) returns:

- `webhooks.total` — Webhook deliveries in last 24h
- `webhooks.successRate` — % with status 2xx
- `clientErrors` — Client-side errors logged in last 24h
- `logFormat` — Reference for log parsing

Use this for dashboards (e.g. Grafana, Datadog) or health checks.

## Dashboards

Recommended metrics to track:

1. **Error rate** — Count logs with `level: "error"` or `status >= 400`
2. **Latency** — P50/P95/P99 of `durationMs`
3. **Webhook success** — From `GET /diagnostics/golden-signals` or `webhook_logs` table
4. **Backup age** — From R2 bucket metadata or cron logs

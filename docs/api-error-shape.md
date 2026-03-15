# API Error Response Shape

All API error responses use a consistent JSON shape so clients can handle them uniformly.

## Standard shape

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "requestId": "optional-trace-id",
  "details": {}
}
```

- **error** (string, required): Message suitable for logging and optional user display.
- **code** (string, required): Stable code for programmatic handling. See [Codes](#codes) below.
- **requestId** (string, optional): Request or trace id when available (e.g. `X-Request-Id` or internal trace).
- **details** (object, optional): Extra context (e.g. validation `issues` from Zod).

Validation errors may also include **issues** (array) from the schema validator.

## HTTP status

- `400` — Bad request / validation (e.g. `BAD_REQUEST`, `VALIDATION_FAILED`).
- `401` — Unauthorized (missing or invalid auth).
- `403` — Forbidden (e.g. `UNAUTHORIZED`, `Access Denied`).
- `404` — Not found (e.g. `NOT_FOUND`).
- `409` — Conflict (e.g. duplicate resource).
- `429` — Too Many Requests (`RATE_LIMIT_EXCEEDED`). Response may include `Retry-After` header (seconds until limit resets).
- `500` — Internal server error (`INTERNAL_ERROR`).
- `503` — Service unavailable (e.g. health check when DB is down).

## Codes

| Code | Status | Meaning |
|------|--------|--------|
| `BAD_REQUEST` | 400 | Invalid or missing parameters. |
| `VALIDATION_FAILED` | 400 | Request body/query failed schema validation. Check `details` or `issues`. |
| `UNAUTHORIZED` | 403 | Authenticated but not allowed for this resource. |
| `NOT_FOUND` | 404 | Resource or tenant not found. |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded. Use `Retry-After` header (seconds) to back off. |
| `INTERNAL_ERROR` | 500 | Unhandled server error. In non-production, response may include `message`, `stack`, `cause`. |

Route-specific errors may use other codes (e.g. `STRIPE_WEBHOOK_ERROR`, `INVENTORY_ERROR`). The same shape applies: `error`, `code`, and optional `details` / `requestId`.

## Example

```json
{
  "error": "Studio not found",
  "code": "NOT_FOUND"
}
```

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": "Invalid date format",
  "issues": [
    { "path": ["start"], "message": "Expected string" }
  ]
}
```

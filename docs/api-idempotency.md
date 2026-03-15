# API Idempotency

For **payments** and **bookings**, clients can send an **`Idempotency-Key`** header so that duplicate requests (e.g. double-clicks or retries) are handled safely.

## Header

- **Name:** `Idempotency-Key`
- **Value:** A client-generated string (e.g. UUID) that uniquely identifies the operation. The same key must be sent for retries of the same logical request.

## Recommended usage

| Area | Endpoint | Notes |
|------|----------|--------|
| **Guest booking** | `POST /guest/booking` | Send a key per “book this class” attempt; if the key was already seen, return the same success response and do not create a second booking. |
| **Checkout session** | `POST /commerce/checkout/session` | Send a key per “create Stripe session” attempt; if the key was already seen, return the same session/url/clientSecret (200) and do not create a second Stripe session. |
| **Authenticated booking** | `POST /bookings` (or class booking) | Same as guest booking for member bookings. |

## Server behavior (when implemented)

1. **First request** with key `K`: Process normally; store `K` → response (or booking/session id) with a TTL (e.g. 24 hours).
2. **Duplicate request** with same key `K`: Return the stored response with **200** (same body as first time), or **409 Conflict** with a message that the key was already used, depending on policy.
3. **Key not sent:** Process as today; no idempotency guarantee.

## Implementation notes

- Storage: KV (e.g. Cloudflare KV), in-memory cache, or DB table keyed by `Idempotency-Key` and optionally tenant/user.
- TTL: 24–72 hours is typical so retries within that window are safe.
- Key format: Recommend UUID v4; server should treat the key as opaque and only enforce uniqueness.

**Implemented:**

- **`POST /guest/booking`:** Honors `Idempotency-Key`. When the header is sent, the server stores the success response in D1 (`idempotency_keys` table) with a 24-hour TTL. Duplicate requests with the same key within 24 hours receive the stored response (200) without creating a second booking.
- **`POST /commerce/checkout/session`:** Honors `Idempotency-Key` the same way. Duplicate requests with the same key within 24 hours receive the stored response (200)—same `url`, `clientSecret`, or `complete`/`returnUrl`—without creating a second Stripe session.

If the `idempotency_keys` table is missing (e.g. before migration), both routes still work without idempotency.

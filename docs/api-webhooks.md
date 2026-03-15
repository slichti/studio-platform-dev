# API Webhooks: Retries & Idempotency

## Stripe webhooks

**Endpoint:** `POST /webhooks/stripe`

### Retry behavior

- **Success:** Return `200` with `{ received: true }`. Stripe will not retry.
- **Processing failure:** We return `500` with `code: 'STRIPE_WEBHOOK_ERROR'`. Stripe will retry the delivery according to [Stripe’s webhook retry policy](https://docs.stripe.com/webhooks/best-practices#retry-logic).
- **Signature verification failure:** Return `401`. Stripe may retry; fix the secret or payload before relying on retries.

When implementing handlers, avoid returning `500` for permanent failures (e.g. invalid payload structure). Use `500` only for transient errors (e.g. DB timeout, downstream failure) so Stripe retries are useful.

### Idempotency

- Before processing, we check the `processed_webhooks` table for the event `id`.
- If the event was already processed, we return `200` with `{ received: true }` and do not run the handler again.
- After successful processing, we insert the event `id` into `processed_webhooks`.

So duplicate deliveries (e.g. from retries) are safe: the same event is only processed once.

## Other webhooks

Clerk, Zoom, and other providers may have their own retry behavior. Incoming webhooks should be validated (signature, schema) before performing side effects, and idempotency (e.g. by provider event id) should be used where possible.

# POS & Retail Enhancements (verapose-cloudflare inspired)

## Architecture Alignment

- **Tenant resolution:** All POS API calls include `X-Tenant-Slug` for tenant middleware resolution when using a central API domain.
- **Stripe Connect:** Operations use `tenant.stripeAccountId` for multi-tenant isolation.
- **RBAC:** Routes use `manage_pos`, `view_pos`, or `manage_commerce` (refund) permissions.

Studio Platform's Point of Sale and Retail capabilities have been enhanced using patterns from the [verapose-cloudflare](https://github.com/slichti/verapose-cloudflare) reference implementation. Verapose-cloudflare is a known-good, Stripe-native POS system.

## Enhancements Applied

### 1. Stripe PaymentIntent ID Persistence
- **Problem:** Terminal payments created a Stripe PaymentIntent but the order record did not store it, so refunds via `/refunds` could not find the Stripe charge.
- **Solution:** `stripePaymentIntentId` is now passed from the POS frontend to `POST /pos/orders` and stored on `pos_orders`. Refunds for Terminal (and future Payment Element) card payments now resolve correctly.

### 2. Transactions Endpoint
- **New Route:** `GET /pos/transactions`
- **Purpose:** List Stripe PaymentIntents for the tenant's connected account with refund status, customer details, and metadata.
- **Query params:** `limit`, `starting_after`, `created_after`
- **Returns:** Transactions with `refund_status` (`none` | `partially_refunded` | `fully_refunded`), `total_refunded`, `remaining_refundable`, and per-transaction refund details.

### 3. Customer Update (PUT)
- **New Route:** `PUT /pos/customers/:id` (id = Stripe Customer ID)
- **Purpose:** Update a Stripe customer's email, name, phone, or address on the connected account.
- **Body:** `{ email?, name?, phone?, address? }`

### 4. Refund by PaymentIntent
- **New Route:** `POST /pos/refund`
- **Purpose:** Issue full or partial refund by PaymentIntent ID without needing the local order ID.
- **Body:** `{ paymentIntentId, amount? (cents, optional for full refund), reason? }`
- **Behavior:** Creates Stripe refund, records in `refunds` table, updates `pos_orders.status` to `refunded` when fully refunded. Supports partial refunds.

### 5. Product Price Update → New Stripe Price
- **Behavior:** When `PUT /pos/products/:id` includes a `price` change and the product is synced to Stripe, a new Stripe Price is created and `stripePriceId` is updated. (Verapose pattern: Stripe prices are immutable, so price changes create new price objects.)

### 6. Customer on PaymentIntent
- **Enhancement:** `POST /pos/process-payment` now accepts `customerId` (Stripe Customer ID) and attaches it to the PaymentIntent for receipts and transaction history.

## API Summary

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/pos/transactions` | List Stripe transactions with refund status |
| PUT | `/pos/customers/:id` | Update Stripe customer |
| POST | `/pos/refund` | Refund by PaymentIntent (full or partial) |

## Multi-Tenant / Stripe Connect

All Stripe operations use the tenant's `stripeAccountId` (Stripe Connect). Each tenant has isolated products, customers, and transactions on their connected account.

## Related Routes (existing)

- `POST /pos/orders` – now accepts `stripePaymentIntentId`, `couponCode`
- `POST /pos/process-payment` – now accepts `customerId`
- `GET /refunds` – general refund list
- `POST /refunds` – general refund creation (by order/pack/sub type)

## Frontend Architecture Alignment

### Retail Route (`studio.$slug.retail`)
- **Loader:** Uses `GET /pos/products` with `X-Tenant-Slug` to list products.
- **Action:** All product operations use the `/pos` API namespace: create (`POST /pos/products`), update (`PUT /pos/products/:id`), archive (`POST /pos/products/:id/archive`), import (`POST /pos/products/import`), images (`POST /pos/products/images`).
- Products response shape: `{ products: [...] }`; loader returns `productsData?.products ?? []`.

### Inventory Route (`studio.$slug.inventory`)
- All `/inventory` API calls include `X-Tenant-Slug` for tenant resolution.

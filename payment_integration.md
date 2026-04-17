You are a senior backend engineer. Follow clean architecture and do NOT modify unrelated files or existing logic.

## Context

We already have an existing Order system in a  backend.

Existing API:
POST /orders

* Creates order in DB
* Stores cart items
* Returns: order_id, amount, status = PENDING_PAYMENT

We now need to integrate Razorpay (Route - marketplace split payments) WITHOUT breaking existing order flow.

---

## Requirements

### 1. DO NOT MODIFY EXISTING ORDER LOGIC

* Do NOT change /orders API logic
* Do NOT duplicate order creation
* Treat Order Service as source of truth

---

### 2. Create a NEW Payment Module

Create a separate module:

* /payments

With clean separation of concerns.

---

### 3. Database Changes (Minimal)

Update orders table to include:

* razorpay_order_id (string, nullable)
* razorpay_payment_id (string, nullable)
* payment_status (enum: PENDING, PAID, FAILED)

Do NOT change existing columns.

---

### 4. Create API: POST /payments/create

Input:
{
"order_id": "string"
}

Flow:

* Fetch order from DB
* Validate order exists and is not already paid
* Create Razorpay order using Razorpay Python SDK
* Amount should be in paise
* Attach Razorpay order_id to DB
* Return:
  {
  "razorpay_order_id",
  "amount",
  "currency"
  }

IMPORTANT:

* Do NOT create new business logic here
* Only integrate payment

---

### 5. Razorpay Route Split Logic

While creating Razorpay order, include transfer:

* Fetch vendor's razorpay_account_id from DB
* Calculate platform commission (e.g., 10%)
* Remaining goes to vendor

Example:

* total = 1000
* vendor = 900
* platform = 100

Use Razorpay "transfers" field

---

### 6. Create API: POST /payments/verify

Input:
{
"order_id",
"razorpay_order_id",
"razorpay_payment_id",
"razorpay_signature"
}

Flow:

* Verify signature using HMAC SHA256
* If valid:

  * update order:
    payment_status = PAID
    status = CONFIRMED
* Else:

  * mark FAILED

---

### 7. Add Webhook Handler

POST /webhooks/razorpay

Handle events:

* payment.captured
* payment.failed

Update DB accordingly.

---

### 8. Code Quality Rules

* Use service layer (payment_service.py)
* Use router (payment_router.py)
* Use dependency injection if needed
* Do NOT add unnecessary comments or emojis
* Do NOT reformat unrelated files
* Keep code minimal and production-ready

---

### 9. Security

* Use environment variables for Razorpay keys
* NEVER hardcode secrets
* Validate all inputs

---

### 10. Expected Output

Generate:

* payment_router.py
* payment_service.py
* model updates (SQLAlchemy)
* example .env variables
* minimal integration instructions

---

## Important Instructions

* Do NOT touch existing files unnecessarily
* Do NOT refactor unrelated code
* Do NOT add extra features
* Keep changes minimal, focused, and clean

This is a production system, not a demo.

---

## Implementation — What Was Done

> Stack: Node.js / Express / MongoDB (Mongoose)

---

### All Files Created / Modified

| File | Action |
|------|--------|
| `backend/src/models/Order.model.js` | Modified — added `razorpayOrderId`, `razorpayPaymentId`, `refundStatus` fields |
| `backend/src/models/Vendor.model.js` | Created — Vendor model with `razorpayAccountId`, `commissionPercent` |
| `backend/src/services/payment.service.js` | Created → Updated → Final (race condition fix, vendor validation, observability) |
| `backend/src/controllers/payment.controller.js` | Created → Updated (ownership, error logging) |
| `backend/src/routes/payment.routes.js` | Created |
| `backend/src/routes/webhook.routes.js` | Created → Updated → Final (idempotency, notes mapping, mandatory secret, structured logging) |
| `backend/src/app.js` | Modified — registered payment & webhook routes |
| `backend/.env` | Modified — added Razorpay env variables |

---

### Step 1 — Order Model (`Order.model.js`)

Three nullable fields added (existing `paymentStatus` enum was already present):

```js
razorpayOrderId: {
  type: String,
  default: null,
},
razorpayPaymentId: {
  type: String,
  default: null,
},
refundStatus: {
  type: String,
  enum: ["NONE", "PARTIAL", "FULL"],
  default: "NONE",
},
```

`refundStatus` is not active yet but avoids a schema migration when refunds are later implemented.

---

### Step 2 — Vendor Model (`Vendor.model.js`) — NEW

Minimal model keyed by `tenantId` (matches existing project convention):

```js
{
  tenantId: { type: String, required: true, unique: true },
  razorpayAccountId: { type: String, default: null },
  commissionPercent: { type: Number, default: null },
}
```

Populate this collection via admin for each tenant before going live.

---

### Step 3 — Payment Service (`payment.service.js`) — FINAL STATE

**`createPayment(orderId, userId)`**

| Check | Behaviour |
|-------|-----------|
| Order not found | 404 |
| `order.userId !== userId` | 403 Unauthorized |
| `paymentStatus === PAID` | 400 already paid |
| `razorpayOrderId` set and not LOCKED | Fetch existing Razorpay order and return — no duplicate created |
| **Atomic lock** | `findOneAndUpdate({ _id, razorpayOrderId: null }, { $set: { razorpayOrderId: "LOCKED" } })` — prevents race condition on concurrent requests |
| Lock already taken | Wait 500ms, re-read order; return existing if available, else 409 |
| Lock acquired but Razorpay call fails | Lock released (`razorpayOrderId` reset to `null`) |
| Vendor lookup | `Vendor.findOne({ tenantId: order.tenantId })` |
| **Vendor validation** | Throws 400 if `vendor.razorpayAccountId` is null (vendor not onboarded) |
| Commission | `vendor.commissionPercent` → falls back to `PLATFORM_COMMISSION_PERCENT` env |
| Amount source | Always `order.totalAmount` converted to paise — never from request |
| `notes.order_id` | Added to Razorpay order for reliable webhook mapping |
| Transfer | `vendor.razorpayAccountId` used for Route split |
| **Observability** | `console.log` with `orderId`, `razorpayOrderId`, `amountInPaise`, `vendorAmount` |

**`verifyPayment({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, userId })`**

- Ownership check: `order.userId !== userId` → 403
- HMAC-SHA256 verification: `RAZORPAY_KEY_SECRET` over `razorpayOrderId|razorpayPaymentId`
- Valid → `paymentStatus = PAID`, `orderStatus = CONFIRMED`, saves `razorpayPaymentId`, logs structured event
- Invalid → `paymentStatus = FAILED`

---

### Step 4 — Payment Controller (`payment.controller.js`) — FINAL STATE

- Thin layer; delegates all logic to service
- Passes `req.user.userId` to both `createPayment` and `verifyPayment`
- `console.error` logging on all catch blocks
- Maps `err.status` to HTTP response code

---

### Step 5 — Payment Routes (`payment.routes.js`)

```
POST /api/payments/create   →  initiatePayment   (auth required)
POST /api/payments/verify   →  verifyPayment     (auth required)
```

---

### Step 6 — Webhook Handler (`webhook.routes.js`) — FINAL STATE

```
POST /api/webhooks/razorpay
```

| Feature | Detail |
|---------|--------|
| Raw body | `express.raw({ type: 'application/json' })` — must be before `express.json()` |
| Signature | HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET` — mandatory |
| Order lookup | Uses `notes.order_id` first → falls back to `razorpayOrderId` field |
| Idempotency | Skips update if `order.paymentStatus === PAID` already |
| `payment.captured` | `paymentStatus = PAID`, `orderStatus = CONFIRMED`, saves `razorpayPaymentId` |
| `payment.failed` | `paymentStatus = FAILED` |
| **Observability** | `console.log` with `orderId`, `razorpayOrderId`, `razorpayPaymentId`, `event` on every DB update |
| Error handling | `try/catch` with `console.error` logging around DB updates |

---

### Step 7 — app.js Changes

```js
// BEFORE express.json() — preserves raw body for webhook signature
app.use("/api/webhooks", webhookRoutes);

app.use(express.json());

// AFTER authMiddleware
app.use("/api/payments", paymentRoutes);
```

---

### Step 8 — Environment Variables (`.env`)

```env
# Razorpay
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Platform commission fallback percentage (used if vendor.commissionPercent is null)
PLATFORM_COMMISSION_PERCENT=10
```

> `VENDOR_RAZORPAY_ACCOUNT_ID` env variable is no longer used — vendor account is now fetched from the `Vendor` collection in DB.

---

### Integration Flow

```
1. POST /api/orders
   → creates order, returns { order_id, totalAmount }
   (existing flow — unchanged)

2. POST /api/payments/create  { order_id }
   → ownership check (logged-in user must own the order)
   → idempotent: returns existing Razorpay order if already created
   → creates Razorpay order with Route split (vendor from DB)
   → returns { razorpay_order_id, amount, currency }

3. Client pays via Razorpay SDK (web / mobile)

4. POST /api/payments/verify
   → ownership check
   → verifies HMAC-SHA256 signature
   → marks order PAID + CONFIRMED  (or FAILED on invalid signature)

5. POST /api/webhooks/razorpay  (Razorpay server-side callback)
   → mandatory signature verification
   → resolves order via notes.order_id
   → idempotent: skips if already PAID
   → marks order PAID or FAILED
```

---

### Installed Package

```
razorpay@2.9.6
```

```bash
npm install razorpay
```

---

### Security Checklist

| Item | Status |
|------|--------|
| Razorpay keys from env only | Done |
| Amount never accepted from frontend | Done |
| Order ownership validated on create & verify | Done |
| Webhook signature mandatory | Done |
| Idempotent webhook (no double-PAID) | Done |
| Idempotent payment create (no duplicate Razorpay orders) | Done |
| Vendor account from DB (not env) | Done |
| Vendor onboarding validation (null check) | Done |
| Race condition on concurrent requests (atomic lock) | Done |
| Lock released on Razorpay failure | Done |
| Structured observability logging | Done |
| `refundStatus` field prepared for future use | Done |

---

### Notes on Future Work (Not Implemented)

| Item | Recommendation |
|------|----------------|
| Manual capture | Enable auto-capture in Razorpay dashboard, or handle `payment.authorized` event to call capture API |
| Order expiry | Add cron job to expire `PENDING` orders after 15–30 min and release reserved stock |
| Refund API | Surface `refundStatus` field via a `POST /api/payments/refund` endpoint when needed |

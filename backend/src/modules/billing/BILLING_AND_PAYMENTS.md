# ELVA Billing & Payments — Product & Technical Reference

This document describes how subscription billing, invoicing, payments (Razorpay), and enforcement work in the Grocery Delivery Application. **All prices come from the database** (`payment_plans` / per-tenant enterprise plans). Nothing is hardcoded in business logic.

**Timezone:** Billing calendar months use **Asia/Kolkata (IST)**.

---

## 1. Plan types (configurable via Super Admin)

| Plan code | Pricing model | Monthly fee | Orders | Extra usage |
|-----------|---------------|-------------|--------|-------------|
| **FREE** | `PER_ORDER` | ₹0 | Unlimited | ₹X **per order** (postpaid, month-end) |
| **BASIC** | `SUBSCRIPTION` | ₹X / month (e.g. 5000) | **Included** N orders (e.g. 1000) | ₹Y **per order above** limit (postpaid, month-end) |
| **ENTERPRISE** | `ENTERPRISE` | Set per store in Super Admin | Set per store | Derived from fields (see below) |

### Enterprise behaviour (no hardcoded rates)

Super Admin configures each tenant’s enterprise plan. Effective billing mode is inferred from stored fields:

- **Subscription-style** if `monthly_price > 0` or `included_orders > 0` → same flow as BASIC (prepaid monthly + postpaid extras).
- **Per-order-style** if only `price_per_order > 0` → same flow as FREE.

---

## 2. Invoice types (two bills for subscription plans)

Subscription-style tenants can have **two separate invoices** in the same calendar month:

| `invoice_type` | Purpose | When created | When due |
|----------------|---------|--------------|----------|
| **MONTHLY_SUBSCRIPTION** | Prepaid monthly platform fee | Start of cycle (1st of month) or on plan activation / new signup | **Invoice date + 7 days** |
| **EXTRA_USAGE** | Postpaid charge for orders **above** included limit | Running during month; **finalized on last day of month** | **Finalize date + 7 days** |
| **PER_ORDER** | FREE (or enterprise per-order) — all order charges | Running during month; **finalized on last day of month** | **Finalize date + 7 days** |

**Due date rule (all types):**  
`due_date = invoice_date (or month-end for extras/per-order) + 7 calendar days`

---

## 3. FREE plan flow

1. **No monthly fee.**
2. Each order adds `price_per_order` to the current month’s **PER_ORDER** invoice (incremental).
3. **Last day of month (23:55 IST cron):** invoice is finalized, `is_current_cycle = false`.
4. Customer pays by due date (~7th of next month).
5. If unpaid after due date → **OVERDUE** → suspension (see §8).

**Example (₹7/order):** 100 orders in May → May bill **₹700**, generated 31 May, due ~7 Jun.

---

## 4. BASIC / subscription-style flow (e.g. ₹5000/mo, 1000 included, ₹5/extra)

### 4.1 Prepaid monthly fee

- Charged at **start of billing cycle** (calendar month) or when customer **activates / joins** mid-month.
- **Mid-month join or first activation:** fee is **prorated** by remaining days in that IST month:

  ```
  prorated = (monthly_price / days_in_month) × remaining_days_in_month
  ```

  `remaining_days` = from enrollment/payment reference day through last day of month (inclusive).

- **Existing customer — renewal on 1st:** June prepaid invoice is created **1 Jun** for **full** monthly amount (e.g. ₹5000), due ~**8 Jun**.
- **New customer — joins 6 Jun:** prepaid uses proration from **join date** (e.g. ~₹4194 for 25 days at ₹5000/30-day month), not full ₹5000.

> **Note:** On Razorpay pay, prepaid amount is recalculated from **payment day** for unpaid `MONTHLY_SUBSCRIPTION` invoices. For renewals where the invoice was issued on the 1st, product expectation is often **full month amount**; confirm with business if pay-on-6th should always charge the full ₹5000 from the 1st.

### 4.2 Usage during the month

- Every order increments `orders_used` for that **billing_month / billing_year**.
- Orders **within** `included_orders`: **₹0** extra.
- Orders **above** included limit: each adds `price_per_extra_order` to **EXTRA_USAGE** (running total).
- **Included limit is the full monthly allowance** (e.g. 1000), not prorated down for mid-month join (only the **fee** is prorated).

### 4.3 Postpaid extra usage (month-end)

- **Last day of month:** cron finalizes **EXTRA_USAGE** only (not the monthly fee again).
- If `extra_orders = 0` → extra invoice cancelled / ₹0; nothing to pay.
- If 50 extra orders × ₹5 → **₹250**, due ~7th of next month.

### 4.4 Two payment buttons (admin UI)

| Button | Invoice type | When shown |
|--------|--------------|------------|
| Pay monthly fee (prorated) | `MONTHLY_SUBSCRIPTION` | Unpaid prepaid, amount > 0 |
| Pay extra usage | `EXTRA_USAGE` | Unpaid, **extra_orders > 0**, amount > 0 |

---

## 5. Existing customer — June 1–5 vs pay on June 6

**Scenario:** Customer already on plan; June cycle opens **1 Jun**; they pay monthly renewal **6 Jun**.

| Period | Behaviour |
|--------|-----------|
| **1–5 Jun** | Orders **are counted** in June usage (if account ACTIVE, not OVERDUE from prior month). |
| **1 Jun** | System creates June **MONTHLY_SUBSCRIPTION** (e.g. ₹5000 unpaid) and June usage counters. |
| **6 Jun** | Payment settles **prepaid** invoice for the **June cycle** (covers the month, including orders already taken 1–5 Jun). |
| **Unpaid prepaid before due** | Orders may still be allowed until invoice is **OVERDUE** (not blocked on PENDING alone). |
| **After due + unpaid** | OVERDUE → suspension → new orders blocked. |

Extra orders in June (if any) still bill at **month-end** on **EXTRA_USAGE**, due ~7 Jul.

---

## 6. Calendar timeline example (subscription ₹4000/mo, 1000 included, ₹5/extra)

| Date | Event | Amount |
|------|--------|--------|
| 1 Jun | June cycle opens; prepaid invoice created | ₹4000 due ~8 Jun |
| 1–5 Jun | 200 orders (included) | ₹0 extra |
| 6 Jun | Customer pays June prepaid | ₹4000 (or prorated if recalculated on pay date) |
| 6–30 Jun | 850 more orders (total 1050) | 50 extra × ₹5 = ₹250 running |
| 30 Jun | Month-end finalize | EXTRA_USAGE **₹250**, due ~7 Jul |
| 1 Jul | July cycle opens | New prepaid **₹4000**, due ~8 Jul |

---

## 7. Plan changes

- Upgrade/downgrade is scheduled for **next billing cycle** (`next_plan_id` on subscription).
- **Current month invoices are not rewritten**; historical invoices keep `plan_snapshot`.
- **Activate now** (with Razorpay): immediate plan switch + prepaid for current month (prorated if mid-month).

---

## 8. Non-payment & suspension

| Stage | System action |
|-------|----------------|
| Before due date | Invoice `PENDING`, `payment_status = UNPAID` |
| Due date + unpaid | Daily cron can mark **OVERDUE** |
| OVERDUE | Tenant `SUSPENDED`, subscription `SUSPENDED`, store can close |
| New orders | **Blocked** via `assertCanPlaceOrder` (402 / 403) |
| Super Admin | **Mark Paid** on dashboard (manual / offline payment) |

**Reminders (in-app notifications):** 3 days before due, 1 day before due, on/after overdue.

**Current enforcement gap (know this):** Unpaid **PENDING** prepaid does **not** block orders until **OVERDUE**. Only overdue invoices block.

---

## 9. Payments (Razorpay)

### Tenant admin

- **Pay monthly prepaid:** `POST /api/billing/invoice/:id/pay` → Razorpay order → `POST .../verify`
- **Activate plan now:** `POST /api/billing/plan/initiate-payment` → Razorpay → `POST /api/billing/plan/activate`
- Checkout **merchant name** = tenant **store name** from DB (not hardcoded).
- Transaction ID stored as `payment_id` (Razorpay `pay_…`); `razorpay_order_id` stored when applicable.

### Super Admin

- `PATCH /api/super/tenant/:id/invoice/mark-paid` — marks outstanding invoices paid, syncs tenant active.

### After successful payment

- Invoice `PAID`, `paid_at` set.
- Paid current-cycle flags cleared; duplicate unpaid same-type invoices cancelled where applicable.
- Subscription/tenant reactivated if no other overdue invoices.

---

## 10. Month-end cron (23:55 daily, runs on last IST day of month)

1. **Finalize** current cycle invoice (PER_ORDER total, or EXTRA_USAGE only for subscription).
2. Set `is_current_cycle = false`, `invoice_date` = month end, `due_date` = month end + 7 days.
3. **Open next cycle:** new usage row, new prepaid (full monthly) for subscription, new empty EXTRA_USAGE or PER_ORDER tracker.

---

## 11. Order cancellation

When an order is cancelled/reversed, billing **decrements** usage and invoice line items (per-order or extra) so totals stay consistent. No full-month recalculation from scratch.

---

## 12. Data model (collections)

| Collection | Role |
|------------|------|
| `payment_plans` | Plan definitions (rates, limits) |
| `tenant_subscriptions` | Active plan, cycle dates, `prepaid_amount`, `prorated_amount` |
| `billing_usage` | Monthly counters: `orders_used`, `extra_orders`, charges |
| `billing_invoices` | Invoices with `invoice_type`, amounts, status, Razorpay refs |

**Security:** All queries scoped by `tenant_id` + `store_id`. Invoice numbers unique per platform. `subscription_unique_key` prevents subscription collisions.

---

## 13. APIs (summary)

### Tenant (auth + tenant middleware)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/billing/plans` | List plans visible to tenant |
| GET | `/api/billing/subscription` | Current subscription |
| GET | `/api/billing/usage` | Current month usage |
| GET | `/api/billing/invoice/current` | Usage-cycle invoice + `prepaidInvoice` |
| GET | `/api/billing/invoices` | Invoice history |
| GET | `/api/billing/invoices/:id/download` | Audit PDF |
| GET | `/api/billing/invoices/export` | CSV export |
| POST | `/api/billing/invoice/:id/pay` | Create Razorpay order |
| POST | `/api/billing/invoice/:id/verify` | Confirm Razorpay payment |
| PUT | `/api/billing/subscription/plan` | Schedule plan change (next cycle) |
| POST | `/api/billing/plan/initiate-payment` | Razorpay for activate-now |
| POST | `/api/billing/plan/activate` | Confirm plan activation payment |

### Super Admin

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PATCH | `/api/super/plans…` | Manage plans |
| GET | `/api/super/billing` | Tenant billing overview |
| PATCH | `/api/super/tenant/:id/invoice/mark-paid` | Manual mark paid |
| GET/PATCH | `/api/super/tenant/:id/enterprise` | Per-tenant enterprise pricing |

### System / cron

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/billing/system/…` | Internal monthly generation (if exposed) |

---

## 14. Admin UI

| Screen | Shows |
|--------|--------|
| **Payment Plan** | Plan cards, cycle dates, usage summary, prepaid status, pay buttons |
| **Invoice history** | All invoices, types, PDF download, CSV export |
| **Dashboard plan card** | Usage bar, prepaid vs extra bill |
| **Suspension banner** | Overdue warnings |
| **Notifications** | Due soon / overdue |

---

## 15. Audit PDF contents

Download per invoice includes: store/tenant, invoice #, type, period, plan snapshot, usage breakdown, amounts, payment method, Razorpay payment/order IDs, timestamps (IST).

---

## 16. Quick reference — who pays what when

```
FREE:     [orders all month] ──month-end──► one PER_ORDER bill ──+7d──► pay

BASIC:    [1st: prepaid monthly] ──+7d──► pay
          [orders during month, >limit ► extra running]
          ──month-end──► EXTRA_USAGE only ──+7d──► pay

ENTERPRISE: Same as BASIC or FREE depending on configured fields.
```

---

## 17. Tests

Run unit-style checks:

```bash
cd backend
node src/modules/billing/__tests__/billing.logic.test.js
```

Covers: proration, extra-order math, running bill (extras only), invoice types, calendar month.

---

## 18. Related source files

| Area | Path |
|------|------|
| Core logic | `services/billing.service.js` |
| Pricing | `services/pricing.service.js` |
| Proration | `utils/proration.util.js` |
| Plan / invoice types | `utils/billingModel.util.js` |
| Enterprise | `utils/enterprisePlan.util.js` |
| Cycle dates (IST) | `utils/cycleDates.util.js` |
| Cron | `cron/billing.cron.js` |
| Order block | `services/enforcement.service.js` |
| Tenant API | `controllers/tenantBilling.controller.js` |
| Super API | `controllers/superBilling.controller.js` |
| PDF | `services/invoiceDocument.service.js` |

---

*Last updated to match the prepaid + postpaid-extra subscription model and separate invoice types.*

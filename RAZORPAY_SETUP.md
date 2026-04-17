# Razorpay Integration — Environment Setup Guide

This guide covers every `.env` variable needed to wire up Razorpay for **test mode** across the backend, website, and mobile app.

---

## 1. Get Your Razorpay Test Keys

1. Sign in at [https://dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Toggle the **Test Mode** switch in the top-right corner (make sure it's **ON**)
3. Go to **Settings → API Keys**
4. Click **Generate Test Key** (or **Regenerate** if one already exists)
5. Copy both values shown:
   - **Key ID** — starts with `rzp_test_`
   - **Key Secret** — shown only once; copy it immediately

> **Never use live keys (`rzp_live_`) for local development or testing.**

---

## 2. Backend `.env`

Create or update `backend/.env` (in the `backend/` folder, same level as `package.json`):

```env
# ── Server ──────────────────────────────────────────────────
PORT=5000

# ── Database ────────────────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/kmf_grocery
# or Atlas:
# MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/kmf_grocery

# ── Auth ────────────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_here

# ── Tenant ──────────────────────────────────────────────────
TENANT_ID=demo-tenant

# ── Razorpay (TEST MODE) ─────────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_razorpay_test_secret_here

# Optional: platform commission split percentage (default: 10)
PLATFORM_COMMISSION_PERCENT=10

# Optional: webhook secret (set this after configuring webhook in Razorpay dashboard)
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### What each Razorpay variable does

| Variable | Used in | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` | `payment.service.js` | Authenticates the Razorpay SDK instance |
| `RAZORPAY_KEY_SECRET` | `payment.service.js` | Authenticates SDK + used to verify payment signature |
| `PLATFORM_COMMISSION_PERCENT` | `payment.service.js` | Commission % split in Route transfers (default 10%) |
| `RAZORPAY_WEBHOOK_SECRET` | `webhook.routes.js` | Validates the HMAC signature on incoming Razorpay webhooks |

---

## 3. Website `.env`

Update `website/.env`:

```env
# ── API ─────────────────────────────────────────────────────
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000
VITE_TENANT_ID=demo-tenant

# ── Razorpay (TEST MODE) ─────────────────────────────────────
# Only the Key ID goes here — NEVER put the Key Secret in the frontend
VITE_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXX
```

> The website accesses this as `import.meta.env.VITE_RAZORPAY_KEY_ID` to open the Razorpay checkout modal.

---

## 4. Mobile App — `app.config.js` / `eas.json`

Expo does not use `.env` files directly. Set the key in `app.json` / `app.config.js`:

```js
// mobile-app/app.config.js
export default {
  expo: {
    extra: {
      razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "rzp_test_XXXXXXXXXXXX",
    },
  },
};
```

Access it in the app:

```ts
import Constants from 'expo-constants';
const RAZORPAY_KEY_ID = Constants.expoConfig?.extra?.razorpayKeyId;
```

For EAS builds, add to `eas.json` under the `preview`/`development` profile:

```json
{
  "build": {
    "development": {
      "env": {
        "RAZORPAY_KEY_ID": "rzp_test_XXXXXXXXXXXX"
      }
    }
  }
}
```

---

## 5. Webhook Setup (optional for local testing)

To test webhooks locally you need to expose your backend via a tunnel (e.g. ngrok):

```bash
ngrok http 5000
```

Copy the forwarding URL (e.g. `https://abc123.ngrok-free.app`) and register it in the Razorpay dashboard:

1. **Settings → Webhooks → Add New Webhook**
2. **Webhook URL**: `https://abc123.ngrok-free.app/api/webhook/razorpay`
3. **Secret**: any strong random string — copy it to `RAZORPAY_WEBHOOK_SECRET` in `backend/.env`
4. **Events to subscribe**:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`

---

## 6. Test Card Details

Use these in the Razorpay checkout modal during testing:

| Field | Value |
|---|---|
| Card Number | `4111 1111 1111 1111` |
| Expiry | Any future date (e.g. `12/26`) |
| CVV | Any 3 digits (e.g. `123`) |
| OTP | `1234` (Razorpay test OTP) |

**UPI (test):** Use `success@razorpay` to simulate a successful UPI payment.

**Net Banking:** Select any bank and use the test credentials shown on the Razorpay test page.

---

## 7. Verify the Setup

Start the backend and hit the payment endpoint:

```bash
# 1. Start backend
cd backend
npm run dev

# 2. Place an order first, then initiate payment:
curl -X POST http://localhost:5000/api/payments/create \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "<your_order_id>"}'
```

A successful response will include a `razorpay_order_id` starting with `order_`. Use that to open the checkout modal on the frontend.

---

## 8. Security Checklist

- [ ] `backend/.env` is listed in `backend/.gitignore` — **never commit secrets**
- [ ] `website/.env` is listed in `website/.gitignore`
- [ ] `RAZORPAY_KEY_SECRET` is only in the backend `.env` — never in frontend code
- [ ] `VITE_RAZORPAY_KEY_ID` only (public key) goes in the website `.env`
- [ ] Switch to **live keys** only after thorough testing and only in production environment variables (not in `.env` files checked into git)

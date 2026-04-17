# Environment Keys — All Services

> **SECURITY WARNING:** This file contains secret keys. **Never commit this file to Git.**
> Add `ENV_KEYS.md` to your `.gitignore` immediately.

---

## 1. Backend — `backend/.env`

Create this file at `backend/.env` (next to `package.json`):

```env
# ── Server ──────────────────────────────────────────────────
PORT=5000

# ── Database ────────────────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/grocery-delivery

# ── Auth ────────────────────────────────────────────────────
JWT_SECRET=your-secret-key-change-in-production

# ── Razorpay ────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_SaHmJpDs42QvIp
RAZORPAY_KEY_SECRET=YHBaSBN6vHpzLl3SN8zHXNdC
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# ── Razorpay Route — Vendor linked account ───────────────────
VENDOR_RAZORPAY_ACCOUNT_ID=acc_XXXXXXXXXXXXXXXX

# ── Platform Settings ───────────────────────────────────────
PLATFORM_COMMISSION_PERCENT=10
```

| Variable | Current Value | Notes |
|---|---|---|
| `PORT` | `5000` | Express server port |
| `MONGO_URI` | `mongodb://localhost:27017/grocery-delivery` | Change to Atlas URI for production |
| `JWT_SECRET` | `your-secret-key-change-in-production` | Change to a strong random string in production |
| `RAZORPAY_KEY_ID` | `rzp_test_SaHmJpDs42QvIp` | Test mode key |
| `RAZORPAY_KEY_SECRET` | `YHBaSBN6vHpzLl3SN8zHXNdC` | **Never expose this in frontend** |
| `RAZORPAY_WEBHOOK_SECRET` | `your_razorpay_webhook_secret` | Set this when creating the webhook in Razorpay dashboard |
| `VENDOR_RAZORPAY_ACCOUNT_ID` | `acc_XXXXXXXXXXXXXXXX` | Linked vendor account ID from Razorpay Route |
| `PLATFORM_COMMISSION_PERCENT` | `10` | Route split % to platform account |

---

## 2. Website — `website/.env`

```env
# ── API ─────────────────────────────────────────────────────
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000

# ── Tenant ──────────────────────────────────────────────────
VITE_TENANT_ID=demo-tenant

# ── Razorpay (public key only) ───────────────────────────────
VITE_RAZORPAY_KEY_ID=rzp_test_SaHmJpDs42QvIp
```

| Variable | Current Value | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | Primary backend URL used by `config.ts` |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Fallback — kept for compatibility |
| `VITE_TENANT_ID` | `demo-tenant` | Sent as `x-tenant-id` header on all API calls |
| `VITE_RAZORPAY_KEY_ID` | `rzp_test_SaHmJpDs42QvIp` | Public key only — secret never goes here |

---

## 3. Admin Web — `admin-web/.env`

```env
# ── API ─────────────────────────────────────────────────────
VITE_API_URL=http://localhost:5000
```

| Variable | Current Value | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | Backend base URL for all admin API calls |

---

## 4. Mobile App — `mobile-app/src/config/constants.ts`

The mobile app does **not** use a `.env` file — values are hardcoded in `src/config/constants.ts`. Update them directly:

```ts
export const API_BASE_URL = {
  DEVELOPMENT: 'http://localhost:5000',
  STAGING:     'https://staging-api.egrocery.com',
  PRODUCTION:  'https://api.egrocery.com',
};

export const TENANT_ID       = 'demo-tenant';
export const RAZORPAY_KEY_ID = 'rzp_test_SaHmJpDs42QvIp';
```

| Constant | Current Value | Notes |
|---|---|---|
| `API_BASE_URL.DEVELOPMENT` | `http://localhost:5000` | Used during local dev (`BASE = API_BASE_URL.DEVELOPMENT`) |
| `API_BASE_URL.STAGING` | `https://staging-api.egrocery.com` | Update before staging build |
| `API_BASE_URL.PRODUCTION` | `https://api.egrocery.com` | Update before production build |
| `TENANT_ID` | `demo-tenant` | Sent as `x-tenant-id` on every request |
| `RAZORPAY_KEY_ID` | `rzp_test_SaHmJpDs42QvIp` | Public key used to open Razorpay checkout |

### For EAS Builds (optional)

Add to `mobile-app/eas.json` under the relevant profile:

```json
{
  "build": {
    "development": {
      "env": {
        "RAZORPAY_KEY_ID": "rzp_test_SaHmJpDs42QvIp"
      }
    },
    "production": {
      "env": {
        "RAZORPAY_KEY_ID": "rzp_live_XXXXXXXXXXXX"
      }
    }
  }
}
```

---

## 5. Quick Reference — All Keys in One Place

| Key | Value | Used In |
|---|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_SaHmJpDs42QvIp` | Backend, Website, Mobile |
| `RAZORPAY_KEY_SECRET` | `YHBaSBN6vHpzLl3SN8zHXNdC` | Backend only |
| `RAZORPAY_WEBHOOK_SECRET` | `your_razorpay_webhook_secret` | Backend only — set in Razorpay dashboard |
| `MONGO_URI` | `mongodb://localhost:27017/grocery-delivery` | Backend |
| `JWT_SECRET` | `your-secret-key-change-in-production` | Backend |
| `PORT` | `5000` | Backend |
| `TENANT_ID` / `VITE_TENANT_ID` | `demo-tenant` | All services |
| `VITE_API_URL` | `http://localhost:5000` | Website, Admin |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Website |
| `VITE_RAZORPAY_KEY_ID` | `rzp_test_SaHmJpDs42QvIp` | Website |

---

## 6. Production Checklist

- [ ] Replace all `rzp_test_` keys with `rzp_live_` keys
- [ ] Replace `MONGO_URI` with your Atlas production connection string
- [ ] Set a strong random `JWT_SECRET` (use `openssl rand -hex 64`)
- [ ] Set `RAZORPAY_WEBHOOK_SECRET` in Razorpay dashboard and copy here
- [ ] Update `API_BASE_URL.PRODUCTION` in `mobile-app/src/config/constants.ts`
- [ ] Add `ENV_KEYS.md` to `.gitignore` — never commit this file

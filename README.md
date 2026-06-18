# Grocery Delivery Application (eNandi)

Multi-tenant grocery delivery platform with customer mobile app, customer website, store admin portal, and super-admin console.

## Backend — Notify API Integration

Customer OTP and order lifecycle SMS notifications are delivered through an external **Notify** service. All HTTP calls are centralized in `backend/src/services/notify.service.js` and configured via environment variables in `backend/src/config/notify.config.js`.

### Approved templates

| Template key | Trigger |
|---|---|
| `LOGIN_OTP` | Customer login / signup OTP send, verify, resend (`business` = tenant store name) |
| `ORDER_PLACED` | Order successfully created (`PLACED`) |
| `OUT_FOR_DELIVERY` | Order status becomes `OUT_FOR_DELIVERY` |
| `ORDER_DELIVERED` | Order status becomes `DELIVERED` |

`LOGIN_OTP` uses `business` = `Tenant.name` and `variables: [storeName]` (DLT slot 1; OTP auto in slot 2). Order templates use `variables.businessName` with `business` = `NOTIFY_APP_ID`.

### Environment variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Description |
|---|---|
| `NOTIFY_ENABLED` | Master switch (`true` / `false`). When `false`, OTP requests fail with an error; order notifications are skipped. |
| `NOTIFY_BASE_URL` | Notify API base URL (e.g. `https://api.notify.elvatech.in`) |
| `NOTIFY_APP_ID` | Application identifier registered with Notify (platform credentials) |
| `NOTIFY_API_KEY` | Notify API key (secret — never commit) |
| *(runtime)* | OTP: `business` + `variables[0]` = `Tenant.name`. Orders: `variables.businessName` = `Tenant.name` |
| `NOTIFY_LOGIN_OTP_ENABLED` | Enable OTP send / verify / resend via Notify |
| `NOTIFY_ORDER_PLACED_ENABLED` | Enable `ORDER_PLACED` SMS after order creation |
| `NOTIFY_OUT_FOR_DELIVERY_ENABLED` | Enable `OUT_FOR_DELIVERY` SMS on status transition |
| `NOTIFY_ORDER_DELIVERED_ENABLED` | Enable `ORDER_DELIVERED` SMS on delivery completion |

### Error handling

- **OTP (auth-critical):** If Notify is unavailable or disabled, `send-otp` and `verify-otp` return an error. OTP is never bypassed locally.
- **Order notifications (non-critical):** Failures are logged as warnings; order creation and status updates always succeed.

### Running the backend

```bash
cd backend
cp .env.example .env
# Edit .env with your secrets
npm install
npm run dev
```

## Project structure

| Directory | Description |
|---|---|
| `backend/` | Express API server |
| `mobile-app/` | Customer React Native (Expo) app |
| `website/` | Customer web storefront |
| `admin-web/` | Store admin portal |
| `super-admin-web/` | Platform super-admin console |

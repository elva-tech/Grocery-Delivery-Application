# Developer setup (backend, mobile APK, storefront)

This repo is set up so a teammate can clone the **team branch**, install dependencies, and run services with minimal extra configuration. Shared defaults live in committed env files; **private overrides** go in gitignored files.

## Security warning

Putting API keys, Razorpay secrets, JWT secrets, Mongo URIs, or Cloudinary credentials in Git is convenient for a **small private team** but is **dangerous** if the repo is ever public or shared broadly. If that happens, **rotate every credential** immediately. Prefer production secrets in your host’s secret manager (Render, AWS, etc.), not in Git.

**Where the actual values live:** `backend/.env.development` (loaded automatically) and the consolidated reference **`ENV_KEYS.md`** at the repo root.

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| Node.js (LTS) | Backend + Vite apps + Expo |
| MongoDB | Local install **or** MongoDB Atlas URI |
| npm | Package installs |
| (Mobile APK) Java JDK + Android SDK | Local `expo run:android` |
| (Mobile cloud APK) Expo account | `eas build` (Expo Application Services) |

---

## Backend (`backend/`)

### How environment loading works

`backend/src/server.js` loads, in order:

1. **`backend/.env.development`** — committed team defaults (clone-and-run baseline).
2. **`backend/.env`** — gitignored; use this for **your machine only** or production secrets. Values here **override** `.env.development`.

Template with descriptions: **`backend/.env.example`**.

### Required variables

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string (e.g. `mongodb://127.0.0.1:27017/grocery_dev` or Atlas). |
| `JWT_SECRET` | Signs auth tokens; must be non-empty and stable per environment. |
| `SUPER_ADMIN_EMAIL` | Credentials for `POST /api/super/login`. |
| `SUPER_ADMIN_PASSWORD` | Same as above. |

### Payments (Razorpay)

| Variable | Purpose |
|----------|---------|
| `RAZORPAY_KEY_ID` | Test or live key ID (mobile client uses a publishable Key ID in `mobile-app/src/config/constants.ts`). |
| `RAZORPAY_KEY_SECRET` | **Server-only** — must match the Key ID in the Razorpay dashboard. Replace the placeholder in `.env.development` or set it in `.env`. |
| `RAZORPAY_WEBHOOK_SECRET` | Used for verifying Razorpay webhooks (`backend/src/routes/webhook.routes.js`). |

### Media uploads (Cloudinary)

| Variable | Purpose |
|----------|---------|
| `CLOUDINARY_CLOUD_NAME` | Required for uploads (products, banners, etc.). |
| `CLOUDINARY_API_KEY` | Same. |
| `CLOUDINARY_API_SECRET` | Same. |
| `CLOUDINARY_ASSETS_ROOT` | Optional folder prefix (default `grocery_app`). |

### Optional

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `5000`). |
| `LOCAL_DEFAULT_TENANT_ID` | Fallback tenant when middleware has no tenant (default in code is `demo-tenant`; team files often use `puma`). |
| `PLATFORM_COMMISSION_PERCENT` | Platform fee percent for settlements (default `10`). |
| `STRICT_TENANT_ISOLATION` | Set to `false` only for local experiments (see `backend/src/config/tenantPolicy.js`). |

### Run

```bash
cd backend
npm install
npm run dev
```

Server listens on `http://localhost:5000` (unless `PORT` is set).

---

## Consumer mobile app (`mobile-app/`) — Expo

### Environment

Expo inlines **`EXPO_PUBLIC_*`** at bundle time.

| File | Role |
|------|------|
| **`mobile-app/.env`** | Committed team defaults (`EXPO_PUBLIC_ENV`, `EXPO_PUBLIC_TENANT_ID`). |
| **`mobile-app/.env.local`** | Gitignored overrides (per developer machine). |
| **`mobile-app/.env.example`** | Documentation / copy-paste template. |
| **`mobile-app/eas.json`** | `env` block per EAS profile (`EXPO_PUBLIC_TENANT_ID`, `EXPO_PUBLIC_ENV`). |

Important variables:

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_ENV` | `development` vs `production` (see `mobile-app/src/config/constants.ts`). |
| `EXPO_PUBLIC_TENANT_ID` | Store tenant slug; must match an active tenant in MongoDB. |
| `EXPO_PUBLIC_API_DEV_URL` | Optional full API URL if LAN inference fails (e.g. `http://192.168.1.10:5000`). |

In development, the app tries to infer your PC’s LAN IP from Metro so the phone can reach `http://<host>:5000`. If builds fail to reach the API, set `EXPO_PUBLIC_API_DEV_URL` in `.env.local`.

### Run on device / emulator

```bash
cd mobile-app
npm install
npx expo start
```

Windows firewall: `npm run firewall:windows` can help allow Metro.

### Build an APK (EAS — recommended for sharing binaries)

```bash
cd mobile-app
npm install
npx eas-cli login
npx eas build -p android --profile preview
```

- **`preview`** profile in `eas.json` builds an **APK** and sets `EXPO_PUBLIC_*` for that build.
- You need access to the Expo project (`app.json` → `extra.eas.projectId`).
- App signing credentials are managed by EAS (first build may prompt to create credentials).

### Razorpay Key ID on mobile

`RAZORPAY_KEY_ID` is currently defined in **`mobile-app/src/config/constants.ts`** for the client SDK. Keep it aligned with your Razorpay mode (test vs live) and with `RAZORPAY_KEY_ID` on the backend.

---

## Storefront website (`website/`)

Uses Vite. **`website/.env.development`** is committed (team defaults).

Typical variables:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend origin (e.g. `http://localhost:5000`). |
| `VITE_API_URL` | Same pattern / alternate base depending on code paths. |
| `VITE_TENANT_ID` | Tenant slug for storefront requests. |
| `VITE_OLA_MAPS_API_KEY` / `REACT_APP_OLA_MAPS_API_KEY` | Maps provider keys where used by the UI. |

Copy **`website/.env.example`** if you need a fresh template. Use **`website/.env.development.local`** for overrides (gitignored via `*.local`).

```bash
cd website
npm install
npm run dev
```

---

## Store admin (`admin-web/`)

**`admin-web/.env.development`** — committed team defaults.

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend URL (e.g. `http://localhost:5000`). |
| `VITE_TENANT_ID` | Tenant for admin login / OTP flows. |

Overrides: `.env.development.local`.

```bash
cd admin-web
npm install
npm run dev
```

---

## Super admin (`super-admin-web/`)

`super-admin-web/.gitignore` ignores all `.env*` except `.env.example`. For local dev, copy:

```bash
cd super-admin-web
cp .env.example .env
# Edit .env — point `VITE_API_URL` at your backend (see comments in .env.example).
npm install
npm run dev
```

---

## Checklist for “other machine” / APK builder

1. **MongoDB** reachable at `MONGO_URI` (local service running or Atlas IP allowlist / user OK).
2. **Backend** `.env.development` filled for **Razorpay Key Secret** and **Cloudinary** if they need payments/uploads (placeholders will fail those features until replaced).
3. **Tenant** `EXPO_PUBLIC_TENANT_ID` / `VITE_TENANT_ID` matches a tenant that exists in the database (`puma` is used in several committed configs — ensure that tenant exists or change all apps consistently).
4. **Same Wi‑Fi / LAN** for phone + PC when using dev API inference, or set **`EXPO_PUBLIC_API_DEV_URL`**.
5. **EAS**: Expo login + access to the project for cloud APK builds.

---

## Quick reference — repo env files

| Path | Committed? | Notes |
|------|------------|--------|
| `backend/.env.development` | Yes (team branch) | Shared defaults; override with `backend/.env`. |
| `backend/.env` | No | Private overrides / production. |
| `backend/.env.example` | Yes | Documentation template. |
| `mobile-app/.env` | Yes | `EXPO_PUBLIC_*` defaults. |
| `mobile-app/.env.local` | No | Per-machine Expo overrides. |
| `website/.env.development` | Yes | Vite dev defaults. |
| `admin-web/.env.development` | Yes | Vite dev defaults. |
| `super-admin-web/.env` | No | Create from `.env.example`. |

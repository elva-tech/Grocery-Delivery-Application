# Mobile App — Configuration, Local Testing & Production Builds

Complete guide for the ELVA Grocery mobile app (Expo / React Native).

---

## Table of contents

1. [Overview](#overview)
2. [Project structure](#project-structure)
3. [How configuration works](#how-configuration-works)
4. [Config file reference](#config-file-reference)
5. [Local development](#local-development)
6. [Local testing scenarios](#local-testing-scenarios)
7. [Production builds](#production-builds)
8. [Add a new customer](#add-a-new-customer)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This app supports **two modes**:

| Mode | Who uses it | Store selection | Example |
|------|-------------|-----------------|---------|
| **Generic** | Internal / multi-store app | User enters **store code** on first open | `generic-production` |
| **Customer** | One Play Store app per store | **Fixed** at build time — no store code | `enandi-production` |

```
┌─────────────────────────────────────────────────────────────┐
│  app.json          Shared defaults (plugins, EAS ID, etc.)  │
│  app.config.js     Merges app.json + customer folder      │
│  customers/enandi/ Store-specific branding & package        │
│  eas.json          Build recipes (APK vs AAB, which customer)│
└─────────────────────────────────────────────────────────────┘
```

**Important:** `npx expo start` uses `app.json` + `.env`. It does **not** read `eas.json`.  
`eas build` uses `eas.json` + the same config chain.

---

## Project structure

```
mobile-app/
├── app/                    # Screens (Expo Router)
├── assets/                 # Shared icons, splash, fonts (fallbacks)
├── customers/              # One folder per Play Store customer
│   ├── enandi/
│   │   ├── config.json     # Required — app identity & tenant
│   │   ├── icon.png        # Optional — falls back to assets/
│   │   ├── adaptive-icon.png
│   │   └── splash.png
│   └── sales/
│       └── config.json
├── src/
│   └── utils/
│       ├── customer.ts     # Detects customer build at runtime
│       └── tenantStorage.ts # Tenant / store-code logic
├── app.json                # Shared Expo project defaults
├── app.config.js           # Loads customer config when CUSTOMER is set
├── eas.json                # EAS Build profiles
├── .env.example            # Copy to .env for local dev
└── MOBILE_GUIDE.md         # This file
```

---

## How configuration works

### At build / start time

```
CUSTOMER env var set?
        │
        ├─ NO  → use app.json only (generic app)
        │
        └─ YES → app.config.js loads customers/{CUSTOMER}/config.json
                 and overrides name, package, scheme, tenant, assets
```

### At runtime (which store / tenant)

```
getActiveTenantId()
        │
        ├─ Customer build?     → tenant from customers/*/config.json
        ├─ AsyncStorage?       → tenant saved from store code earlier
        ├─ .env dev fallback?  → EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID
        └─ Nothing             → show store code screen (generic only)
```

### App navigation on launch

```
App opens
    │
    ├─ No tenant + generic app  →  /auth/store-code
    ├─ Has tenant + not logged in →  /auth/landing
    └─ Logged in                →  /(tabs) home
```

Customer builds **always** have a tenant → skip store code.

---

## Config file reference

### `app.json` — shared project defaults

Used by **every** build. Not tied to any one customer.

| Field | Current value | Meaning |
|-------|---------------|---------|
| `name` | `ELVA Grocery` | Display name for **generic** app |
| `slug` | `elva-grocery` | Expo internal project id (not shown on Play Store) |
| `version` | `1.0.0` | Default version (customer config can override) |
| `scheme` | `elvagrocery` | Deep link scheme for generic app |
| `android.package` | `com.elvatech.grocery` | Package for generic app |
| `extra.eas.projectId` | `dfd2f395-...` | **One EAS project** for all builds |
| `plugins` | expo-router, splash, fonts | Shared — do not duplicate per customer |

Also contains: orientation, splash colors, experiments, adaptive icon paths.

---

### `customers/{name}/config.json` — per Play Store app

Everything **store-specific** lives here.

**Example — eNandi (published on Play Store):**

```json
{
  "appName": "ELVA",
  "tenantId": "enandi",
  "androidPackage": "com.vittesh.enandi",
  "urlScheme": "enandi",
  "slug": "Enandi",
  "version": "1.0.0"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `appName` | Yes | Name under the icon on the phone |
| `tenantId` | Yes | Backend store id (sent as `x-tenant-id` on API calls) |
| `androidPackage` | Yes | **Must match Play Console** for updates to work |
| `urlScheme` | Yes | Deep links, e.g. `enandi://` |
| `slug` | Yes | Expo slug for this customer build |
| `version` | No | Overrides `app.json` version for this customer |
| `iosBundleIdentifier` | No | Defaults to `androidPackage` |
| `easProjectId` | No | Defaults to `app.json` (only if separate Expo project needed) |

**Optional assets** in the same folder:

| File | Used for |
|------|----------|
| `icon.png` | App icon |
| `adaptive-icon.png` | Android adaptive icon |
| `splash.png` | Splash screen |

If missing, files from `assets/` are used.

---

### `app.config.js` — merge layer

- Reads `app.json` as the base
- If `process.env.CUSTOMER` is set, loads `customers/{CUSTOMER}/config.json`
- Picks customer assets when present
- Writes runtime values to `extra`: `customer`, `tenantId`, `urlScheme`, `whitelabel`

You normally **do not edit this file** when adding a customer — add a folder under `customers/` instead.

---

### `eas.json` — cloud build profiles

Tells **EAS Build** how to compile the app. Not used by `npx expo start`.

| Profile | Output | Customer | Use case |
|---------|--------|----------|----------|
| `generic-preview` | APK | — | Test generic app on device |
| `generic-production` | AAB | — | Generic app → Play Store |
| `enandi-preview` | APK | enandi | Test eNandi on device |
| `enandi-production` | AAB | enandi | **Update published eNandi app** |
| `sales-preview` | APK | sales | Test Sales on device |
| `sales-production` | AAB | sales | Sales → Play Store |

| Setting | Meaning |
|---------|---------|
| `buildType: apk` | Install directly on phone (testing) |
| `buildType: app-bundle` | `.aab` file — **required for Google Play** |
| `env.CUSTOMER` | Which `customers/` folder to use |
| `env.EXPO_PUBLIC_ENV: production` | App talks to production API |
| `extends` | Reuse settings from another profile |

---

### `.env` — local development only

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `CUSTOMER=enandi` | Simulate customer build locally (same as `enandi-production`) |
| `EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID=enandi` | Skip store code in generic app dev |
| `EXPO_PUBLIC_API_DEV_URL=http://192.168.1.10:5000` | Point to your PC's backend |
| `EXPO_PUBLIC_ENV=development` | Use dev API (default when running locally) |

**Restart Expo** after changing `.env`.

---

## Local development

### Prerequisites

- Node.js 18+
- Backend running on port `5000` (see repo `backend/`)
- Phone and PC on the **same Wi‑Fi**, or use USB / tunnel
- Expo Go app **or** a dev build on device

### Install dependencies

```bash
cd mobile-app
npm install
```

### Start the dev server

```bash
npx expo start
```

Other useful commands:

```bash
npx expo start --lan        # Explicit LAN (recommended on real device)
npx expo start --tunnel     # If LAN/firewall is problematic
npm run android             # Open on Android emulator
```

### API URL in dev

The app auto-detects your machine's IP from the Metro bundler URL and calls:

```
http://<your-pc-ip>:5000
```

Override in `.env` if needed:

```
EXPO_PUBLIC_API_DEV_URL=http://192.168.1.10:5000
```

Check the Expo logs for:

```
[config] ACTIVE_API_URL = http://...
```

Production API (used only in release builds with `EXPO_PUBLIC_ENV=production`):

```
https://grocery-delivery-application-x1yk.onrender.com
```

Set via `EXPO_PUBLIC_API_URL` in `eas.json` (baked into APK at build time).

---

## Local testing scenarios

### Scenario A — Generic app + store code (default)

**Setup:** No `.env`, or `.env` without `CUSTOMER`.

```bash
npx expo start
```

**Flow:**
1. App opens → **Enter Store Code** screen
2. Enter 4-character code (e.g. from admin panel)
3. Tenant saved → landing → login → home

**Good for:** Testing the multi-tenant / white-label store-code flow.

---

### Scenario B — Generic app, skip store code

**Setup:** Create `.env`:

```env
EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID=enandi
```

```bash
npx expo start
```

**Flow:** Opens directly as `enandi` — no store code screen.

**Good for:** Faster daily dev when you always work on one store.

---

### Scenario C — Test exact eNandi customer build

**Setup:** Create `.env`:

```env
CUSTOMER=enandi
```

```bash
npx expo start
```

**Flow:**
- App name / scheme / tenant behave like production eNandi
- No store code screen
- Tenant is always `enandi`

**Good for:** Verifying what users see on the published Play Store app before cloud build.

---

### Scenario D — Test Sales customer build

**Setup:**

```env
CUSTOMER=sales
```

```bash
npx expo start
```

---

### Scenario checklist

| What to test | How |
|--------------|-----|
| Store code flow | Scenario A |
| Login / OTP | Any scenario with tenant set |
| Backend connectivity | Ensure backend running; check `ACTIVE_API_URL` in logs |
| Customer branding | `CUSTOMER=enandi` + optional assets in `customers/enandi/` |
| Production API locally | Not typical — use preview APK instead |

---

## Production builds

### Prerequisites

1. [Expo account](https://expo.dev)
2. EAS CLI installed:

```bash
npm install -g eas-cli
eas login
```

3. Project linked to EAS (already configured via `app.json` → `extra.eas.projectId`)

---

### Build a test APK (install on phone)

APK files install directly — no Play Store needed. Use **preview** profiles.

**eNandi (published app config):**

```bash
cd mobile-app
eas build -p android --profile enandi-preview
```

**Sales:**

```bash
eas build -p android --profile sales-preview
```

**Generic multi-tenant app:**

```bash
eas build -p android --profile generic-preview
```

When the build finishes, EAS gives a **download link**. Open on your Android phone and install.

> First install may require "Install from unknown sources" enabled.

---

### Build for Google Play Store (AAB)

Play Store requires an **Android App Bundle** (`.aab`), not APK.

**Update existing eNandi listing** (`com.vittesh.enandi`):

```bash
eas build -p android --profile enandi-production
```

**New Sales listing:**

```bash
eas build -p android --profile sales-production
```

**Generic app listing:**

```bash
eas build -p android --profile generic-production
```

After build completes:

1. Download the `.aab` from the EAS dashboard
2. Upload to [Google Play Console](https://play.google.com/console)
3. Bump `version` in `customers/{name}/config.json` before each release

---

### Build command summary

| Goal | Command |
|------|---------|
| Test APK — eNandi | `eas build -p android --profile enandi-preview` |
| Test APK — Sales | `eas build -p android --profile sales-preview` |
| Test APK — Generic | `eas build -p android --profile generic-preview` |
| Play Store — eNandi | `eas build -p android --profile enandi-production` |
| Play Store — Sales | `eas build -p android --profile sales-production` |
| Play Store — Generic | `eas build -p android --profile generic-production` |

---

### Before every Play Store release

1. **Bump version** in `customers/{name}/config.json`:

```json
"version": "1.0.1"
```

2. **Confirm package** matches Play Console:

```json
"androidPackage": "com.vittesh.enandi"
```

3. Build with the correct profile (`enandi-production`, not generic).

4. Test with preview APK first when possible.

---

## Add a new customer

Example: add **puma**.

### Step 1 — Create customer folder

```
customers/puma/
├── config.json
├── icon.png          (optional)
├── adaptive-icon.png (optional)
└── splash.png        (optional)
```

`customers/puma/config.json`:

```json
{
  "appName": "Puma Grocery",
  "tenantId": "puma",
  "androidPackage": "com.elvatech.puma",
  "urlScheme": "puma",
  "slug": "puma-grocery",
  "version": "1.0.0"
}
```

### Step 2 — Add EAS profiles

In `eas.json`, add:

```json
"puma-preview": {
  "extends": "generic-preview",
  "env": { "CUSTOMER": "puma" }
},
"puma-production": {
  "extends": "generic-production",
  "env": { "CUSTOMER": "puma" }
}
```

### Step 3 — Create Play Console listing

Create a **new** app in Google Play Console with package `com.elvatech.puma` (must match `androidPackage`).

### Step 4 — Build and publish

```bash
eas build -p android --profile puma-preview    # test
eas build -p android --profile puma-production  # Play Store
```

### Step 5 — Local test

```env
CUSTOMER=puma
```

```bash
npx expo start
```

---

## Troubleshooting

### App stuck on store code screen

- Generic build with no tenant saved — enter store code, or set `EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID` in `.env`
- Restart Expo after `.env` changes

### API / network errors in dev

- Backend must be running (`cd backend && npm start`)
- Phone and PC on same network
- Set `EXPO_PUBLIC_API_DEV_URL` to your PC's LAN IP
- Check log: `[config] ACTIVE_API_URL = ...`

### Play Store update rejected / treated as new app

- `androidPackage` in `customers/{name}/config.json` must **exactly match** the existing Play listing
- eNandi must use `com.vittesh.enandi` and profile `enandi-production`

### Wrong app name or icon after build

- Confirm you used the correct `--profile` (e.g. `enandi-production`, not `generic-production`)
- Check `customers/{name}/config.json` and optional assets in that folder

### OTP / login issues

- Ensure backend is reachable and tenant exists in database
- Customer build: `tenantId` in config must match backend store id

### `eas build` fails

```bash
eas build -p android --profile enandi-preview --clear-cache
```

Ensure you are logged in: `eas whoami`

---

## Quick reference

```
Local dev     →  npx expo start  +  .env
Test APK      →  eas build -p android --profile {customer}-preview
Play Store    →  eas build -p android --profile {customer}-production

Config chain  →  app.json  +  customers/{CUSTOMER}/  +  eas.json (build only)
Tenant logic  →  src/utils/tenantStorage.ts
Customer flag →  src/utils/customer.ts
```

For customer folder details, see also [`customers/README.md`](./customers/README.md).

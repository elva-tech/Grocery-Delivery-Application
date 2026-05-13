# What your teammate needs to do to run everything

Use this checklist **after** they clone the repo. Shared API keys and backend settings are already in **`backend/.env.development`** (and summarized in **`ENV_KEYS.md`**). They should **not** need to hunt for secrets unless something was skipped on the branch.

More detail (APK, troubleshooting, every env variable): **`DEVELOPER_SETUP.md`**.

---

## 1. Install once on their machine

| Requirement | Why |
|-------------|-----|
| **Node.js (LTS)** | Backend, website, admin, and Expo |
| **Git** | Clone / pull updates |
| **Phone or emulator + Expo Go** (optional) | Test the consumer app without a full APK |

For **local `expo run:android`** (optional): Android Studio + JDK. For **EAS cloud APK** (recommended): only Node + an Expo account (see §5).

---

## 2. Get the right code

```bash
git clone <repo-url>
cd Grocery-Delivery-Application
```

Checkout the **branch your lead shared** (for example the team setup branch). If they only use `main`, stay on `main` after pulling latest:

```bash
git fetch
git checkout <branch-name>
git pull
```

---

## 3. Start the backend (required for real data)

```bash
cd backend
npm install
npm run dev
```

Expect: server listening on **http://localhost:5000**.

The backend loads **`backend/.env.development`** automatically, then optional **`backend/.env`** if they create one for overrides. Atlas MongoDB and Cloudinary values should already be present on the team branch—no manual `.env` file is required for a first run.

**If it fails:** check Node version, internet (Atlas), and any corporate firewall blocking MongoDB TLS.

---

## 4. Run the storefront website (optional)

```bash
cd website
npm install
npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173**). Settings come from **`website/.env.development`** (committed).

---

## 5. Run the store admin (optional)

```bash
cd admin-web
npm install
npm run dev
```

Uses **`admin-web/.env.development`**.

---

## 6. Run the consumer mobile app (Expo)

```bash
cd mobile-app
npm install
npx expo start
```

Then scan the QR code with **Expo Go** (same Wi‑Fi as the PC), or press `a` for Android emulator.

**Phone cannot reach the API?** In **`mobile-app/.env.local`** (create if missing), set:

```env
EXPO_PUBLIC_API_DEV_URL=http://YOUR_PC_LAN_IP:5000
```

Replace `YOUR_PC_LAN_IP` with the machine’s IPv4 on Wi‑Fi (not `127.0.0.1`). On Windows, they can run `ipconfig` to find it.

Team defaults are in **`mobile-app/.env`** (`EXPO_PUBLIC_TENANT_ID`, etc.).

---

## 7. Build an APK (Expo EAS)

Whoever builds needs:

1. Expo account: `npx eas-cli login`
2. Access to this project’s Expo/EAS project (invite from the repo owner if builds fail with permission errors).

```bash
cd mobile-app
npm install
npx eas build -p android --profile preview
```

`preview` is configured for an **APK** in **`mobile-app/eas.json`**.

---

## 8. Super admin UI (optional)

```bash
cd super-admin-web
cp .env.example .env
# Edit .env if the backend is not http://localhost:5000
npm install
npm run dev
```

---

## 9. Quick troubleshooting

| Problem | What to try |
|---------|-------------|
| Backend exits on Mongo error | Confirm Atlas allows their IP (or `0.0.0.0/0` for dev only), credentials unchanged |
| Mobile “Network error” | Same Wi‑Fi as PC; set `EXPO_PUBLIC_API_DEV_URL`; Windows: `npm run firewall:windows` in `mobile-app` |
| Wrong store / tenant | Tenant slug must exist in DB; configs often use **`puma`**—match **`EXPO_PUBLIC_TENANT_ID`** / **`VITE_TENANT_ID`** across apps |
| Uploads fail | Backend Cloudinary vars must be set—already on team **`backend/.env.development`** if branch is up to date |

---

## 10. Where configuration lives (no guessing)

| App | Committed config |
|-----|------------------|
| Backend | `backend/.env.development` |
| Mobile | `mobile-app/.env`, `mobile-app/eas.json` |
| Website | `website/.env.development` |
| Admin | `admin-web/.env.development` |
| All keys (reference) | **`ENV_KEYS.md`** |

Private overrides only: **`backend/.env`**, **`mobile-app/.env.local`**, **`website/.env.development.local`**, **`admin-web/.env.development.local`** (these are gitignored where applicable).

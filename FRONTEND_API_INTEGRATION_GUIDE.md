# Frontend API Integration Guide (Axios + constants.js + JWT)

This document describes a clean, repeatable way to integrate backend APIs in the frontend using:
- a single **`constants.js`** (for base URL + endpoints)
- **Axios** for HTTP calls
- **JWT token stored in `localStorage`**
- Automatically attaching the JWT token in request headers for **all protected APIs**
- **Excluding** token attachment for **login / sign-in** APIs

---

## 1) Install Axios

From your frontend project folder (example: `Grocery-Delivery-Application/admin-web`):

```bash
npm install axios
```

---

## 2) Create / update `constants.js` (central place for API endpoints)

Create or update:

- `src/config/constants.js`

Suggested structure:

```js
// src/config/constants.js

export const APP_CONSTANTS = {
  STORAGE_KEYS: {
    TOKEN: "jwtToken", // localStorage key name
  },
};

export const API_CONSTANTS = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",

  // Keep all routes in one place.
  // Prefer grouping by module and using clear names.
  ENDPOINTS: {
    AUTH: {
      LOGIN: "/api/auth/login",
      SIGN_IN: "/api/auth/signin", // if your backend uses signin
      REGISTER: "/api/auth/register",
    },

    RIDERS: {
      LIST: "/api/riders",
      CREATE: "/api/riders",
      UPDATE: (id) => `/api/riders/${id}`,
      DELETE: (id) => `/api/riders/${id}`,
    },

    ORDERS: {
      LIST: "/api/orders",
      DETAILS: (id) => `/api/orders/${id}`,
    },
  },
};
```

Notes:
- Keep **only constants** here (no network calls).
- For dynamic routes use functions (e.g. `UPDATE: (id) => \`/api/riders/${id}\``).
- If you already have a `constants.js`, keep your existing exports and add the missing pieces.

---

## 3) Decide how you store the JWT token

### 3.1 Store token after login/sign-in
When login succeeds, save the JWT token in localStorage.

Example:

```js
import { APP_CONSTANTS } from "../config/constants";

function saveToken(token) {
  localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN, token);
}
```

### 3.2 Read token when needed
Example:

```js
import { APP_CONSTANTS } from "../config/constants";

function getToken() {
  return localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN);
}
```

---

## 4) Create an Axios instance (`axiosClient.js`)

Create:

- `src/services/axiosClient.js`

This file will:
- use `API_CONSTANTS.BASE_URL`
- automatically attach `Authorization: Bearer <token>` for all requests **except** login/sign-in
- centralize error handling (optional but recommended)

```js
// src/services/axiosClient.js
import axios from "axios";
import { API_CONSTANTS, APP_CONSTANTS } from "../config/constants";

const axiosClient = axios.create({
  baseURL: API_CONSTANTS.BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Endpoints where token must NOT be added
const PUBLIC_ENDPOINTS = new Set([
  API_CONSTANTS.ENDPOINTS.AUTH.LOGIN,
  API_CONSTANTS.ENDPOINTS.AUTH.SIGN_IN,
  API_CONSTANTS.ENDPOINTS.AUTH.REGISTER, // optional: make it public if your backend allows it
]);

axiosClient.interceptors.request.use(
  (config) => {
    const url = config.url || "";

    // If request is public, do not attach token
    if (PUBLIC_ENDPOINTS.has(url)) return config;

    const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN);

    // Attach token only if available
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Optional: response interceptor for global error handling
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Example: handle unauthorized globally
    // if (error?.response?.status === 401) { ...logout / redirect... }
    return Promise.reject(error);
  }
);

export default axiosClient;
```

Important:
- This approach assumes your backend expects a header like:
  - `Authorization: Bearer <jwt>`
- If your backend expects a different header (example: `x-auth-token`), update it in one place here.

---

## 5) Create API service files that use the Axios client

Prefer “one service per module”.

Example:

### 5.1 Auth API (`authApi.js`)
Create:

- `src/services/authApi.js`

```js
// src/services/authApi.js
import axiosClient from "./axiosClient";
import { API_CONSTANTS, APP_CONSTANTS } from "../config/constants";

export async function login(payload) {
  // Token excluded by interceptor because this endpoint is PUBLIC
  const res = await axiosClient.post(API_CONSTANTS.ENDPOINTS.AUTH.LOGIN, payload);

  // Adjust based on your backend response shape
  const token = res?.data?.token;
  if (token) localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN, token);

  return res.data;
}

export async function signIn(payload) {
  const res = await axiosClient.post(API_CONSTANTS.ENDPOINTS.AUTH.SIGN_IN, payload);

  const token = res?.data?.token;
  if (token) localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN, token);

  return res.data;
}

export function logout() {
  localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN);
}
```

### 5.2 Riders API (`riderApi.js`)
Create:

- `src/services/riderApi.js`

```js
// src/services/riderApi.js
import axiosClient from "./axiosClient";
import { API_CONSTANTS } from "../config/constants";

export function getRiders(params) {
  return axiosClient.get(API_CONSTANTS.ENDPOINTS.RIDERS.LIST, { params }).then((r) => r.data);
}

export function createRider(payload) {
  return axiosClient.post(API_CONSTANTS.ENDPOINTS.RIDERS.CREATE, payload).then((r) => r.data);
}

export function updateRider(id, payload) {
  return axiosClient.put(API_CONSTANTS.ENDPOINTS.RIDERS.UPDATE(id), payload).then((r) => r.data);
}

export function deleteRider(id) {
  return axiosClient.delete(API_CONSTANTS.ENDPOINTS.RIDERS.DELETE(id)).then((r) => r.data);
}
```

---

## 6) Use APIs from components

Example usage in a React component:

```jsx
import { useEffect, useState } from "react";
import { getRiders } from "../../services/riderApi";

export default function RiderManagement() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    getRiders()
      .then((data) => {
        if (mounted) setRiders(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Riders</h1>
      <pre>{JSON.stringify(riders, null, 2)}</pre>
    </div>
  );
}
```

---

## 7) Best practices / rules to follow

1. **Never hardcode URLs** in components. Always use `API_CONSTANTS`.
2. Keep **all API calls** inside `src/services/*Api.js` (or similar).
3. Use **one axiosClient** across the app.
4. Store JWT token in **`localStorage`** only if required; for higher security consider httpOnly cookies (backend change).
5. Add token automatically through an **Axios request interceptor**.
6. Ensure token is **NOT** attached for:
   - login
   - sign-in
   - (optionally) register / forgot-password

---

## 8) Common mistakes to avoid

- Calling `axios.get("http://localhost:5000/api/...")` inside components.
- Duplicating token header logic in every API function.
- Using different localStorage keys in different places.
- Forgetting `Bearer ` prefix when backend expects it.

---

## 9) Quick checklist (copy-paste for devs)

- [ ] Install axios
- [ ] Add `API_CONSTANTS.BASE_URL` and `API_CONSTANTS.ENDPOINTS` to `constants.js`
- [ ] Save token to `localStorage` after login/sign-in
- [ ] Create `axiosClient.js` and add request interceptor
- [ ] Move API calls into `src/services/*Api.js`
- [ ] Import & use service functions from components

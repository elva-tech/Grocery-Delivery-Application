/**
 * API base: optional `VITE_API_URL` (no trailing slash), e.g. http://localhost:5000
 *
 * Local dev (recommended): leave `VITE_API_URL` unset so requests use `/api/...` on the
 * Vite dev server; `vite.config.js` proxies `/api` → the Grocery Express backend (default :5000).
 *
 * Wrong base (e.g. http://localhost:3000) will 404 — that URL is not this repo’s API.
 * Create store uses POST /api/tenant/create (public), not /api/v1/tenants.
 */
const API_ORIGIN = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function apiBaseHint404() {
  return (
    ' Expected POST /api/tenant/create on this project’s Express server (PORT 5000). ' +
    'Fix: run `npm run dev` in /backend, then in super-admin-web either unset VITE_API_URL ' +
    '(use Vite proxy) or set VITE_API_URL=http://localhost:5000 in .env.development. ' +
    'Do not point VITE_API_URL at another app (e.g. :3000) unless it implements the same routes.'
  );
}

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (API_ORIGIN) return `${API_ORIGIN}${p}`;
  return p;
}

const authHeader = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('super_admin_token') || ''}`,
});

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
}

export const superLogin = async (email, password) => {
  const res = await fetch(apiUrl('/api/super/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return data;
};

export const fetchTenants = async () => {
  const res = await fetch(apiUrl('/api/super/tenants'), { headers: authHeader() });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.message || 'Failed to fetch tenants');
  return data.tenants;
};

export const updateTenantPlan = async (id, plan) => {
  const res = await fetch(apiUrl(`/api/super/tenant/${id}/plan`), {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify({ plan }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.message || 'Failed to update plan');
  return data.tenant;
};

export const updateTenantStatus = async (id, status) => {
  const res = await fetch(apiUrl(`/api/super/tenant/${id}/status`), {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify({ status }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.message || 'Failed to update status');
  return data.tenant;
};

export const createTenant = async ({
  storeName,
  ownerName,
  phoneNumber,
  tenantId,
  logo,
  storeAddress,
  contactEmail,
  plan,
  password,
  tagline,
  heroBadge,
  heroTitle,
  heroSubtitle,
  supportEmail,
  supportPhone,
  supportHours,
}) => {
  const body = { storeName, ownerName, phoneNumber, password };
  if (tenantId && tenantId.trim())         body.tenantId     = tenantId.trim();
  if (logo)                                body.logo         = logo;
  if (storeAddress && storeAddress.trim()) body.storeAddress = storeAddress.trim();
  if (contactEmail && contactEmail.trim()) body.contactEmail = contactEmail.trim();
  if (plan)                                body.plan         = plan;
  if (typeof tagline === 'string' && tagline.trim())       body.tagline = tagline.trim();
  if (typeof heroBadge === 'string' && heroBadge.trim())     body.heroBadge = heroBadge.trim();
  if (typeof heroTitle === 'string' && heroTitle.trim())     body.heroTitle = heroTitle.trim();
  if (typeof heroSubtitle === 'string' && heroSubtitle.trim()) body.heroSubtitle = heroSubtitle.trim();
  if (typeof supportEmail === 'string' && supportEmail.trim()) body.supportEmail = supportEmail.trim();
  if (typeof supportPhone === 'string' && supportPhone.trim()) body.supportPhone = supportPhone.trim().replace(/\D/g, '').slice(-10);
  if (typeof supportHours === 'string' && supportHours.trim()) body.supportHours = supportHours.trim();

  const url = apiUrl('/api/tenant/create');
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : 'Network error';
    throw new Error(
      `${msg} while calling ${url}. Is the backend running? ` +
        (API_ORIGIN
          ? `Check VITE_API_URL=${API_ORIGIN}`
          : 'Using Vite proxy — ensure super-admin dev server is running and backend is on port 5000.')
    );
  }
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    let msg = data.message || `Failed to create store (HTTP ${res.status})`;
    if (res.status === 404) msg += apiBaseHint404();
    throw new Error(msg);
  }
  return data;
};

export const updateTenantDetails = async (id, payload) => {
  const {
    storeName,
    ownerName,
    phoneNumber,
    storeAddress,
    contactEmail,
    logo,
    newPassword,
    tagline,
    heroBadge,
    heroTitle,
    heroSubtitle,
  } = payload;
  const body = { storeName, ownerName, phoneNumber, storeAddress, contactEmail, logo };
  if (typeof tagline === 'string') body.tagline = tagline;
  if (typeof heroBadge === 'string') body.heroBadge = heroBadge;
  if (typeof heroTitle === 'string') body.heroTitle = heroTitle;
  if (typeof heroSubtitle === 'string') body.heroSubtitle = heroSubtitle;
  if (newPassword !== undefined) body.newPassword = newPassword;

  const res = await fetch(apiUrl(`/api/super/tenant/${id}/details`), {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify(body),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.message || 'Failed to update store');
  return data.tenant;
};

/**
 * Uploads store logo to Cloudinary via super-admin API.
 * @param {File} file
 * @param {{ tenantId?: string, storeName?: string }} keys — tenantId preferred; else storeName is slugified for folder (must match final tenant id when possible).
 */
export const uploadLogo = async (file, { tenantId, storeName } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  if (tenantId && String(tenantId).trim()) formData.append('tenantId', String(tenantId).trim().toLowerCase());
  if (storeName && String(storeName).trim()) formData.append('storeName', String(storeName).trim());

  const token = localStorage.getItem('super_admin_token') || '';
  const res = await fetch(apiUrl('/api/super/tenant-logo'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const hint404 =
      res.status === 404
        ? ' The API returned 404 — use a backend that includes POST /api/super/tenant-logo (restart local server after git pull), set VITE_API_URL=http://localhost:5000 in super-admin-web/.env.development, or redeploy the hosted API.'
        : '';
    throw new Error((data.message || `HTTP ${res.status}`) + hint404);
  }
  return data.url;
};

// days=0 means all-time
export const fetchBillingOverview = async (days = 30) => {
  const res = await fetch(apiUrl(`/api/super/billing?days=${days}`), { headers: authHeader() });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.message || 'Failed to fetch billing');
  return data.data; // [{ tenantId, invoice, revenue }]
};

export const markTenantInvoicePaid = async (id) => {
  const res = await fetch(apiUrl(`/api/super/tenant/${id}/invoice/mark-paid`), {
    method: 'PATCH',
    headers: authHeader(),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.message || 'Failed to mark invoice paid');
  return data.invoice;
};

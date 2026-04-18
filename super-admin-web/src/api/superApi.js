const API = import.meta.env.VITE_API_URL || 'https://grocery-delivery-application-2kc4.onrender.com';

const authHeader = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('super_admin_token') || ''}`,
});

export const superLogin = async (email, password) => {
  const res = await fetch(`${API}/api/super/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return data;
};

export const fetchTenants = async () => {
  const res = await fetch(`${API}/api/super/tenants`, { headers: authHeader() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch tenants');
  return data.tenants;
};

export const updateTenantPlan = async (id, plan) => {
  const res = await fetch(`${API}/api/super/tenant/${id}/plan`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update plan');
  return data.tenant;
};

export const updateTenantStatus = async (id, status) => {
  const res = await fetch(`${API}/api/super/tenant/${id}/status`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update status');
  return data.tenant;
};

export const createTenant = async ({ storeName, ownerName, phoneNumber, tenantId, logo, storeAddress, contactEmail, plan, password }) => {
  const body = { storeName, ownerName, phoneNumber, password };
  if (tenantId && tenantId.trim())         body.tenantId     = tenantId.trim();
  if (logo)                                body.logo         = logo;
  if (storeAddress && storeAddress.trim()) body.storeAddress = storeAddress.trim();
  if (contactEmail && contactEmail.trim()) body.contactEmail = contactEmail.trim();
  if (plan)                                body.plan         = plan;

  const res = await fetch(`${API}/api/tenant/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create store');
  return data;
};

export const updateTenantDetails = async (id, { storeName, ownerName, phoneNumber, storeAddress, contactEmail, logo, newPassword }) => {
  const body = { storeName, ownerName, phoneNumber, storeAddress, contactEmail, logo };
  if (newPassword !== undefined) body.newPassword = newPassword;

  const res = await fetch(`${API}/api/super/tenant/${id}/details`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update store');
  return data.tenant;
};

export const uploadLogo = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API}/api/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to upload logo');
  return data.url;
};

// days=0 means all-time
export const fetchBillingOverview = async (days = 30) => {
  const res = await fetch(`${API}/api/super/billing?days=${days}`, { headers: authHeader() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch billing');
  return data.data; // [{ tenantId, invoice, revenue }]
};

export const markTenantInvoicePaid = async (id) => {
  const res = await fetch(`${API}/api/super/tenant/${id}/invoice/mark-paid`, {
    method: 'PATCH',
    headers: authHeader(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to mark invoice paid');
  return data.invoice;
};

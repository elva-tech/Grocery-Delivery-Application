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

export const createTenant = async ({ storeName, ownerName, phoneNumber, tenantId }) => {
  const body = { storeName, ownerName, phoneNumber };
  if (tenantId && tenantId.trim()) body.tenantId = tenantId.trim();

  const res = await fetch(`${API}/api/tenant/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create store');
  return data;
};

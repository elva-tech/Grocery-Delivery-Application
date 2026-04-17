/**
 * Resolves the current tenantId from the browser's hostname.
 *
 * Examples:
 *   freshmart.enandi.com          → "freshmart"
 *   admin.freshmart.enandi.com    → "freshmart"
 *   localhost                     → "demo-tenant"
 */
export function getTenantId(): string {
  const host = window.location.hostname.toLowerCase();

  // Local development
  if (host === 'localhost' || host === '127.0.0.1') {
    console.log('[tenant] localhost → demo-tenant');
    return 'demo-tenant';
  }

  const parts = host.split('.');

  // admin.freshmart.enandi.com → parts = ["admin", "freshmart", "enandi", "com"]
  const adminIndex = parts.indexOf('admin');
  if (adminIndex !== -1 && parts[adminIndex + 1]) {
    const tenantId = parts[adminIndex + 1];
    console.log(`[tenant] admin subdomain → ${tenantId}`);
    return tenantId;
  }

  // freshmart.enandi.com → parts = ["freshmart", "enandi", "com"]
  const tenantId = parts[0];
  console.log(`[tenant] subdomain → ${tenantId}`);
  return tenantId;
}

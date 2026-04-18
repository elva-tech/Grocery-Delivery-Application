import { getTenantId } from './utils/getTenantId';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

// Dynamically resolved from hostname — no hardcoded values.
export const TENANT_ID: string = getTenantId();

export { getTenantId };
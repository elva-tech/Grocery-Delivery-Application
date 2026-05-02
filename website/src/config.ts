import { getTenantId } from './utils/getTenantId';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

/** @deprecated Use getTenantId() on each request so tenant always matches current env/host. */
export const TENANT_ID: string = getTenantId();

export { getTenantId };

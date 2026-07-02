import { getTenantId } from './utils/getTenantId';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

/**
 * TEMP: Set VITE_BYPASS_STORE_CLOSED=true in .env.development to hide the
 * "Store Closed" overlay during local testing. Revert by removing the flag.
 */
export const BYPASS_STORE_CLOSED: boolean =
  import.meta.env.VITE_BYPASS_STORE_CLOSED === 'true';

/** @deprecated Use getTenantId() on each request so tenant always matches current env/host. */
export const TENANT_ID: string = getTenantId();

export { getTenantId };

/** Seconds before "Resend OTP" is enabled after a successful send. */
export const OTP_RESEND_COOLDOWN_SECONDS = 150;

import AsyncStorage from '@react-native-async-storage/async-storage';

import { invalidateTenantHubCache } from '@/api/mapDeliveryHelpers';
import { CART_STORAGE_KEY } from '@/store/store';

/** Must stay in sync with legacy keys in `api/addresses.ts`. */
export const ADDRESSES_STORAGE_KEY = '@enandi_addresses';
export const PREFERRED_DELIVERY_ADDRESS_ID_KEY = '@enandi_preferred_delivery_address_id';

const LAST_ORDER_ID_KEY = '@last_order_id';

/** Keep in sync with `api/addresses.ts` (cloud migration marker keys). */
const ADDRESS_CLOUD_MIGRATION_KEY_PREFIX = '@enandi_addr_cloud_mig_';

/**
 * Clears device-local cart, saved addresses, preferred pin, order-success helpers, and rating skip flags.
 * Call on logout, login-as-different-user, and tenant/session mismatch.
 */
export async function clearCustomerLocalCaches(): Promise<void> {
  invalidateTenantHubCache();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const ratingKeys = allKeys.filter((k) => k.startsWith('@rating_skipped_'));
    const addressMigrationKeys = allKeys.filter((k) => k.startsWith(ADDRESS_CLOUD_MIGRATION_KEY_PREFIX));
    await AsyncStorage.multiRemove([
      CART_STORAGE_KEY,
      ADDRESSES_STORAGE_KEY,
      PREFERRED_DELIVERY_ADDRESS_ID_KEY,
      LAST_ORDER_ID_KEY,
      ...ratingKeys,
      ...addressMigrationKeys,
    ]);
  } catch {
    /* ignore */
  }
}

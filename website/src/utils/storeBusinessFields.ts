import type { TenantDetails } from '../api/tenantApi';

function present(value?: string | null): string {
  return String(value ?? '').trim();
}

export type StoreBusinessFields = {
  legalName: string;
  storeName: string;
  storeAddress: string;
  contactNumber: string;
  email: string;
};

export function getStoreBusinessFields(
  tenant: TenantDetails | null | undefined,
  fallbackStoreName = '',
): StoreBusinessFields {
  return {
    legalName: present(tenant?.legalName) || present(tenant?.ownerName),
    storeName: present(tenant?.storeName) || present(fallbackStoreName),
    storeAddress: present(tenant?.storeAddress),
    contactNumber: present(tenant?.phoneNumber),
    email: present(tenant?.contactEmail),
  };
}

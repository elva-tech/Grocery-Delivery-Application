import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL, getTenantId } from '../config';

/* -------- helpers -------- */
const toCatId = (name: string) =>
  `cat_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
const toSubId = (name: string) =>
  `sub_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

/* -------- in-memory cache to avoid double-fetching (must be scoped by tenant) -------- */
type ProductsCacheEntry = { tenantId: string; data: Product[]; expiry: number };
let _productsCache: ProductsCacheEntry | null = null;
const CACHE_TTL = 60_000; // 1 minute

const fetchProductsFromApi = async (tenantId: string): Promise<Product[]> => {
  const now = Date.now();
  if (
    _productsCache &&
    _productsCache.tenantId === tenantId &&
    now < _productsCache.expiry
  ) {
    return _productsCache.data;
  }

  const response = await fetch(`${API_BASE_URL}/api/products`, {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch products');
  const data = await response.json();
  const raw: any[] = data.products || [];

  const mapped = raw.map((p): Product => {
    const urls: string[] = [];
    if (Array.isArray(p.images)) {
      for (const img of p.images) {
        if (img && typeof img === 'object' && typeof (img as { url?: string }).url === 'string') {
          const u = (img as { url: string }).url.trim();
          if (u) urls.push(u);
        }
      }
    }
    if (urls.length === 0 && typeof p.imageUrl === 'string' && p.imageUrl.trim()) {
      urls.push(p.imageUrl.trim());
    }
    const mongoId = p.productId ?? p._id;
    return {
      id: mongoId != null ? String(mongoId) : '',
      parentCategoryId: p.category ? toCatId(p.category) : '',
      subCategoryId: p.subcategory ? toSubId(p.subcategory) : '',
      category: p.category || '',
      subcategory: p.subcategory || '',
      name: p.name,
      description: p.description || '',
      price: p.price,
      unit: p.unit || '',
      image: urls.length ? urls : ['/placeholder.png'],
      stock: p.availableQty ?? 0,
    };
  }).filter((p) => p.id.length > 0);

  _productsCache = {
    tenantId,
    data: mapped,
    expiry: Date.now() + CACHE_TTL,
  };
  return mapped;
};

/* Invalidate cache (call after admin creates/updates products or tenant switch) */
export const invalidateProductsCache = () => {
  _productsCache = null;
};

/* ---------------- TYPES ---------------- */

export interface AppSettings {
  allowRefunds: boolean;
  allowReportIssue: boolean;
  allowOrderCancellation: boolean;
}

export interface Product {
  id: string;
  parentCategoryId: string;
  subCategoryId: string;
  category: string;
  subcategory: string;
  name: string;
  price: number;
  unit: string;
  image: string[];
  stock: number;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
  image: string[];
  parentId: string | null;
}

/* ---------------- API SLICE ---------------- */

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  endpoints: (builder) => ({

    /* ----------- SETTINGS (Remote Config) ----------- */
    // getAppSettings: builder.query<AppSettings, void>({
    //   queryFn: () => ({
    //     data: {
    //       allowRefunds: true,
    //       allowReportIssue: false,
    //       allowOrderCancellation: true
    //     }
    //   }),
    // }),

    getAppSettings: builder.query<AppSettings, void>({
      queryFn: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/settings`, {
            headers: { 'x-tenant-id': getTenantId() },
          });
          if (!res.ok) throw new Error('settings fetch failed');
          const s = await res.json();
          return {
            data: {
              allowRefunds: s.allowRefunds ?? true,
              allowReportIssue: s.allowReportIssue ?? true,
              allowOrderCancellation: s.allowOrderCancellation ?? true,
            },
          };
        } catch {
          return { data: { allowRefunds: true, allowReportIssue: true, allowOrderCancellation: true } };
        }
      },
    }),

    /* ----------- CATEGORIES (derived from products) ----------- */
    getCategories: builder.query<Category[], void>({
      queryFn: async () => {
        try {
          const products = await fetchProductsFromApi(getTenantId());
          const parentMap = new Map<string, { name: string; image: string }>();
          const subMap = new Map<string, { name: string; image: string; parentId: string }>();

          for (const p of products) {
            if (p.category && !parentMap.has(p.parentCategoryId)) {
              parentMap.set(p.parentCategoryId, { name: p.category, image: p.image[0] });
            }
            if (p.subcategory && !subMap.has(p.subCategoryId)) {
              subMap.set(p.subCategoryId, {
                name: p.subcategory,
                image: p.image[0],
                parentId: p.parentCategoryId,
              });
            }
          }

          const categories: Category[] = [
            ...Array.from(parentMap.entries()).map(([id, val]) => ({
              id,
              name: val.name,
              icon: 'bag-outline',
              image: [val.image],
              parentId: null,
            })),
            ...Array.from(subMap.entries()).map(([id, val]) => ({
              id,
              name: val.name,
              icon: 'bag-outline',
              image: [val.image],
              parentId: val.parentId,
            })),
          ];

          return { data: categories };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
    }),

    /* ----------- PRODUCTS ----------- */
    getProducts: builder.query<Product[], string>({
      queryFn: async (tenantId) => {
        try {
          const data = await fetchProductsFromApi(tenantId);
          return { data };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
    }),

    getFeaturedProducts: builder.query<Product[], void>({
      queryFn: async () => {
        try {
          const data = await fetchProductsFromApi(getTenantId());
          return { data: data.slice(0, 4) };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
    }),

    getProductsByCategory: builder.query<Product[], string>({
      queryFn: async (catId) => {
        try {
          const data = await fetchProductsFromApi(getTenantId());
          return {
            data: data.filter(
              (p) => p.parentCategoryId === catId || p.subCategoryId === catId
            ),
          };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
    }),


    // ----------- STORE STATUS (SCHEDULE) ----------- //

    getStoreStatus: builder.query<{
      isOpen: boolean;
      reason: string;
      nextChange: string | null;
      type: string;
      startTime: string | null;
      endTime: string | null;
      startDate: string | null;
      endDate: string | null;
      manualOverride: boolean;
    }, void>({
      keepUnusedDataFor: 60,
      queryFn: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/store/status`, {
            headers: { 'x-tenant-id': getTenantId() },
          });
          if (!res.ok) throw new Error('store status fetch failed');
          const data = await res.json();
          return {
            data: {
              isOpen: data.isOpen ?? true,
              reason: data.reason ?? '',
              nextChange: data.nextChange ?? null,
              type: data.type ?? 'TIME',
              startTime: data.startTime ?? null,
              endTime: data.endTime ?? null,
              startDate: data.startDate ?? null,
              endDate: data.endDate ?? null,
              manualOverride: data.manualOverride ?? false,
            },
          };
        } catch {
          return {
            data: {
              isOpen: true, reason: '', nextChange: null,
              type: 'TIME', startTime: null, endTime: null,
              startDate: null, endDate: null, manualOverride: false,
            },
          };
        }
      },
    }),

    // ----------- ACTIVE COUPONS ----------- //

    getCoupons: builder.query<any[], void>({
      queryFn: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/coupons/active`, {
            headers: {
              'x-tenant-id': getTenantId(),
              'Authorization': `Bearer ${localStorage.getItem("token")}`,
            },
          });

          if (!res.ok) throw new Error("Failed to fetch coupons");

          const data = await res.json();

          return { data: data.coupons || [] };
        } catch (err: any) {
          console.error("COUPON FETCH ERROR:", err);
          return { error: { status: 'FETCH_ERROR', error: err.message } };
        }
      },
    }),
    /* ----------- CART & BILLING ----------- */
    calculateCart: builder.mutation<{
      subtotal: number;
      deliveryCharge: number;
      grandTotal: number;
      isFreeDelivery: boolean;
      amountToFree: number;
      discount: number;
      saved: number;
    }, any[]>({
      queryFn: async (items) => {
        try {
          const subtotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);

          // Fetch live settings — no hardcoded fallbacks; fail loudly if unavailable
          const settingsRes = await fetch(`${API_BASE_URL}/api/settings`, {
            headers: { 'x-tenant-id': getTenantId() },
          });
          if (!settingsRes.ok) throw new Error('Failed to fetch store settings');
          const s = await settingsRes.json();

          const deliveryCharge: number = s.deliveryCharge;
          const freeDeliveryAbove: number = s.freeDeliveryAbove;
          const discountType: string = s.discountType ?? 'NONE';
          const discountValue: number = s.discountValue ?? 0;
          let discount = 0;

          const isFreeDelivery = subtotal >= freeDeliveryAbove;
          const finalDelivery = (subtotal === 0 || isFreeDelivery) ? 0 : deliveryCharge;
          const amountToFree = isFreeDelivery ? 0 : freeDeliveryAbove - subtotal;

          if (discountType === 'PERCENTAGE' && discountValue > 0) {
            discount = Math.round((subtotal * discountValue) / 100);
          } else if (discountType === 'FLAT' && discountValue > 0) {
            discount = discountValue;
          }
          discount = Math.min(discount, subtotal);

          const grandTotal = subtotal + finalDelivery - discount;
          const saved = (isFreeDelivery ? deliveryCharge : 0) + discount;

          return {
            data: {
              subtotal,
              deliveryCharge: finalDelivery,
              grandTotal,
              isFreeDelivery,
              amountToFree,
              discount,
              saved,
            }
          };
        } catch (error) {
          return { error: { status: 500, data: 'Calculation Error' } };
        }
      },
    }),

  }),
});

export const {
  useGetCategoriesQuery,
  useGetProductsQuery,
  useGetFeaturedProductsQuery,
  useGetProductsByCategoryQuery,
  useCalculateCartMutation,
  useGetAppSettingsQuery,
  useGetStoreStatusQuery,
  useGetCouponsQuery,
} = apiSlice;
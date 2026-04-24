import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';

const BASE = API_BASE_URL.DEVELOPMENT;
const tenantHeaders = async () => ({ 'x-tenant-id': await getActiveTenantId() });
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  description?: string;
  price: number;
  unit: string;
  image: string[];
  stock: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  image: string[];
  parentId: string | null;
}

/* ---------------- NORMALIZER ---------------- */

const normalizeProduct = (p: any): Product => ({
  id: String(p.productId ?? p._id),
  name: p.name,
  parentCategoryId: p.category || '',
  subCategoryId: p.subcategory || '',
  category: p.category || '',
  subcategory: p.subcategory || '',
  description: p.description || '',
  price: p.price,
  unit: p.unit,
  image: p.imageUrl ? [p.imageUrl] : [],
  stock: p.availableQty ?? 0,
});

/** Derives a flat category list (parents + subs) from the product list. */
const deriveCategories = (products: Product[]): Category[] => {
  const parentMap = new Map<string, Category>();
  const subMap = new Map<string, Category>();

  for (const p of products) {
    if (p.parentCategoryId && !parentMap.has(p.parentCategoryId)) {
      parentMap.set(p.parentCategoryId, {
        id: p.parentCategoryId,
        name: p.parentCategoryId,
        icon: 'grid-outline',
        image: p.image,
        parentId: null,
      });
    }
    if (p.subCategoryId && !subMap.has(p.subCategoryId)) {
      subMap.set(p.subCategoryId, {
        id: p.subCategoryId,
        name: p.subCategoryId,
        icon: 'grid-outline',
        image: p.image,
        parentId: p.parentCategoryId || null,
      });
    }
  }

  return [...parentMap.values(), ...subMap.values()];
};

/* ---------------- API SLICE ---------------- */

// Helper function to format time to 12-hour format
const formatTime12 = (time?: string) => {
  if (!time) return undefined;

  const [h, m] = time.split(":").map(Number);

  const hour = h % 12 || 12;
  const ampm = h >= 12 ? "PM" : "AM";

  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
};


export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  endpoints: (builder) => ({

    /* ----------- SETTINGS ----------- */
    getAppSettings: builder.query<AppSettings, void>({
      queryFn: async () => {
        try {
          const res = await fetch(`${BASE}/api/settings`, { headers: await tenantHeaders() });
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
          const res = await fetch(`${BASE}/api/products`, { headers: await tenantHeaders() });
          if (!res.ok) throw new Error('products fetch failed');
          const json = await res.json();
          const products: Product[] = (json.products || []).map(normalizeProduct);
          return { data: deriveCategories(products) };
        } catch (e: any) {
          return { error: { status: 'FETCH_ERROR', error: e.message } };
        }
      },
    }),

    /* ----------- PRODUCTS ----------- */
    getProducts: builder.query<Product[], void>({
      queryFn: async () => {
        try {
          const res = await fetch(`${BASE}/api/products`, { headers: await tenantHeaders() });
          if (!res.ok) throw new Error('products fetch failed');
          const json = await res.json();
          return { data: (json.products || []).map(normalizeProduct) };
        } catch (e: any) {
          return { error: { status: 'FETCH_ERROR', error: e.message } };
        }
      },
    }),

    /* ----------- PRODUCTS BY CATEGORY (PARENT OR SUB) ----------- */
    getProductsByCategory: builder.query<Product[], string>({
      queryFn: async (categoryId) => {
        try {
          const res = await fetch(`${BASE}/api/products?category=${encodeURIComponent(categoryId)}`, { headers: await tenantHeaders() });
          if (!res.ok) throw new Error('products fetch failed');
          const json = await res.json();
          const all: Product[] = (json.products || []).map(normalizeProduct);
          // Also include sub-category matches (subcategory filter on client side)
          const filtered = all.filter(
            p => p.parentCategoryId === categoryId || p.subCategoryId === categoryId
          );
          return { data: filtered.length ? filtered : all };
        } catch (e: any) {
          return { error: { status: 'FETCH_ERROR', error: e.message } };
        }
      },
    }),

    /* ----------- FEATURED (first 6 products) ----------- */
    getFeaturedProducts: builder.query<Product[], void>({
      queryFn: async () => {
        try {
          const res = await fetch(`${BASE}/api/products`, { headers: await tenantHeaders() });
          if (!res.ok) throw new Error('products fetch failed');
          const json = await res.json();
          return { data: (json.products || []).map(normalizeProduct).slice(0, 6) };
        } catch (e: any) {
          return { error: { status: 'FETCH_ERROR', error: e.message } };
        }
      },
    }),


    // COUPON FETCHING FOR USER
    getCoupons: builder.query<any[], void>({
  queryFn: async () => {
    try {
      const token = await AsyncStorage.getItem("token"); // IMPORTANT
      const tenantId = await getActiveTenantId();

      const res = await fetch(`${BASE}/api/coupons/active`, {
        headers: {
          'x-tenant-id': tenantId,
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to fetch coupons");

      const data = await res.json();

      return { data: data.coupons || [] };
    } catch (e: any) {
      return { error: { status: 'FETCH_ERROR', error: e.message } };
    }
  },
}),

    /* ----------- STORE STATUS ----------- */
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
      queryFn: async () => {
        try {
          const res = await fetch(`${BASE}/api/store/status`, { headers: await tenantHeaders() });
          if (!res.ok) throw new Error('store status fetch failed');
          const data = await res.json();
          return {
            data: {
              isOpen:         data.isOpen ?? true,
              reason:         data.reason ?? '',
              nextChange:     data.nextChange ?? null,
              type:           data.type ?? 'TIME',
              startTime:      data.startTime ?? null,
              endTime:        data.endTime ?? null,
              startDate:      data.startDate ?? null,
              endDate:        data.endDate ?? null,
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
  }),
});



/* ---------------- EXPORTS ---------------- */

export const {
  useGetCategoriesQuery,
  useGetProductsQuery,
  useGetProductsByCategoryQuery,
  useGetFeaturedProductsQuery,
  useGetAppSettingsQuery,
  useGetStoreStatusQuery,
  useGetCouponsQuery,
} = apiSlice;
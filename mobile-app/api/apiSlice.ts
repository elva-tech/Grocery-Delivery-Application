import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL, TENANT_ID } from '@/src/config/constants';

const BASE = API_BASE_URL.DEVELOPMENT;
const TENANT_HEADERS = { 'x-tenant-id': TENANT_ID };

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
          const res = await fetch(`${BASE}/api/settings`, { headers: TENANT_HEADERS });
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
          const res = await fetch(`${BASE}/api/products`, { headers: TENANT_HEADERS });
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
          const res = await fetch(`${BASE}/api/products`, { headers: TENANT_HEADERS });
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
          const res = await fetch(`${BASE}/api/products?category=${encodeURIComponent(categoryId)}`, { headers: TENANT_HEADERS });
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
          const res = await fetch(`${BASE}/api/products`, { headers: TENANT_HEADERS });
          if (!res.ok) throw new Error('products fetch failed');
          const json = await res.json();
          return { data: (json.products || []).map(normalizeProduct).slice(0, 6) };
        } catch (e: any) {
          return { error: { status: 'FETCH_ERROR', error: e.message } };
        }
      },
    }),

    getStoreStatus: builder.query<{
      isClosed: boolean;
      reason: string;
      type: "TIME" | "DATE";
      startTime?: string;
      endTime?: string;
      startDate?: string;
      endDate?: string;
    }, void>({
      queryFn: async () => {
        try {
          const now = new Date();

          // MOCK (same as website)
          const schedule = {
            type: "DATE" as "TIME" | "DATE",
            startDate: "2026-01-01",
            endDate: "2099-12-31",
            startTime: "00:00",
            endTime: "23:59",
            reason: "Store closed for maintenance",
            isActive: false // TODO: Change to true when store is closed
          };

          let isClosed = false;

          if (schedule.isActive) {
            if (schedule.type === "TIME") {
              const current = now.getHours() * 60 + now.getMinutes();

              const [sh, sm] = schedule.startTime.split(":").map(Number);
              const [eh, em] = schedule.endTime.split(":").map(Number);

              const start = sh * 60 + sm;
              const end = eh * 60 + em;

              isClosed =
                start < end
                  ? current >= start && current <= end
                  : current >= start || current <= end;
            }

            if (schedule.type === "DATE") {
              const start = new Date(
                schedule.startDate + "T" + (schedule.startTime || "00:00") + ":00"
              );

              const end = new Date(
                schedule.endDate + "T" + (schedule.endTime || "23:59") + ":59"
              );

              isClosed = now >= start && now <= end;
            }
          }

          return {
            data: {
              isClosed,
              reason: schedule.reason,
              type: schedule.type,
              startTime: formatTime12(schedule.startTime),
              endTime: formatTime12(schedule.endTime),
              startDate: schedule.startDate,
              endDate: schedule.endDate,
            }
          };

        } catch {
          return {
            error: { status: 500, data: "Store status error" }
          };
        }
      }
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
} = apiSlice;
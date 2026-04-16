import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL, TENANT_ID } from '../config';

/* -------- helpers -------- */
const toCatId = (name: string) =>
  `cat_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
const toSubId = (name: string) =>
  `sub_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

/* -------- in-memory cache to avoid double-fetching -------- */
let _productsCache: Product[] | null = null;
let _cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

const fetchProductsFromApi = async (): Promise<Product[]> => {
  const now = Date.now();
  if (_productsCache && now < _cacheExpiry) return _productsCache;

  const response = await fetch(`${API_BASE_URL}/api/products`, {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': TENANT_ID,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch products');
  const data = await response.json();
  const raw: any[] = data.products || [];

  _productsCache = raw.map((p): Product => ({
    id: String(p.productId),
    parentCategoryId: p.category ? toCatId(p.category) : '',
    subCategoryId: p.subcategory ? toSubId(p.subcategory) : '',
    category: p.category || '',
    subcategory: p.subcategory || '',
    name: p.name,
    description: p.description || '',
    price: p.price,
    unit: p.unit || '',
    image: p.imageUrl ? [p.imageUrl] : ['/placeholder.png'],
    stock: p.availableQty ?? 0,
  }));

  _cacheExpiry = Date.now() + CACHE_TTL;
  return _productsCache;
};

/* Invalidate cache (call after admin creates/updates products) */
export const invalidateProductsCache = () => {
  _productsCache = null;
  _cacheExpiry = 0;
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
    getAppSettings: builder.query<AppSettings, void>({
      queryFn: () => ({
        data: {
          allowRefunds: true,
          allowReportIssue: false,
          allowOrderCancellation: true
        }
      }),
    }),

    /* ----------- CATEGORIES (derived from products) ----------- */
    getCategories: builder.query<Category[], void>({
      queryFn: async () => {
        try {
          const products = await fetchProductsFromApi();
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
    getProducts: builder.query<Product[], void>({
      queryFn: async () => {
        try {
          const data = await fetchProductsFromApi();
          return { data };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
    }),

    getFeaturedProducts: builder.query<Product[], void>({
      queryFn: async () => {
        try {
          const data = await fetchProductsFromApi();
          return { data: data.slice(0, 4) };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
    }),

    getProductsByCategory: builder.query<Product[], string>({
      queryFn: async (catId) => {
        try {
          const data = await fetchProductsFromApi();
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

          const schedule:
            | {
              type: "TIME";
              startTime: string;
              endTime: string;
              reason: string;
              isActive: boolean;
            }

            | {
              type: "DATE";
              startDate: string;
              endDate: string;
              reason: string;
              isActive: boolean;


              // MOCK BACKEND DATA (CHANGE HERE TO TEST)

            } = {
            // type: "TIME",
            // startTime: "12:00",
            // endTime: "8:00",
            // reason: "Store under maintenance",
            // isActive: true

            // uses real Timezone Date
            type: "DATE",
            startDate: "2026-04-01",
            endDate: "2026-04-28",
            startTime: "10:00",
            endTime: "20:00",
            reason: "we are kindly inactive in these days",
            isActive: false
          }
          let isClosed = false;
          // these red errors are common cuz time is not active

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
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              startDate: schedule.type === "DATE" ? (schedule.startDate as string) : undefined,
              endDate: schedule.type === "DATE" ? (schedule.endDate as string) : undefined,
            }
          };
        } catch (err: any) {
          return {
            error: { status: 500, data: "Store status error" }
          };
        }
      }
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
            headers: { 'x-tenant-id': TENANT_ID },
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
  useGetStoreStatusQuery
} = apiSlice;
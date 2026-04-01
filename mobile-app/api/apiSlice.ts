import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { ACTIVE_API_URL, TENANT_ID } from '@/src/config/constants';

/* -------- helpers -------- */
const toCatId = (name: string) =>
  `cat_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
const toSubId = (name: string) =>
  `sub_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

/* -------- in-memory cache -------- */
let _productsCache: Product[] | null = null;
let _cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

const fetchProductsFromApi = async (): Promise<Product[]> => {
  const now = Date.now();
  if (_productsCache && now < _cacheExpiry) return _productsCache;

  const response = await fetch(`${ACTIVE_API_URL}/api/products`, {
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
    image: p.imageUrl ? [p.imageUrl] : [],
    stock: p.availableQty ?? 0,
  }));

  _cacheExpiry = Date.now() + CACHE_TTL;
  return _productsCache;
};

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

export interface Banner {
  id: string;
  image: string;
  title?: string;
}

/* ---------------- API SLICE ---------------- */

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  endpoints: (builder) => ({

    /* ----------- SETTINGS ----------- */
    getAppSettings: builder.query<AppSettings, void>({
      queryFn: () => ({
        data: {
          allowRefunds: true,
          allowReportIssue: false,
          allowOrderCancellation: true,
        },
      }),
    }),

    /* ----------- BANNERS ----------- */
    getBanners: builder.query<Banner[], void>({
      queryFn: async () => {
        try {
          const response = await fetch(`${ACTIVE_API_URL}/banners`, {
            headers: { 'x-tenant-id': TENANT_ID },
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to fetch banners');
          return { data: data.data || [] };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
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
              parentMap.set(p.parentCategoryId, { name: p.category, image: p.image[0] || '' });
            }
            if (p.subcategory && !subMap.has(p.subCategoryId)) {
              subMap.set(p.subCategoryId, {
                name: p.subcategory,
                image: p.image[0] || '',
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
          return { data: data.slice(0, 6) };
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

  }),
});

/* ---------------- EXPORTS ---------------- */

export const {
  useGetCategoriesQuery,
  useGetProductsQuery,
  useGetProductsByCategoryQuery,
  useGetFeaturedProductsQuery,
  useGetAppSettingsQuery,
  useGetBannersQuery,
} = apiSlice;
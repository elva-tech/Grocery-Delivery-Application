import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from './mockdata';

/* ---------------- TYPES ---------------- */

export interface AppSettings {
  allowRefunds: boolean;
  allowReportIssue: boolean;
  allowOrderCancellation: boolean;
}

export interface Product {
  id: string;
  parentCategoryId: string | null;
  subCategoryId: string;
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

  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL,
    prepareHeaders: (headers) => {
      const tenantId = import.meta.env.VITE_TENANT_ID;
      if (tenantId) {
        headers.set('x-tenant-id', tenantId);
      }
      return headers;
    }
  }),

  endpoints: (builder) => ({

    /* ----------- SETTINGS ----------- */
    getAppSettings: builder.query<AppSettings, void>({
      queryFn: () => ({
        data: {
          allowRefunds: true,
          allowReportIssue: false,
          allowOrderCancellation: true
        }
      }),
    }),

    /* ----------- CATEGORIES ----------- */
    getCategories: builder.query<Category[], void>({
      queryFn: () => ({ data: MOCK_CATEGORIES as Category[] }),
    }),

    /* ----------- PRODUCTS ----------- */
    getProducts: builder.query<Product[], void>({
      query: () => ({
        url: '/api/products',
        method: 'GET'
      }),

      transformResponse: (response: any) => {
        const apiProducts = response?.products || [];

        const mappedProducts = apiProducts.map((p: any) => ({
          id: p.productId || p._id,
          subCategoryId: String(p.category),
          parentCategoryId: p.parentCategory
            ? String(p.parentCategory)
            : null,
          name: p.name,
          price: p.price,
          unit: p.unit,
          image: p.imageUrl ? [p.imageUrl] : [],
          stock: p.availableQty,
          description: p.description || ""
        }));

        // fallback only if API empty
        if (mappedProducts.length === 0) {
          return MOCK_PRODUCTS as Product[];
        }

        return mappedProducts;
      }
    }),

    /* ----------- FEATURED PRODUCTS ----------- */
    getFeaturedProducts: builder.query<Product[], void>({
      queryFn: () => ({ data: MOCK_PRODUCTS.slice(0, 4) as Product[] }),
    }),

    /* ----------- PRODUCTS BY CATEGORY ----------- */
    getProductsByCategory: builder.query<Product[], string>({
      queryFn: (catId) => ({
        data: MOCK_PRODUCTS.filter(p =>
          String(p.parentCategoryId) === String(catId) ||
          String(p.subCategoryId) === String(catId)
        ) as Product[]
      }),
    }),

    /* ----------- CART BILLING ----------- */
    calculateCart: builder.mutation<{
      subtotal: number;
      deliveryCharge: number;
      grandTotal: number;
      isFreeDelivery: boolean;
    }, any[]>({
      queryFn: async (items) => {
        try {
          const subtotal = items.reduce(
            (acc, item) => acc + (item.price * item.quantity),
            0
          );

          const freeDeliveryThreshold = 500;
          const isFree = subtotal >= freeDeliveryThreshold;

          const deliveryCharge =
            (subtotal === 0 || isFree) ? 0 : 40;

          return {
            data: {
              subtotal,
              deliveryCharge,
              grandTotal: subtotal + deliveryCharge,
              isFreeDelivery: isFree
            }
          };

        } catch (error) {
          return {
            error: {
              status: 500,
              data: 'Calculation Error'
            }
          };
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
  useGetAppSettingsQuery
} = apiSlice;
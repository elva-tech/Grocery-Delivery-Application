import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from './mockData';

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
  name: string;
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
          allowReportIssue: true, 
          allowOrderCancellation: true 
        } 
      }),
    }),

    /* ----------- CATEGORIES ----------- */
    getCategories: builder.query<Category[], void>({
      queryFn: () => ({ data: MOCK_CATEGORIES }),
    }),

    /* ----------- ALL PRODUCTS ----------- */
    getProducts: builder.query<Product[], void>({
      queryFn: () => ({ data: MOCK_PRODUCTS }),
    }),

    /* ----------- PRODUCTS BY CATEGORY (PARENT OR SUB) ----------- */
    getProductsByCategory: builder.query<Product[], string>({
      queryFn: (categoryId) => ({
        data: MOCK_PRODUCTS.filter(
          p =>
            p.parentCategoryId === categoryId ||
            p.subCategoryId === categoryId
        ),
      }),
    }),

    /* ----------- FEATURED ----------- */
    getFeaturedProducts: builder.query<Product[], void>({
      queryFn: () => ({ data: MOCK_PRODUCTS.slice(0, 6) }),
    }),

  }),
});

/* ---------------- EXPORTS ---------------- */

export const {
  useGetCategoriesQuery,
  useGetProductsQuery,
  useGetProductsByCategoryQuery,
  useGetFeaturedProductsQuery,
  useGetAppSettingsQuery, // Added export
} = apiSlice;
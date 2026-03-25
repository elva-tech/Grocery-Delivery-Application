import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { MOCK_CATEGORIES } from "./mockdata";
import { desc } from "framer-motion/client";
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
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("token");

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      headers.set("x-tenant-id", import.meta.env.VITE_TENTANT_ID);

      return headers;
    },
  }),
  endpoints: (builder) => ({
    /* ----------- SETTINGS (Remote Config) ----------- */
    getAppSettings: builder.query<AppSettings, void>({
      queryFn: () => ({
        data: {
          allowRefunds: true,
          allowReportIssue: false,
          allowOrderCancellation: true,
        },
      }),
    }),

    /* ----------- CATEGORIES ----------- */
    getCategories: builder.query<Category[], void>({
      queryFn: () => ({ data: MOCK_CATEGORIES as Category[] }),
    }),

    /* ----------- PRODUCTS ----------- */
    getProducts: builder.query<Product[], void>({
      query: () => "/api/products",
      transformResponse: (response: any) =>
        (response.products || []).map((p: any) => {
          const subCat = MOCK_CATEGORIES.find((c) => c.id === p.category);

          return {
            id: p.productId,
            name: p.name,
            price: p.price,
            unit: p.unit,
            image: p.imageUrl ? [p.imageUrl] : [],
            description: p.description || "",
            stock: p.availableQty,
            parentCategoryId: subCat?.parentId || null,
            subCategoryId: p.category,
          };
        }),
    }),
    getFeaturedProducts: builder.query<Product[], void>({
      query: () => "products/featured",
    }),

    getProductsByCategory: builder.query<Product[], string>({
      query: () => "/api/products",
      transformResponse: (response: any) =>
        (response.products || []).map((p: any) => ({
          id: p.productId,
          name: p.name,
          price: p.price,
          unit: p.unit,
          image: p.imageUrl ? [p.imageUrl] : [],
          description: p.description || "",
          stock: p.availableQty,
          parentCategoryId:
            MOCK_CATEGORIES.find((c) => c.id === p.category)?.parentId || null,
          subCategoryId: p.category,
        })),
    }),

    /* ----------- CART & BILLING ----------- */
    calculateCart: builder.mutation<
      {
        subtotal: number;
        deliveryCharge: number;
        grandTotal: number;
        isFreeDelivery: boolean;
      },
      any[]
    >({
      queryFn: async (items) => {
        try {
          const subtotal = items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
          );
          const freeDeliveryThreshold = 500;
          const isFree = subtotal >= freeDeliveryThreshold;
          const deliveryCharge = subtotal === 0 || isFree ? 0 : 40;

          return {
            data: {
              subtotal,
              deliveryCharge,
              grandTotal: subtotal + deliveryCharge,
              isFreeDelivery: isFree,
            },
          };
        } catch (error) {
          return { error: { status: 500, data: "Calculation Error" } };
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
  useGetAppSettingsQuery, // Exported new hook
} = apiSlice;

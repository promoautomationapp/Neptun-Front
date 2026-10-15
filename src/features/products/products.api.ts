import { z } from "zod";
import { request } from "../../api/client";
import { productSchema } from "../../domain/schemas";
export interface ProductFilters {
  q?: string;
  code?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  limit?: number;
  offset?: number;
}
export const productPageSchema = z.object({
  products: z.array(productSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  nextOffset: z.number().nullable(),
});
export const searchCatalog = (
  filters: ProductFilters = {},
  signal?: AbortSignal,
) =>
  request(
    `/api/products?${new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]))}`,
    productPageSchema,
    { signal },
  );
export const catalogByCodes = async (codes: string[], signal?: AbortSignal) =>
  (
    await request(
      "/api/products/batch",
      z.object({ products: z.array(productSchema) }),
      { method: "POST", body: { codes: [...new Set(codes)] }, signal },
    )
  ).products;
export const sourceCategorySchema = z.object({
  id: z.number(),
  parentId: z.number(),
  name: z.string(),
  path: z.array(z.string()),
  categoryPath: z.string(),
  url: z.string(),
  lastSeenAt: z.string(),
});
export type SourceCategory = z.infer<typeof sourceCategorySchema>;
export const catalogFacets = (signal?: AbortSignal) =>
  request(
    "/api/products/facets",
    z.object({
      categories: z.array(z.string()),
      sourceCategories: z.array(sourceCategorySchema).default([]),
      brands: z.array(z.string()),
      paths: z.array(
        z.object({
          category: z.string(),
          subcategory: z.string(),
          brand: z.string(),
          categoryPath: z.string().optional(),
        }),
      ),
    }),
    { signal },
  );

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
export const catalogFacets = () =>
  request(
    "/api/products/facets",
    z.object({
      categories: z.array(z.string()),
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
  );

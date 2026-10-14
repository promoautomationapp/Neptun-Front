import { z } from "zod";
import { request } from "./client";

export const catalogBrandSchema = z.object({
  id: z.number(),
  name: z.string(),
  sourceImageUrl: z.string().default(""),
  image: z.string().default(""),
});
export type CatalogBrand = z.infer<typeof catalogBrandSchema>;
export const getCatalogBrands = (signal?: AbortSignal) =>
  request(
    "/api/catalog/brands",
    z.object({ brands: z.array(catalogBrandSchema) }),
    { signal },
  );

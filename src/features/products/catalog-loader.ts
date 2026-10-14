import type { Product } from "../../domain/models";
import { searchCatalog } from "./products.api";

/** Keep the editor's complete code index while loading catalog metadata in bounded pages. */
export async function loadCatalog(signal?: AbortSignal): Promise<Product[]> {
  const products = new Map<string, Product>();
  let offset = 0;
  for (;;) {
    const page = await searchCatalog({ limit: 100, offset }, signal);
    for (const product of page.products) products.set(product.code, product);
    if (page.nextOffset === null) break;
    if (page.nextOffset <= offset)
      throw new Error("The catalog returned an invalid page. Please retry.");
    offset = page.nextOffset;
  }
  // Alternate photos are fetched for the selected product when its editor opens.
  signal?.throwIfAborted();
  return [...products.values()];
}

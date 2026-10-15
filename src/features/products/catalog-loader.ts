import type { Product } from "../../domain/models";
import { searchCatalog } from "./products.api";

/** Read the complete index in bounded parallel pages; never replace it with a partial result. */
export async function loadCatalog(signal?: AbortSignal): Promise<Product[]> {
  const abort = new AbortController();
  const cancel = () => abort.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  try {
    const first = await searchCatalog({ limit: 100, offset: 0 }, abort.signal);
    const products = new Map<string, Product>();
    const add = (page: typeof first) => {
      if (page.total !== first.total)
        throw new Error(
          "The catalog changed while loading. Refresh to load the complete catalog.",
        );
      for (const product of page.products) products.set(product.code, product);
    };
    add(first);
    const pages = new Map<number, typeof first>([[0, first]]);
    if (first.nextOffset !== null) {
      if (
        first.limit <= 0 ||
        first.nextOffset !== first.limit ||
        first.nextOffset >= first.total
      )
        throw new Error("The catalog returned an invalid page. Please retry.");
      const offsets: number[] = [];
      for (
        let offset = first.nextOffset;
        offset < first.total;
        offset += first.limit
      )
        offsets.push(offset);
      let cursor = 0;
      let failure: unknown;
      await Promise.all(
        Array.from({ length: Math.min(4, offsets.length) }, async () => {
          while (cursor < offsets.length && !failure) {
            const offset = offsets[cursor++]!;
            try {
              const page = await searchCatalog(
                { limit: first.limit, offset },
                abort.signal,
              );
              if (
                page.offset !== offset ||
                page.limit !== first.limit ||
                page.nextOffset !==
                  (offset + first.limit < first.total
                    ? offset + first.limit
                    : null)
              )
                throw new Error(
                  "The catalog returned an invalid page. Please retry.",
                );
              if (page.total !== first.total)
                throw new Error(
                  "The catalog changed while loading. Refresh to load the complete catalog.",
                );
              pages.set(offset, page);
            } catch (error) {
              failure ??= error;
              abort.abort(error);
            }
          }
        }),
      );
      if (failure) throw failure;
      for (const offset of offsets) add(pages.get(offset)!);
    }
    if (products.size < first.total)
      throw new Error(
        "The catalog is still changing. Your saved products are kept; refresh to load the complete catalog.",
      );
    abort.signal.throwIfAborted();
    // Alternate photos load on demand when a product's gallery opens.
    return [...products.values()];
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

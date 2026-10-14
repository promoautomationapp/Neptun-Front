import { beforeEach, expect, it, vi } from "vitest";
import { loadCatalog } from "../../src/features/products/catalog-loader";
import {
  catalogByCodes,
  searchCatalog,
} from "../../src/features/products/products.api";
vi.mock("../../src/features/products/products.api", () => ({
  searchCatalog: vi.fn(),
  catalogByCodes: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
it("loads the full code index without fetching every product's alternate photos", async () => {
  vi.mocked(searchCatalog)
    .mockResolvedValueOnce({
      products: [{ code: "a", name: "A" }],
      total: 2,
      offset: 0,
      limit: 100,
      nextOffset: 100,
    })
    .mockResolvedValueOnce({
      products: [{ code: "b", name: "B" }],
      total: 2,
      offset: 100,
      limit: 100,
      nextOffset: null,
    });
  expect((await loadCatalog()).map((product) => product.code)).toEqual([
    "a",
    "b",
  ]);
  expect(catalogByCodes).not.toHaveBeenCalled();
});
it("rejects non-advancing pagination instead of repeatedly fetching the catalog", async () => {
  vi.mocked(searchCatalog).mockResolvedValue({
    products: [],
    total: 1,
    offset: 0,
    limit: 100,
    nextOffset: 0,
  });
  await expect(loadCatalog()).rejects.toThrow("invalid page");
  expect(searchCatalog).toHaveBeenCalledTimes(1);
});

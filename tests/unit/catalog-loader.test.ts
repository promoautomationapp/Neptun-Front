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
      limit: 1,
      nextOffset: 1,
    })
    .mockResolvedValueOnce({
      products: [{ code: "b", name: "B" }],
      total: 2,
      offset: 1,
      limit: 1,
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

it("rejects an incomplete or duplicate code index instead of silently losing products", async () => {
  vi.mocked(searchCatalog)
    .mockResolvedValueOnce({
      products: [{ code: "a", name: "A" }],
      total: 2,
      offset: 0,
      limit: 1,
      nextOffset: 1,
    })
    .mockResolvedValueOnce({
      products: [{ code: "a", name: "A" }],
      total: 2,
      offset: 1,
      limit: 1,
      nextOffset: null,
    });
  await expect(loadCatalog()).rejects.toThrow("saved products are kept");
});

it("loads remaining pages concurrently with a limit of four and keeps catalog order", async () => {
  let active = 0,
    maximum = 0;
  vi.mocked(searchCatalog).mockImplementation(async (filters) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    const offset = filters?.offset || 0;
    return {
      products: [{ code: String(offset), name: `Product ${offset}` }],
      total: 7,
      offset,
      limit: 1,
      nextOffset: offset < 6 ? offset + 1 : null,
    };
  });
  expect((await loadCatalog()).map((product) => product.code)).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
  ]);
  expect(maximum).toBe(4);
});
it("rejects a changing total so an incomplete index never replaces the saved catalog", async () => {
  vi.mocked(searchCatalog)
    .mockResolvedValueOnce({
      products: [{ code: "a", name: "A" }],
      total: 2,
      offset: 0,
      limit: 1,
      nextOffset: 1,
    })
    .mockResolvedValueOnce({
      products: [],
      total: 3,
      offset: 1,
      limit: 1,
      nextOffset: 2,
    });
  await expect(loadCatalog()).rejects.toThrow();
});

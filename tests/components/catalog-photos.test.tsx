import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCatalogPhotos } from "../../src/features/products/useCatalogPhotos";
import { catalogByCodes } from "../../src/features/products/products.api";
import type { Product } from "../../src/domain/models";
vi.mock("../../src/features/products/products.api", () => ({
  catalogByCodes: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("fetches just the selected code and allows retry after failure", async () => {
  const product = { code: "a", name: "A", image: "/api/assets/primary" };
  vi.mocked(catalogByCodes)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce([{ ...product, images: ["/api/assets/alternate"] }]);
  const view = renderHook(() => useCatalogPhotos(product));
  await waitFor(() => expect(view.result.current.error).toBe(true));
  expect(view.result.current.product).toBe(product);
  act(() => view.result.current.retry());
  await waitFor(() =>
    expect(view.result.current.product?.images).toEqual([
      "/api/assets/alternate",
    ]),
  );
  expect(catalogByCodes).toHaveBeenLastCalledWith(
    ["a"],
    expect.any(AbortSignal),
  );
});
it("aborts a closed editor and ignores late photos after switching products", async () => {
  let finish!: (products: Product[]) => void;
  vi.mocked(catalogByCodes)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce([
      { code: "b", name: "B", images: ["/api/assets/b"] },
    ]);
  const view = renderHook(({ product }) => useCatalogPhotos(product), {
    initialProps: { product: { code: "a", name: "A" } },
  });
  const firstSignal = vi.mocked(catalogByCodes).mock.calls[0]?.[1];
  view.rerender({ product: { code: "b", name: "B" } });
  await waitFor(() =>
    expect(view.result.current.product?.images).toEqual(["/api/assets/b"]),
  );
  await act(async () =>
    finish([{ code: "a", name: "A", images: ["/api/assets/a"] }]),
  );
  expect(firstSignal?.aborted).toBe(true);
  expect(view.result.current.product?.code).toBe("b");
  const lastSignal = vi.mocked(catalogByCodes).mock.calls[1]?.[1];
  view.unmount();
  expect(lastSignal?.aborted).toBe(true);
});
it("skips missing products and already available photo lists", () => {
  const view = renderHook(() => useCatalogPhotos());
  view.unmount();
  renderHook(() =>
    useCatalogPhotos({ code: "a", name: "A", images: ["/api/assets/a"] }),
  );
  expect(catalogByCodes).not.toHaveBeenCalled();
});

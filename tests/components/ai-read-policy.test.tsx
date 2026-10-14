import React, { StrictMode } from "react";
import { render, waitFor, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { AiReview } from "../../src/features/brochure/AiReview";
import { ProductImageEditor } from "../../src/features/brochure/ProductImageEditor";
import type { Campaign } from "../../src/domain/models";
vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: vi.fn() }));
import { requestAi } from "../../src/features/ai/ai.api";
const campaign: Campaign = {
  id: "read-only",
  name: "Campaign",
  products: [
    { code: "1", name: "Unchecked text", image: "/api/assets/original" },
  ],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("mounting, rerendering and reopening review modals never starts AI", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ configured: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const props = {
    campaign,
    onApply: vi.fn(),
    onDecline: vi.fn(),
    onClose: vi.fn(),
  };
  const mounted = render(
    <StrictMode>
      <AiReview {...props} />
    </StrictMode>,
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  mounted.rerender(
    <StrictMode>
      <AiReview {...props} campaign={{ ...campaign, name: "Updated" }} />
    </StrictMode>,
  );
  mounted.unmount();
  render(<AiReview {...props} />);
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
  expect(requestAi).not.toHaveBeenCalled();
  for (const [, options] of fetchMock.mock.calls)
    expect(options?.method ?? "GET").toBe("GET");
});
it("opening an already prepared product image editor uses the saved cutout without AI", () => {
  const product = {
    code: "1",
    name: "Prepared product",
    image: "/api/assets/saved-cutout",
    aiOriginalImage: "/api/assets/source",
  };
  const view = render(
    <StrictMode>
      <ProductImageEditor
        product={product}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    </StrictMode>,
  );
  expect(
    view.getByRole("img", { name: "Prepared product" }).getAttribute("src"),
  ).toBe(product.image);
  expect(requestAi).not.toHaveBeenCalled();
});

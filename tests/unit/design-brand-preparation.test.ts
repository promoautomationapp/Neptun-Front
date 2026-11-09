import { beforeEach, expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  remember: vi.fn(),
  load: vi.fn(),
}));
vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: mocks.request }));
vi.mock("../../src/features/brochure/brandLogos", () => ({
  loadPreparedBrandLogos: mocks.load,
  rememberPreparedBrandLogo: mocks.remember,
  brandLogoFor: (campaign: Campaign, brand: string) =>
    campaign.brandLogos?.[brand] ||
    (["SAMSUNG", "LG"].includes(brand) ? "/saved.png" : ""),
}));
import {
  prepareDesignBrands,
  missingDesignBrands,
} from "../../src/features/brochure/useDesignBrandPreparation";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({});
  mocks.request.mockResolvedValue({
    url: "/api/assets/11111111-1111-4111-8111-111111111111",
  });
});
function fixture(id: string): Campaign {
  return {
    id,
    name: id,
    products: [
      {
        code: "a",
        name: "A",
        brand: "NEW BRAND",
        images: ["https://catalog.example/brand.png?width=80"],
      },
    ],
  };
}
it("reuses known, custom and deliberately hidden brand logos without AI", async () => {
  const campaign: Campaign = {
    id: "known",
    name: "known",
    brandLogos: { HIDDEN: "", CUSTOM: "/custom.svg" },
    products: [
      { code: "1", name: "A", brand: "SAMSUNG" },
      { code: "2", name: "B", brand: "HIDDEN" },
      { code: "3", name: "C", brand: "CUSTOM" },
      { code: "4", name: "D", brand: "PHOTO", brandLogo: "/product-logo.png" },
    ],
  };
  expect(missingDesignBrands(campaign)).toEqual([]);
  expect(await prepareDesignBrands(campaign, (fn) => fn(campaign))).toEqual([]);
  expect(mocks.request).not.toHaveBeenCalled();
});
it("saves a missing sourced logo once and reuses it for another background", async () => {
  const campaign = fixture("reuse");
  const update = (fn: (draft: Campaign) => void) => fn(campaign);
  expect(await prepareDesignBrands(campaign, update)).toEqual([]);
  expect(mocks.request).toHaveBeenCalledOnce();
  expect(mocks.request).toHaveBeenCalledWith("ai-white-brand-logo", {
    brand: "NEW BRAND",
    image: "https://catalog.example/brand.png?width=80",
  });
  expect(campaign.brandPreparation?.["NEW BRAND"]?.status).toBe("ready");
  await prepareDesignBrands(campaign, update);
  expect(mocks.request).toHaveBeenCalledOnce();
});
it("retains failed or interrupted preparation for fourteen days and never invents an unsourced logo", async () => {
  const campaign = fixture("failed");
  mocks.request.mockRejectedValueOnce(new Error("Failed"));
  const now = Date.parse("2026-11-09T12:00:00Z");
  expect(
    await prepareDesignBrands(
      campaign,
      (fn) => fn(campaign),
      () => {},
      now,
    ),
  ).toEqual(["NEW BRAND"]);
  const reopened = structuredClone(campaign);
  await prepareDesignBrands(
    reopened,
    (fn) => fn(reopened),
    () => {},
    now + 86400000,
  );
  expect(mocks.request).toHaveBeenCalledOnce();
  reopened.id = "interrupted";
  reopened.brandPreparation!["NEW BRAND"]!.status = "pending";
  await prepareDesignBrands(
    reopened,
    (fn) => fn(reopened),
    () => {},
    now + 86400000,
  );
  expect(mocks.request).toHaveBeenCalledOnce();
  const unsourced = {
    ...fixture("unsourced"),
    products: [{ code: "a", name: "A", brand: "NO SOURCE" }],
  };
  expect(await prepareDesignBrands(unsourced, (fn) => fn(unsourced))).toEqual([
    "NO SOURCE",
  ]);
  expect(mocks.request).toHaveBeenCalledOnce();
});
it("deduplicates simultaneous preparation and recovers a previously saved receipt", async () => {
  const campaign = fixture("dedupe");
  let finish!: (value: { url: string }) => void;
  mocks.request.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const update = (fn: (draft: Campaign) => void) => fn(campaign);
  const first = prepareDesignBrands(structuredClone(campaign), update);
  const second = prepareDesignBrands(structuredClone(campaign), update);
  await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
  finish({ url: "/saved-brand.png" });
  await Promise.all([first, second]);
  const reopened: Campaign = { ...structuredClone(campaign), brandLogos: {} };
  await prepareDesignBrands(reopened, (fn) => fn(reopened));
  expect(reopened.brandLogos?.["NEW BRAND"]).toBe("/saved-brand.png");
  expect(mocks.request).toHaveBeenCalledOnce();
});

import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  applyCoverProductPlacement,
  repairCoverProductLayout,
} from "../../src/features/brochure/coverElements";
import {
  coverProducts,
  splitPages,
} from "../../src/features/brochure/campaignPages";

const campaign = (positioned = false): Campaign => ({
  id: "cover-reflow",
  name: "Cover reflow",
  products: [
    { code: "tv", name: "TV", ...(positioned ? { brochurePage: 1 } : {}) },
    {
      code: "phone",
      name: "Phone",
      ...(positioned ? { brochurePage: 1 } : {}),
    },
    ...(positioned ? [{ code: "other", name: "Other", brochurePage: 2 }] : []),
  ],
  coverProductCodes: ["tv", "phone"],
  layout: "classic8",
});

it.each([false, true])(
  "reflows a resized cover without changing selected page membership (positioned=%s)",
  (positioned) => {
    const value = campaign(positioned);
    applyCoverProductPlacement(value, "product-tv", {
      x: 4,
      y: 8,
      width: 74,
      height: 78,
    });
    expect(coverProducts(value).map((product) => product.code)).toEqual([
      "tv",
      "phone",
    ]);
    expect(
      splitPages(value).flatMap((page) =>
        page.products.map((product) => product.code),
      ),
    ).toEqual(positioned ? ["other"] : []);
    expect(value.coverElementPlacements?.["product-phone"]).toBeTruthy();
  },
);

it("moves a neighbor to the next clear cover row when it fits", () => {
  const value = campaign();
  value.showCoverBand = false;
  value.coverElementPlacements = {
    "product-tv": { x: 4, y: 20, width: 44, height: 20 },
    "product-phone": { x: 52, y: 20, width: 30, height: 20 },
  };
  applyCoverProductPlacement(value, "product-tv", {
    x: 4,
    y: 20,
    width: 70,
    height: 20,
  });
  expect(coverProducts(value).map((product) => product.code)).toEqual([
    "tv",
    "phone",
  ]);
  expect(value.coverElementPlacements["product-phone"]).toEqual({
    x: 4,
    y: 42,
    width: 30,
    height: 20,
  });
});

it("keeps a full product page intact while retaining every cover offer", () => {
  const value = campaign(true);
  value.layout = "grid4";
  value.products = [
    ...value.products.slice(0, 2),
    ...Array.from({ length: 4 }, (_, index) => ({
      code: `p${index}`,
      name: `Product ${index}`,
      brochurePage: 2,
    })),
  ];
  applyCoverProductPlacement(value, "product-tv", {
    x: 4,
    y: 8,
    width: 74,
    height: 78,
  });
  expect(value.products[1]?.brochurePage).toBe(1);
  expect(
    splitPages(value).map((page) =>
      page.products.map((product) => product.code),
    ),
  ).toEqual([["p0", "p1", "p2", "p3"]]);
});

it("repairs legacy overlapping covers while keeping all offers on page one", () => {
  const saved = campaign(true);
  saved.showCoverBand = true;
  saved.coverElementPlacements = {
    "product-tv": { x: 4, y: 48, width: 74.52, height: 45.26 },
    "product-phone": { x: 51.48, y: 48.5, width: 44, height: 40 },
  };
  const repaired = repairCoverProductLayout(saved);
  expect(repaired).not.toBe(saved);
  expect(saved.products[1]?.brochurePage).toBe(1);
  expect(coverProducts(repaired).map((product) => product.code)).toEqual([
    "tv",
    "phone",
  ]);
  expect(
    splitPages(repaired)[0]?.products.map((product) => product.code),
  ).not.toContain("phone");
  expect(repaired.coverElementPlacements?.["product-tv"]).toMatchObject({
    y: 54,
    height: 36,
  });
});

it("keeps a valid custom cover arrangement unchanged", () => {
  const saved = campaign();
  saved.coverElementPlacements = {
    "product-tv": { x: 4, y: 55, width: 44, height: 30 },
    "product-phone": { x: 52, y: 55, width: 44, height: 30 },
  };
  expect(repairCoverProductLayout(saved)).toBe(saved);
});

it.each([false, true])(
  "keeps a third explicitly selected offer on the cover when the band is visible (positioned=%s)",
  (positioned) => {
    const saved = campaign(positioned);
    saved.showCoverBand = true;
    saved.products.splice(2, 0, {
      code: "third",
      name: "Third",
      ...(positioned ? { brochurePage: 1 } : {}),
    });
    saved.coverProductCodes = ["tv", "phone", "third"];
    expect(coverProducts(saved).map((product) => product.code)).toEqual([
      "tv",
      "phone",
      "third",
    ]);
    expect(
      splitPages(saved).flatMap((page) =>
        page.products.map((product) => product.code),
      ),
    ).not.toContain("third");
  },
);

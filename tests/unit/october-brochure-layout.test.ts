import { describe, expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import {
  layoutGrid,
  pageCategoryLabel,
  productPageChunk,
} from "../../src/features/brochure/brochureLayout";
import {
  applyProductPageLayout,
  coverProducts,
  materializeProductPages,
  reviewCommentsForLayout,
  splitPages,
} from "../../src/features/brochure/campaignPages";
import {
  appleProductFamily,
  isBrochureAccessory,
} from "../../src/features/brochure/productTypes";

const product = (code: string, extra: Partial<Product> = {}): Product => ({
  code,
  name: `Offer ${code}`,
  ...extra,
});
const mac = (code: string) =>
  product(code, {
    name: `MacBook Air ${code}`,
    brand: "Apple",
    category: "Laptops",
  });
const iphone = (code: string) =>
  product(code, {
    name: `iPhone ${code}`,
    brand: "Apple",
    category: "Smartphone",
  });
const ipad = (code: string) =>
  product(code, {
    name: `iPad Air ${code}`,
    brand: "Apple",
    category: "Tablets",
  });
const accessory = (code: string) =>
  product(code, {
    name: `Gaming mouse ${code}`,
    brand: "Logitech",
    category: "Gaming",
    subcategory: "Gaming accessories",
  });
const tv = (code: string) =>
  product(code, {
    name: `TV LED ${code}`,
    brand: "LG",
    category: "Televizorë",
  });
const brochure = (
  products: Product[],
  extra: Partial<Campaign> = {},
): Campaign => ({
  id: "october",
  name: "October",
  brochurePresetId: "neptun-october",
  brochureVisualStyle: "october",
  autoProductLayout: true,
  layout: "duo4",
  showCoverBand: true,
  products: [product("cover-1"), product("cover-2"), ...products],
  ...extra,
});
const pageCodes = (campaign: Campaign) =>
  splitPages(campaign).flatMap((page) =>
    page.products.map((item) => item.code),
  );

describe("October brochure automatic layouts", () => {
  it("keeps the two-offer cover when its campaign band is hidden", () => {
    const offers = [tv("one"), tv("two"), tv("three")];
    const value = brochure(offers, { showCoverBand: false });
    expect(coverProducts(value).map((item) => item.code)).toEqual([
      "cover-1",
      "cover-2",
    ]);
    expect(pageCodes(value)).toEqual(offers.map((item) => item.code));
    value.products.forEach((item, index) => {
      item.brochurePage = index < 3 ? 1 : 2;
    });
    expect(coverProducts(value).map((item) => item.code)).toEqual([
      "cover-1",
      "cover-2",
    ]);
    expect(pageCodes(value)).toEqual(offers.map((item) => item.code));
  });
  it("uses four larger TV offers per page, while the reference preset keeps its eight-TV grid", () => {
    const offers = Array.from({ length: 9 }, (_, i) => tv(String(i)));
    expect(
      splitPages(brochure(offers)).map((page) => [
        page.layout,
        page.products.length,
      ]),
    ).toEqual([
      ["duo4", 4],
      ["duo4", 4],
      ["duo4", 1],
    ]);
    expect(
      productPageChunk(
        { layout: "feature3", autoProductLayout: true },
        offers,
        0,
      ),
    ).toMatchObject({ layout: "tv8", products: offers.slice(0, 8) });
  });

  it.each([2, 4])("keeps %i MacBooks together on their own page", (count) => {
    const offers = Array.from({ length: count }, (_, i) => mac(`m${i}`));
    const value = brochure([tv("before"), ...offers, tv("after")]);
    const pages = splitPages(value);
    expect(
      pages.map((page) => [
        page.layout,
        page.products.map((item) => item.code),
      ]),
    ).toEqual([
      ["duo4", ["before"]],
      [count === 2 ? "pair2" : "duo4", offers.map((item) => item.code)],
      ["duo4", ["after"]],
    ]);
    expect(layoutGrid(pages[1]!.layout)).toEqual({
      columns: count === 2 ? 1 : 2,
      rows: 2,
    });
  });

  it("preserves every offer when more than four MacBooks need overflow pages", () => {
    const offers = Array.from({ length: 6 }, (_, i) => mac(`m${i}`));
    const value = brochure(offers);
    expect(
      splitPages(value).map((page) => [page.layout, page.products.length]),
    ).toEqual([
      ["duo4", 4],
      ["pair2", 2],
    ]);
    expect(pageCodes(value)).toEqual(offers.map((item) => item.code));
  });

  it("isolates Apple device families and uses six slots for accessories without losing product order", () => {
    const offers = [
      tv("tv"),
      ...Array.from({ length: 5 }, (_, i) => iphone(`phone${i}`)),
      ipad("pad1"),
      ipad("pad2"),
      mac("mac"),
      ...Array.from({ length: 7 }, (_, i) => accessory(`acc${i}`)),
      product("washer", { category: "Appliances" }),
    ];
    const value = brochure(offers);
    expect(
      splitPages(value).map((page) => [page.layout, page.products.length]),
    ).toEqual([
      ["duo4", 1],
      ["duo4", 4],
      ["duo4", 1],
      ["pair2", 2],
      ["pair2", 1],
      ["grid6portrait", 6],
      ["grid6portrait", 1],
      ["duo4", 1],
    ]);
    expect(pageCodes(value)).toEqual(offers.map((item) => item.code));
    expect(
      new Set(
        [
          ...coverProducts(value),
          ...splitPages(value).flatMap((page) => page.products),
        ].map((item) => item.code),
      ).size,
    ).toBe(value.products.length);
  });

  it("retains October grouping when a built-in preset is customized or copied", () => {
    const value = brochure([mac("one"), mac("two"), tv("tv")], {
      brochurePresetId: "custom-team-preset",
    });
    expect(splitPages(value).map((page) => page.layout)).toEqual([
      "pair2",
      "duo4",
    ]);
  });

  it("honors a manually selected layout and intentionally mixed page membership", () => {
    const value = brochure([iphone("phone"), tv("tv"), accessory("mouse")], {
      pages: { 0: { layout: "grid6portrait", backgroundColor: "#123456" } },
    });
    expect(splitPages(value)).toHaveLength(1);
    expect(splitPages(value)[0]).toMatchObject({
      layout: "grid6portrait",
      backgroundColor: "#123456",
    });
    expect(pageCodes(value)).toEqual(["phone", "tv", "mouse"]);
    expect(applyProductPageLayout(value, 0, "pair2")).toBe(true);
    expect(splitPages(value).map((page) => page.products.length)).toEqual([
      2, 1,
    ]);
    expect(pageCodes(value)).toEqual(["phone", "tv", "mouse"]);
  });

  it("keeps source-page designs, artwork and comments attached after automatic overflow and materialization", () => {
    const offers = [
      ...Array.from({ length: 5 }, (_, i) => ({
        ...mac(`m${i}`),
        brochurePage: 2,
      })),
      { ...tv("tv"), brochurePage: 3 },
    ];
    const value = brochure(offers, {
      pages: {
        0: { backgroundColor: "#112233", categoryTitle: "MacBooks" },
        1: { layout: "grid6portrait", backgroundColor: "#aabbcc" },
        8: { backgroundColor: "#778899" },
      },
      pageArtworks: {
        "product-0": [{ id: "mac-label", x: 10, y: 10, width: 30 }],
        "product-1": [{ id: "tv-label", x: 10, y: 10, width: 30 }],
      },
      reviewComments: [{ id: "tv-comment", pageIndex: 2, text: "TV note" }],
    });
    value.products.slice(0, 2).forEach((item) => {
      item.brochurePage = 1;
    });
    const original = structuredClone(value);
    expect(
      splitPages(value).map((page) => [page.layout, page.backgroundColor]),
    ).toEqual([
      ["duo4", "#112233"],
      ["pair2", "#112233"],
      ["grid6portrait", "#aabbcc"],
    ]);
    expect(value).toEqual(original);
    materializeProductPages(value);
    expect(value.pages?.[0]?.categoryTitle).toBe("MacBooks");
    expect(value.pages?.[1]?.categoryTitle).toBe("MacBooks");
    expect(value.pages?.[2]?.backgroundColor).toBe("#aabbcc");
    expect(value.pages?.[9]?.backgroundColor).toBe("#778899");
    expect(value.pageArtworks?.["product-2"]?.[0]?.id).toBe("tv-label");
    expect(reviewCommentsForLayout(value)[0]?.pageIndex).toBe(3);
    expect(pageCodes(value)).toEqual(offers.map((item) => item.code));
    expect(splitPages(value).map((page) => page.backgroundColor)).toEqual([
      "#112233",
      "#112233",
      "#aabbcc",
    ]);
  });
});

describe("October page category ribbons", () => {
  it("uses the shared normalized subcategory, then shared category, otherwise a blank ribbon", () => {
    expect(
      pageCategoryLabel([
        product("one", { category: "Elektronikë", subcategory: "Televizorë" }),
        product("two", { category: "Other", subcategory: "  televizore  " }),
      ]),
    ).toBe("Televizorë");
    expect(
      pageCategoryLabel([
        product("one", { category: "Elektronikë", subcategory: "TV" }),
        product("two", { category: "elektronike", subcategory: "Audio" }),
      ]),
    ).toBe("Elektronikë");
    expect(
      pageCategoryLabel([
        product("one", { category: "Audio" }),
        product("two", { category: "Appliances" }),
      ]),
    ).toBe("");
    expect(
      pageCategoryLabel([
        product("one"),
        product("two", { category: "Audio" }),
      ]),
    ).toBe("");
    expect(pageCategoryLabel([])).toBe("");
  });
  it("reads a leaf label from imported category paths", () => {
    expect(
      pageCategoryLabel([
        product("one", { categoryPath: "Home > Electronics > Televizorë" }),
        product("two", { categoryPath: "Electronics › televizore" }),
      ]),
    ).toBe("Televizorë");
  });
});

it("identifies compatible accessories without classifying their device names or brands as Apple devices", () => {
  for (const item of [
    { name: "MacBook charger", brand: "Apple", category: "Accessories" },
    { name: "iPhone charger", brand: "Belkin", category: "Accessories" },
    {
      name: "Gaming keyboard",
      brand: "Apple compatible",
      subcategory: "Accessories",
    },
  ]) {
    expect(isBrochureAccessory(item)).toBe(true);
    expect(["macbook", "iphone", "ipad"]).not.toContain(
      appleProductFamily(item),
    );
  }
  expect(
    isBrochureAccessory({
      name: "Gaming laptop",
      brand: "Logitech",
      subcategory: "Laptops",
    }),
  ).toBe(false);
  expect(
    isBrochureAccessory({
      name: "Tablet",
      category: "Devices and accessories",
      subcategory: "Tabletë",
    }),
  ).toBe(false);
});

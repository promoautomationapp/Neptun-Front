import { describe, expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { isMacBook } from "../../src/features/brochure/productTypes";
import { layoutGrid } from "../../src/features/brochure/brochureLayout";
import {
  applyProductPageLayout,
  coverProducts,
  materializeProductPages,
  splitPages,
  reviewCommentsForLayout,
} from "../../src/features/brochure/campaignPages";
import {
  createCampaignEditHistory,
  restoreCampaignEdit,
} from "../../src/features/brochure/campaignEditHistory";
import { placeProductOnPage } from "../../src/features/brochure/productPlacement";

const regular = (code: string): Product => ({
  code,
  name: `TV ${code}`,
  brand: "LG",
});
const mac = (code: string): Product => ({
  code,
  name: `APPLE MACBOOK AIR ${code}`,
  brand: "Apple",
  subcategory: "Laptop",
});
const brochure = (
  products: Product[],
  extra: Partial<Campaign> = {},
): Campaign => ({
  id: "layout",
  name: "Layouts",
  products: [
    regular("cover-1"),
    regular("cover-2"),
    regular("cover-3"),
    ...products,
  ],
  layout: "grid6",
  autoProductLayout: true,
  showCoverBand: false,
  ...extra,
});
const codes = (value: Campaign) =>
  splitPages(value).flatMap((page) => page.products.map((item) => item.code));

describe("automatic MacBook grids", () => {
  it("uses a 2 × 3 default and advances products after a card is enlarged", () => {
    const products = Array.from({ length: 8 }, (_, index) => ({
      ...regular(`tv${index}`),
      brochurePage: index < 6 ? 2 : 3,
      ...(index === 0 ? { brochureCardSize: { width: 2, height: 2 } } : {}),
    }));
    const value = brochure(products, {
      layout: "grid6portrait",
      autoProductLayout: false,
    });
    value.products.slice(0, 3).forEach((product) => {
      product.brochurePage = 1;
    });
    expect(layoutGrid(value.layout!)).toEqual({ columns: 2, rows: 3 });
    expect(
      splitPages(value).flatMap((page) =>
        page.products.map((item) => item.code),
      ),
    ).toEqual(products.map((item) => item.code));
    expect(splitPages(value).map((page) => page.products.length)).toEqual([
      3, 3, 2,
    ]);
  });
  it("recognizes devices without treating compatible accessories or other laptop brands as MacBooks", () => {
    expect(isMacBook(mac("M4"))).toBe(true);
    expect(isMacBook({ name: "MacBook Pro 14 inch" })).toBe(true);
    expect(
      isMacBook({ name: "Laptop", brand: "Apple", subcategory: "MacBooks" }),
    ).toBe(true);
    for (const item of [
      { name: "MacBook charger", brand: "Apple" },
      { name: "Cover MacBook Air" },
      { name: "MacBook sleeve", brand: "Belkin" },
      { name: "MacBook", subcategory: "Aksesorë" },
      { name: "Laptop", brand: "HP" },
    ])
      expect(isMacBook(item)).toBe(false);
  });

  it("automatically gives MacBooks two columns and paginates every offer without putting cover products in the group", () => {
    const value = brochure(
      Array.from({ length: 9 }, (_, index) => mac(`m${index}`)),
    );
    const before = structuredClone(value);
    const pages = splitPages(value);
    expect(pages.map((page) => [page.layout, page.products.length])).toEqual([
      ["duo4", 4],
      ["duo4", 4],
      ["duo4", 1],
    ]);
    expect(layoutGrid(pages[0]!.layout)).toEqual({ columns: 2, rows: 2 });
    expect(codes(value)).toEqual(
      value.products.slice(3).map((item) => item.code),
    );
    expect(coverProducts(value)).toEqual(value.products.slice(0, 3));
    expect(value).toEqual(before);
  });

  it("keeps mixed groups in their original order and never loses or duplicates an offer", () => {
    const products = [
      regular("tv1"),
      regular("tv2"),
      ...Array.from({ length: 5 }, (_, index) => mac(`m${index}`)),
      regular("washer"),
      mac("last"),
    ];
    const value = brochure(products);
    expect(
      splitPages(value).map((page) => [page.layout, page.products.length]),
    ).toEqual([
      ["grid6", 2],
      ["duo4", 4],
      ["duo4", 1],
      ["grid6", 1],
      ["duo4", 1],
    ]);
    expect(codes(value)).toEqual(products.map((item) => item.code));
    expect(new Set(codes(value)).size).toBe(products.length);
  });

  it("preserves existing saved campaign and page layout selections", () => {
    const existing = brochure(
      Array.from({ length: 7 }, (_, index) => mac(`m${index}`)),
      { autoProductLayout: undefined, layout: "classic8" },
    );
    expect(splitPages(existing).map((page) => page.layout)).toEqual([
      "classic8",
    ]);
    const manual = brochure(
      Array.from({ length: 7 }, (_, index) => mac(`m${index}`)),
      { pages: { 0: { layout: "grid6", backgroundColor: "#123456" } } },
    );
    expect(
      splitPages(manual).map((page) => [page.layout, page.products.length]),
    ).toEqual([
      ["grid6", 6],
      ["duo4", 1],
    ]);
    expect(splitPages(manual)[0]?.backgroundColor).toBe("#123456");
    expect(manual.pages?.[0]?.layout).toBe("grid6");
  });

  it("uses a manually chosen two-per-row grid for any product group, including resized blocks", () => {
    const value = brochure(
      [
        regular("wide"),
        regular("two"),
        regular("three"),
        regular("four"),
        regular("five"),
      ],
      { autoProductLayout: false, layout: "duo4" },
    );
    value.products[3]!.brochureCardSize = { width: 2, height: 1 };
    expect(splitPages(value).map((page) => page.products.length)).toEqual([
      3, 2,
    ]);
    expect(codes(value)).toEqual(
      value.products.slice(3).map((item) => item.code),
    );
  });

  it("splits a new imported MacBook page and materializes stable page membership only after editing", () => {
    const value = brochure(
      Array.from({ length: 7 }, (_, index) => ({
        ...mac(`m${index}`),
        brochurePage: 2,
        brochureOrder: index + 1,
      })),
    );
    value.products.slice(0, 3).forEach((item) => {
      item.brochurePage = 1;
    });
    expect(splitPages(value).map((page) => page.products.length)).toEqual([
      4, 3,
    ]);
    materializeProductPages(value);
    expect(value.products.slice(3).map((item) => item.brochurePage)).toEqual([
      2, 2, 2, 2, 3, 3, 3,
    ]);
    expect(codes(value)).toEqual(
      value.products.slice(3).map((item) => item.code),
    );
    const legacy = structuredClone(value);
    delete legacy.autoProductLayout;
    legacy.products.slice(3).forEach((item) => {
      item.brochurePage = 2;
    });
    expect(splitPages(legacy)).toHaveLength(1);
  });

  it("reflows only the selected group and shifts the next page's background and artwork together", () => {
    const value = brochure(
      Array.from({ length: 9 }, (_, index) => regular(`p${index}`)),
      {
        autoProductLayout: undefined,
        pages: {
          0: { layout: "grid6", backgroundColor: "#123456" },
          1: { layout: "duo4", backgroundColor: "#abcdef" },
        },
        pageArtworks: {
          "product-0": [{ id: "first", x: 1, y: 2, width: 20 }],
          "product-1": [{ id: "second", x: 3, y: 4, width: 15 }],
          cover: [{ id: "cover", x: 0, y: 0, width: 40 }],
        },
      },
    );
    const before = codes(value);
    expect(applyProductPageLayout(value, 0, "duo4")).toBe(true);
    const pages = splitPages(value);
    expect(pages.map((page) => [page.layout, page.products.length])).toEqual([
      ["duo4", 4],
      ["duo4", 2],
      ["duo4", 3],
    ]);
    expect(pages[2]?.backgroundColor).toBe("#abcdef");
    expect(value.pageArtworks?.["product-2"]?.[0]?.id).toBe("second");
    expect(value.pageArtworks?.["product-1"]).toBeUndefined();
    expect(value.pageArtworks?.cover?.[0]?.id).toBe("cover");
    expect(codes(value)).toEqual(before);
  });

  it("moves an offer to an automatically grouped page using its actual capacity", () => {
    const value = brochure([
      ...Array.from({ length: 5 }, (_, index) => mac(`m${index}`)),
      regular("last"),
    ]);
    expect(
      placeProductOnPage(value, "m4", 0, ["cover-1", "cover-2", "cover-3"]),
    ).toBe(true);
    expect(splitPages(value)[0]?.products.map((item) => item.code)).toEqual([
      "m4",
      "m0",
      "m1",
      "m2",
    ]);
    expect(new Set(codes(value)).size).toBe(6);
  });

  it("preserves sparse saved backgrounds and comment anchors through reflow, serialization and undo", () => {
    const initial = brochure(
      Array.from({ length: 9 }, (_, index) => regular(`p${index}`)),
      {
        version: 7,
        autoProductLayout: undefined,
        pages: {
          0: { layout: "grid6" },
          1: { layout: "duo4", backgroundImage: "/saved-background.jpg" },
          8: { layout: "grid9", backgroundColor: "#667788" },
        },
        reviewComments: [
          { id: "cover", pageIndex: 0, text: "Keep cover" },
          { id: "chosen", pageIndex: 1, text: "Keep selected page" },
          {
            id: "next",
            pageIndex: 2,
            text: "Keep next background",
            position: { x: 42, y: 61 },
          },
          { id: "stores", pageIndex: 3, text: "Keep stores" },
        ],
      },
    );
    const changed = structuredClone(initial);
    const history = createCampaignEditHistory();
    expect(applyProductPageLayout(changed, 0, "duo4")).toBe(true);
    expect(changed.pages?.[9]).toEqual(initial.pages?.[8]);
    expect(changed.reviewComments).toEqual(initial.reviewComments);
    expect(changed.reviewPagePlacements).toEqual({ next: 3, stores: 4 });
    const reloaded = JSON.parse(JSON.stringify(changed)) as Campaign;
    expect(
      reviewCommentsForLayout(reloaded).map((item) => [
        item.id,
        item.pageIndex,
      ]),
    ).toEqual([
      ["cover", 0],
      ["chosen", 1],
      ["next", 3],
      ["stores", 4],
    ]);
    expect(history.record(initial, changed)).toBe(true);
    const snapshot = history.undo(changed);
    if (!snapshot) throw new Error("Reflow undo missing");
    const restored = restoreCampaignEdit(snapshot, { ...changed, version: 8 });
    expect(restored.pages).toEqual(initial.pages);
    expect(restored.reviewComments).toEqual(initial.reviewComments);
    expect(restored.reviewPagePlacements).toBeUndefined();
    expect(restored.version).toBe(8);
    expect(
      reviewCommentsForLayout(restored).map((item) => item.pageIndex),
    ).toEqual([0, 1, 2, 3]);
  });
});

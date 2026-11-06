import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { restoreExcelPageAssignments } from "../../src/features/brochure/excelPageAssignments";
import { splitPages } from "../../src/features/brochure/campaignPages";
import { cardSize } from "../../src/features/brochure/brochureLayout";

const item = (code: string, name: string, page = 2, order = 1): Product => ({
  code,
  name,
  brochurePage: page,
  brochureOrder: order,
  regular: 99,
  sale: 69,
});

it("keeps four assigned earbud/watch offers on one page across device families", () => {
  const offers = [
    item("buds", "KUFJE SAMSUNG BUDS 3 FE", 2, 1),
    item("watch", "SMARTWATCH SAMSUNG WATCH 9", 2, 2),
    item("freeclip", "KUFJE HUAWEI FREECLIP 2", 2, 3),
    item("garmin", "SMARTWATCH GARMIN FENIX 8", 2, 4),
  ];
  for (const style of ["current", "october"] as const) {
    const campaign: Campaign = {
      id: style,
      name: style,
      layout: "feature3",
      brochureVisualStyle: style,
      autoProductLayout: true,
      products: offers,
    };
    expect(
      splitPages(campaign).map((page) =>
        page.products.map((product) => product.code),
      ),
    ).toEqual([["buds", "watch", "freeclip", "garmin"]]);
  }
});

it("uses stacked rows for two assigned offers and a featured top row for three", () => {
  const campaign: Campaign = {
    id: "rows",
    name: "Rows",
    layout: "feature3",
    autoProductLayout: true,
    products: [
      item("ipad1", "IPAD APPLE A16"),
      item("ipad2", "IPAD APPLE PRO", 2, 2),
    ],
  };
  expect(splitPages(campaign)[0]!.layout).toBe("pair2");
  campaign.products.push(item("third", "Third offer", 2, 3));
  const page = splitPages(campaign)[0]!;
  expect(page.layout).toBe("feature3");
  expect(
    page.products.map(
      (product, index) => cardSize(product, page.layout, index).width,
    ),
  ).toEqual([2, 1, 1]);
});

it("restores old automatic splits from Excel only on explicit request, preserving images and prices", () => {
  const products = [1, 2, 3, 4].map((order) => ({
    ...item(`offer${order}`, `Offer ${order}`, 9 + order, 1),
    image: `/saved-${order}.png`,
    brochureCardSize: { width: 1, height: 1 },
    excelSource: {
      row: 76 + order,
      cells: { "Brochure Position": `10.${order}` },
    },
  }));
  const campaign: Campaign = {
    id: "legacy",
    name: "Legacy",
    products,
    autoProductLayout: true,
    pages: { 8: { layout: "pair2", backgroundColor: "#123456" } },
  };
  expect(campaign.products.map((product) => product.brochurePage)).toEqual([
    10, 11, 12, 13,
  ]);
  expect(restoreExcelPageAssignments(campaign)).toBe(true);
  expect(
    campaign.products.map((product) => [
      product.brochurePage,
      product.brochureOrder,
    ]),
  ).toEqual([
    [10, 1],
    [10, 2],
    [10, 3],
    [10, 4],
  ]);
  expect(
    splitPages(campaign)
      .filter((page) => page.products.length)
      .map((page) => page.products.length),
  ).toEqual([4]);
  expect(
    campaign.products.map((product) => [
      product.image,
      product.regular,
      product.sale,
    ]),
  ).toEqual(products.map((product) => [product.image, 99, 69]));
  expect(campaign.pages?.[8]?.backgroundColor).toBe("#123456");
});

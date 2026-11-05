import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { missingImageTargets } from "../../src/features/ai/missing-product-images";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";
import { mergeBrochureImportProducts } from "../../src/features/brochure/brochureReimport";
import {
  productImagePreparationTargets,
  retainPreparedProductPhoto,
} from "../../src/features/brochure/productImagePreparationQueue";

const headers = [
  "Code",
  "Product name",
  "Sale price",
  "Regular price",
  "Brochure position",
  "Brand",
];
const columns = { ...inferBrochureColumns(headers), codeCol: 0, priceCol: 2 };
const analyze = (rows: unknown[][]) =>
  analyzeBrochureRows(rows, columns, []).products;
const photo = {
  image: "/verified-cutout.png",
  aiOriginalImage: "/found-original.png",
  aiCutoutValidated: true,
  aiCutoutValidationVersion: 1,
  aiPreparationRevision: 3,
  aiCutoutProvider: "openai",
  aiBackgroundSignature: "bg-v1:original",
};
const campaign = (products: Product[]): Campaign => ({
  id: "reimport",
  name: "Reimport",
  products,
});

it("keeps a validated searched photo when the same Excel-only row supplies no photo on reimport", () => {
  const rows = [["MISSING", "Exact model ZX2 GREEN", 79, 99, "1.1", "Brand"]];
  const first = analyze(rows)[0]!;
  const previous = [{ ...first, ...photo }];
  const incoming = analyze(rows);
  const before = structuredClone({ previous, incoming });
  const products = mergeBrochureImportProducts(previous, incoming);
  expect(products).toHaveLength(1);
  expect(products[0]).toMatchObject({
    ...photo,
    name: "Exact model ZX2 GREEN",
    catalogMissing: true,
  });
  expect(missingImageTargets(products)).toEqual([]);
  expect(productImagePreparationTargets(campaign(products))).toEqual([]);
  expect({ previous, incoming }).toEqual(before);
});

it("reuses the representative photo of an Excel-only color offer while retaining every SKU", () => {
  const rows = [
    ["PHONE-GREEN", "A37 5G 6/128 GREEN", 299, 449, "1.1", "SAMSUNG"],
    ["PHONE-GREY", "A37 5G 6/128 GREY", 299, 449, "1.1", "SAMSUNG"],
  ];
  const previous = analyze(rows).map((product) => ({ ...product, ...photo }));
  const products = mergeBrochureImportProducts(previous, analyze(rows));
  expect(products[0]).toMatchObject({
    ...photo,
    code: "PHONE-GREEN",
    name: "A37 5G 6/128",
  });
  expect(products[0]?.brochureVariants?.map((variant) => variant.code)).toEqual(
    ["PHONE-GREEN", "PHONE-GREY"],
  );
  expect(missingImageTargets(products)).toEqual([]);
  expect(productImagePreparationTargets(campaign(products))).toEqual([]);
});

it("retains each missing-catalog member's finished photo inside an unchanged shared offer", () => {
  const rows = [
    ["TV", "BEKO TV 55MODEL", 599, 549, "1.1", "BEKO"],
    ["PHONE", "A37 5G 6/128 GREEN", 599, 449, "1.1", "SAMSUNG"],
  ];
  const previous = analyze(rows);
  previous[0]!.bundleProducts = previous[0]!.bundleProducts!.map((member) => ({
    ...member,
    ...photo,
    image: `/${member.code}-prepared.png`,
    aiOriginalImage: `/${member.code}-source.png`,
  }));
  previous[0]!.image = "/TV-prepared.png";
  const products = mergeBrochureImportProducts(previous, analyze(rows));
  expect(products[0]?.bundleProducts?.map((member) => member.image)).toEqual([
    "/TV-prepared.png",
    "/PHONE-prepared.png",
  ]);
  expect(missingImageTargets(products)).toEqual([]);
  expect(productImagePreparationTargets(campaign(products))).toEqual([]);
});

const previous: Product = {
  code: "MISSING",
  name: "Exact model ZX2 GREEN",
  brand: "Brand",
  source: "import",
  catalogMissing: true,
  specs: { Model: "ZX2", Color: "GREEN" },
  ...photo,
};
const raw: Product = {
  code: previous.code,
  name: previous.name,
  brand: previous.brand,
  source: "import",
  catalogMissing: true,
  specs: previous.specs,
};

it.each([
  ["SKU", { code: "OTHER" }],
  ["model name", { name: "Exact model ZX3 GREEN" }],
  ["finish", { name: "Exact model ZX2 RED" }],
  ["brand", { brand: "Different brand" }],
  ["model fact", { specs: { Model: "ZX3", Color: "GREEN" } }],
  ["color fact", { specs: { Model: "ZX2", Color: "RED" } }],
  ["composition", { bundleProducts: [{ code: "OTHER", name: "Other model" }] }],
] satisfies Array<[string, Partial<Product>]>)(
  "does not reuse an absent incoming photo when the %s changed",
  (_reason, changes) => {
    const result = retainPreparedProductPhoto(previous, { ...raw, ...changes });
    expect(result.image).toBe("");
    expect(result.aiOriginalImage).toBeUndefined();
    expect(result.aiCutoutValidated).toBeUndefined();
  },
);

it("does not pass an unverified or explicitly rejected old output off as prepared", () => {
  for (const invalid of [
    { ...previous, aiCutoutValidated: false },
    { ...previous, aiCutoutValidationVersion: 0 },
    { ...previous, aiOriginalImage: "" },
  ]) {
    const products = mergeBrochureImportProducts([invalid], [raw]);
    expect(products[0]?.image).toBe("");
    expect(products[0]?.aiCutoutValidated).toBeUndefined();
    expect(missingImageTargets(products)).toHaveLength(1);
  }
  const rejected = retainPreparedProductPhoto(previous, {
    ...raw,
    aiCutoutValidated: false,
  });
  expect(rejected.image).toBe("");
  expect(rejected.aiCutoutValidated).toBe(false);
});

it("checks the original representative finish even when a color offer's display name is unchanged", () => {
  const prior = {
    ...previous,
    name: "Exact model ZX2",
    brochureVariants: [{ code: previous.code, name: previous.name }],
  };
  const incoming = {
    ...raw,
    name: "Exact model ZX2",
    brochureVariants: [{ code: raw.code, name: "Exact model ZX2 RED" }],
  };
  const products = mergeBrochureImportProducts([prior], [incoming]);
  expect(products[0]?.image).toBe("");
  expect(products[0]?.aiCutoutValidated).toBeUndefined();
  expect(missingImageTargets(products)).toHaveLength(1);
});

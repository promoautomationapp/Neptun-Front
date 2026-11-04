import { expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import { mergeBrochureImportProducts } from "../../src/features/brochure/brochureReimport";

const product = (code: string, overrides: Partial<Product> = {}): Product => ({
  code,
  name: code,
  source: "import",
  image: `/${code}.png`,
  ...overrides,
});
const bundle = (
  code: string,
  members: Product[],
  overrides: Partial<Product> = {},
) =>
  product(code, {
    bundleProducts: members,
    bundleCodes: members.map((member) => member.code),
    ...overrides,
  });

it("replaces an old five-product set with three offers from the selected sheet and keeps manual additions", () => {
  const first = product("A", {
    image: "/A-prepared.png",
    aiOriginalImage: "/A.png",
    aiCutoutValidated: true,
    aiCutoutValidationVersion: 1,
    skipAiCutout: true,
  });
  const oldSet = bundle(
    "A + B + C + D + E [Set row 2]",
    [first, ...["B", "C", "D", "E"].map((code) => product(code))],
    {
      image: "/whole-set.png",
      brochurePage: 1,
      setSourceRows: [2, 3],
    },
  );
  const incoming = ["A", "B", "C"].map((code, index) =>
    product(code, { brochurePage: 1, brochureOrder: index + 1 }),
  );
  const manual = product("manual", { source: "manual" });
  const result = mergeBrochureImportProducts([oldSet, manual], incoming);
  expect(result.map((item) => item.code)).toEqual(["A", "B", "C", "manual"]);
  expect(result[0]).toMatchObject({
    image: "/A-prepared.png",
    aiOriginalImage: "/A.png",
    aiCutoutValidated: true,
    aiCutoutValidationVersion: 1,
    skipAiCutout: true,
  });
  expect(result[1]?.image).toBe("/B.png");
  expect(
    result.every((item) => !item.bundleProducts && !item.setSourceRows),
  ).toBe(true);
  expect(oldSet.bundleProducts).toHaveLength(5);
  expect(incoming[0]?.image).toBe("/A.png");
});

it("adds a set while superseding its imported individuals and keeping unrelated offers when replacement is off", () => {
  const first = product("A", {
    image: "/A-prepared.png",
    aiOriginalImage: "/A.png",
    aiCutoutValidated: true,
    aiCutoutValidationVersion: 1,
  });
  const manual = bundle("Manual A + B", [product("A"), product("B")], {
    source: "manual",
  });
  const partial = bundle("A + D", [product("A"), product("D")]);
  const unrelated = product("C");
  const result = mergeBrochureImportProducts(
    [first, product("B"), manual, partial, unrelated],
    [
      bundle("A + B [Set row 2]", [product("A"), product("B")], {
        brochurePage: 1,
      }),
    ],
    false,
  );
  expect(result.map((item) => item.code)).toEqual([
    "A + B [Set row 2]",
    "Manual A + B",
    "A + D",
    "C",
  ]);
  expect(result[0]?.bundleProducts?.[0]?.image).toBe("/A-prepared.png");
  expect(result[1]?.source).toBe("manual");
  expect(result[3]?.brochurePage).toBe(2);
});

it("refreshes same-code import structure without inheriting a synthetic set photo", () => {
  const oldSet = bundle("A", [product("A", { image: "" }), product("B")], {
    image: "/whole-set.png",
    aiOriginalImage: "/original-set.png",
    setSourceRows: [2, 3],
  });
  const oldSingle = product("C", {
    brochureVariants: [
      { code: "C-blue", color: { name: "blue", hex: "#0000ff" } },
    ],
    setSourceRows: [4],
    excelSource: { row: 4, cells: { old: "value" } },
    brochureDetails: ["Old details"],
    catalogMissing: true,
    missingCatalogCodes: ["C"],
    offerStyle: "happy",
    image: "/C-prepared.png",
    aiOriginalImage: "/C.png",
    aiCutoutValidated: true,
    aiCutoutValidationVersion: 1,
  });
  const result = mergeBrochureImportProducts(
    [oldSet, oldSingle],
    [
      product("A", { image: "" }),
      product("C", { brochurePage: 1, brochureOrder: 2 }),
    ],
  );
  expect(result[0]?.image).toBe("");
  expect(result[0]?.aiOriginalImage).toBeUndefined();
  expect(result[0]?.bundleProducts).toBeUndefined();
  expect(result[0]?.bundleCodes).toBeUndefined();
  expect(result[0]?.setSourceRows).toBeUndefined();
  expect(result[1]).toMatchObject({
    offerStyle: "happy",
    image: "/C-prepared.png",
    brochureOrder: 2,
  });
  for (const field of [
    "brochureVariants",
    "setSourceRows",
    "excelSource",
    "brochureDetails",
    "catalogMissing",
    "missingCatalogCodes",
  ] as const)
    expect(result[1]?.[field]).toBeUndefined();
});

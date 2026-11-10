import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import {
  brochureColorVariantCampaign,
  brochureColorVariantProducts,
  materializeCampaignColorVariants,
} from "../../src/features/brochure/campaignColorVariants";
import {
  coverProducts,
  splitPages,
} from "../../src/features/brochure/campaignPages";
import { productColors } from "../../src/features/brochure/colors";

const phone = (
  code: string,
  color: string,
  changes: Partial<Product> = {},
): Product => ({
  code,
  name: `A37 5G 6/128 ${color}`,
  brand: "SAMSUNG",
  regular: 449,
  sale: 299,
  brochurePage: 1,
  brochureOrder: 1,
  image: `/${code}.png`,
  brochureDetails: ["Android 16", "128GB / 6GB"],
  brochureImagePlacement: { x: 2, y: -1, scale: 1.1 },
  ...changes,
});

it("displays legacy same-slot colors as one first-SKU offer on cover and interior without changing the source", () => {
  const products = [phone("green", "GREEN"), phone("grey", "GREY")];
  const campaign: Campaign = {
    id: "legacy",
    name: "Legacy",
    products,
    coverProductCodes: ["grey", "green"],
    coverBannerProductCode: "grey",
  };
  const before = structuredClone(campaign);
  const display = brochureColorVariantCampaign(campaign);
  expect(display.products).toHaveLength(1);
  expect(display.products[0]).toMatchObject({
    code: "green",
    name: "A37 5G 6/128",
    image: "/green.png",
    sale: 299,
    regular: 449,
    brochureImagePlacement: products[0]!.brochureImagePlacement,
  });
  expect(productColors(display.products[0]!)).toHaveLength(2);
  expect(display.coverProductCodes).toEqual(["green"]);
  expect(display.coverBannerProductCode).toBe("green");
  expect(coverProducts(campaign)).toHaveLength(1);
  expect(
    splitPages({
      ...campaign,
      products: products.map((product) => ({ ...product, brochurePage: 2 })),
    })[0]?.products,
  ).toHaveLength(1);
  expect(campaign).toEqual(before);
  materializeCampaignColorVariants(campaign);
  expect(campaign).toEqual(display);
});

it("keeps different slots, capacities, prices, facts and genuine bundles separate", () => {
  const green = phone("green", "GREEN");
  for (const changes of [
    { brochurePage: 2 },
    { brochureOrder: 2 },
    { sale: 279 },
    { regular: 499 },
    { name: "A37 5G 8/256 GREY" },
    { specs: { RAM: "8GB" } },
    {
      bundleProducts: [
        phone("part1", "GREY", { name: "TV LED BEKO 55BHU7800" }),
        phone("part2", "WHITE"),
      ],
    },
  ] satisfies Partial<Product>[]) {
    const first = { ...green, specs: { RAM: "6GB" } };
    expect(
      brochureColorVariantProducts([first, phone("grey", "GREY", changes)]),
    ).toHaveLength(2);
  }
  expect(
    brochureColorVariantProducts([
      green,
      phone("grey", "GREY", {
        brochurePage: undefined,
        brochureOrder: undefined,
      }),
    ]),
  ).toHaveLength(2);
});

it("recovers interchangeable colors in old slotless and page-only snapshots without crossing known assignments", () => {
  for (const assignment of [
    { brochurePage: undefined, brochureOrder: undefined },
    { brochurePage: 1, brochureOrder: undefined },
  ]) {
    const green = phone("green", "GREEN", assignment);
    const grey = phone("grey", "GREY", assignment);
    const original = structuredClone([green, grey]);
    const [offer] = brochureColorVariantProducts([green, grey]);
    expect(offer).toMatchObject({
      code: "green",
      name: "A37 5G 6/128",
      regular: 449,
      sale: 299,
    });
    expect(productColors(offer!)).toHaveLength(2);
    expect([green, grey]).toEqual(original);
    expect(
      brochureColorVariantProducts([green, { ...grey, sale: 279 }]),
    ).toHaveLength(2);
  }
  expect(
    brochureColorVariantProducts([
      phone("green", "GREEN", { brochureOrder: undefined }),
      phone("grey", "GREY", { brochurePage: 2, brochureOrder: undefined }),
    ]),
  ).toHaveLength(2);
});

it("uses retained worksheet slots when old imports lost typed positions, keeping separate Excel offers separate", () => {
  const old = (color: string, slot: string) =>
    phone(color, color.toUpperCase(), {
      brochurePage: undefined,
      brochureOrder: undefined,
      excelSource: { row: 10, cells: { "Brochure Position": slot } },
    });
  const value = brochureColorVariantProducts([
    old("green", "1.1"),
    old("grey", "1.1000000000000001"),
  ]);
  expect(value).toHaveLength(1);
  expect(value[0]).toMatchObject({ brochurePage: 1, brochureOrder: 1 });
  expect(productColors(value[0]!)).toHaveLength(2);
  expect(
    brochureColorVariantProducts([old("green", "1.1"), old("grey", "1.2")]),
  ).toHaveLength(2);
  const moved = { ...old("grey", "1.1"), brochurePage: 2 };
  expect(
    brochureColorVariantProducts([old("green", "1.1"), moved]),
  ).toHaveLength(2);
  expect(brochureColorVariantProducts([moved])[0]!.brochurePage).toBe(2);
});

it("recovers a slotless color-choice bundle while retaining genuine shared-price collaborations", () => {
  const members = [
    phone("green", "GREEN", {
      brochurePage: undefined,
      brochureOrder: undefined,
    }),
    phone("grey", "GREY", {
      brochurePage: undefined,
      brochureOrder: undefined,
    }),
  ];
  const set = {
    ...phone("old-set", "GREEN", {
      brochurePage: undefined,
      brochureOrder: undefined,
    }),
    name: members.map((member) => member.name).join(" & "),
    bundleProducts: members,
  };
  const [offer] = brochureColorVariantProducts([set]);
  expect(offer!.bundleProducts).toBeUndefined();
  expect(offer!.code).toBe("green");
  expect(productColors(offer!)).toHaveLength(2);
  expect(
    brochureColorVariantProducts([{ ...set, regular: 898 }])[0]!.bundleProducts,
  ).toHaveLength(2);
  expect(
    brochureColorVariantProducts([
      {
        ...set,
        bundleProducts: [
          members[0]!,
          { ...members[1]!, name: "TV LED BEKO 55BHU7800 GREY" },
        ],
      },
    ])[0]!.bundleProducts,
  ).toHaveLength(2);
});

it("keeps every Excel offer on its assigned page when several slots each contain colors", () => {
  const groups = [
    [
      "10.1",
      "KUJFE SAMSUNG SM-R420NZKAEUC BUDS 3 FE BLACK",
      "KUJFE SAMSUNG SM-R420NZAAEUC BUDS 3 FE GREY",
    ],
    [
      "10.2",
      "SMARTWATCH SAMSUNG SM-L350NZKAEUC WATCH 9 44MM BLACK",
      "SMARTWATCH SAMSUNG SM-L350NZSAEUC WATCH 9 44MM SILVER",
    ],
    ["10.3", "KUJFE HUAWEI FREECLIP 2 BLACK", "KUJFE HUAWEI FREECLIP 2 WHITE"],
    ["10.4", "SMARTWATCH GARMIN FENIX 8 PRO 51MM GREY"],
  ];
  const products = groups.flatMap(([slot, ...names]) =>
    names.map((name, index) => {
      const [page, order] = slot!.split(".").map(Number);
      return phone(`${slot}-${index}`, "BLACK", {
        name: name!,
        brand: name!.includes("HUAWEI")
          ? "HUAWEI"
          : name!.includes("GARMIN")
            ? "GARMIN"
            : "SAMSUNG",
        brochurePage: page,
        brochureOrder: order,
      });
    }),
  );
  const value: Campaign = { id: "page-ten", name: "Excel slots", products };
  const pages = splitPages(brochureColorVariantCampaign(value));
  expect(pages).toHaveLength(9);
  const pageTen = pages[8]!;
  expect(pageTen.products.every((product) => product.brochurePage === 10)).toBe(
    true,
  );
  expect(pageTen.products.map((product) => product.code)).toEqual([
    "10.1-0",
    "10.2-0",
    "10.3-0",
    "10.4-0",
  ]);
  expect(pageTen.products.map((product) => product.brochureOrder)).toEqual([
    1, 2, 3, 4,
  ]);
  expect(
    pageTen.products
      .slice(0, 3)
      .every((product) => productColors(product).length === 2),
  ).toBe(true);
});

it("retains custom cover positions when a selected color resolves to the first SKU, including already-grouped snapshots", () => {
  const custom = { x: 10, y: 40, width: 70, height: 28 };
  const source: Campaign = {
    id: "custom-colors",
    name: "Custom colors",
    products: [phone("green", "GREEN"), phone("grey", "GREY")],
    brochurePresetId: "team-custom-design",
    coverProductCodes: ["grey"],
    coverBannerProductCode: "grey",
    coverElementPlacements: { "product-grey": custom },
  };
  const original = structuredClone(source);
  const grouped = brochureColorVariantCampaign(source);
  expect(grouped.coverElementPlacements).toEqual({ "product-green": custom });
  expect(grouped.coverProductCodes).toEqual(["green"]);
  expect(grouped.coverBannerProductCode).toBe("green");
  expect(source).toEqual(original);
  const staleSelection: Campaign = {
    ...grouped,
    coverProductCodes: ["grey"],
    coverBannerProductCode: "grey",
    coverElementPlacements: { "product-grey": custom },
  };
  materializeCampaignColorVariants(staleSelection);
  expect(staleSelection).toEqual(grouped);
  expect(brochureColorVariantCampaign(grouped)).toBe(grouped);
  const firstWins = brochureColorVariantCampaign({
    ...source,
    coverElementPlacements: {
      "product-grey": custom,
      "product-green": { x: 5, y: 30, width: 90, height: 30 },
    },
  });
  expect(firstWins.coverElementPlacements).toEqual({
    "product-green": { x: 5, y: 30, width: 90, height: 30 },
  });
});

it("recognizes catalog Samsung finish suffixes while keeping hardware, generation, size and LTE distinct", () => {
  const catalogPhone = (
    suffix: string,
    color: string,
    changes: Partial<Product> = {},
  ) =>
    phone(suffix, color, {
      name: `SAMSUNG SM-A376B${suffix} A37 5G 6/128GB ${color}`,
      specs: { Model: `SM-A376B${suffix}` },
      ...changes,
    });
  const green = catalogPhone("DGBEUC", "GREEN");
  const grey = catalogPhone("ZABEUC", "GREY");
  expect(brochureColorVariantProducts([green, grey])).toHaveLength(1);
  for (const changes of [
    { name: "SAMSUNG SM-A376EZABEUC A37 5G 6/128GB GREY" },
    { name: "SAMSUNG SM-A376BZABEUC A37 5G 8/256GB GREY" },
    { name: "SAMSUNG SM-A376BZABEUC A38 5G 6/128GB GREY" },
  ])
    expect(
      brochureColorVariantProducts([green, { ...grey, ...changes }]),
    ).toHaveLength(2);
  const watch = phone("watch", "BLACK", {
    name: "SMARTWATCH SAMSUNG SM-L350NZKAEUC WATCH 9 44MM BLACK",
  });
  for (const name of [
    "SMARTWATCH SAMSUNG SM-L355NZSAEUC WATCH 9 44MM SILVER",
    "SMARTWATCH SAMSUNG SM-L350NZSAEUC WATCH 9 40MM SILVER",
    "SMARTWATCH SAMSUNG SM-L350NZSAEUC WATCH 9 44MM LTE SILVER",
  ])
    expect(
      brochureColorVariantProducts([watch, { ...watch, code: "other", name }]),
    ).toHaveLength(2);
});

it("recovers the workbook FIT3 color-only legacy bundle without losing its shared offer or original data", () => {
  const members: Product[] = [
    ["84061036", "SM-R390NIDAEUC", "PINK GOLD"],
    ["84061037", "SM-R390NZAAEUC", "GREY"],
    ["84061038", "SM-R390NZSAEUC", "SILVER"],
  ].map(([code, model, color]) => ({
    code: code!,
    name: `SMARTWATCH SAMSUNG FIT3 ${model} ${color}`,
    brand: "SAMSUNG",
    regular: 79.99,
    image: `/${code}.png`,
    brochureDetails: [
      'Ekran: 1.6" AMOLED',
      "Rezolucioni: 256 x 402 pixel",
      "Dimenzionet: 42.9 x 28.8 x 9.9 mm",
    ],
  }));
  const legacy: Product = {
    code: members.map((member) => member.code).join(" + "),
    name: members.map((member) => member.name).join(" & "),
    regular: 79.99,
    sale: 39.99,
    brochurePage: 11,
    brochureOrder: 1,
    bundleProducts: members,
    bundleCodes: members.map((member) => member.code),
    productArtworks: members.map((member) => ({
      id: `bundle-image-${member.code}`,
      type: "bundle-product",
      memberCode: member.code,
      image: member.image,
      x: 0,
      y: 0,
      width: 30,
    })),
  };
  const campaign: Campaign = {
    id: "fit",
    name: "FIT3",
    products: [legacy],
    coverProductCodes: [legacy.code],
  };
  const before = structuredClone(campaign);
  const display = brochureColorVariantCampaign(campaign);
  const fit = display.products[0]!;
  expect(fit).toMatchObject({
    code: "84061036",
    name: "SMARTWATCH SAMSUNG FIT3 SM-R390",
    regular: 79.99,
    sale: 39.99,
    image: "/84061036.png",
    brochurePage: 11,
    brochureOrder: 1,
  });
  expect(fit.bundleProducts).toBeUndefined();
  expect(fit.productArtworks).toBeUndefined();
  expect(productColors(fit)).toHaveLength(3);
  expect(display.coverProductCodes).toEqual(["84061036"]);
  expect(campaign).toEqual(before);
  expect(
    brochureColorVariantProducts([{ ...legacy, regular: 239.97 }])[0]
      ?.bundleProducts,
  ).toHaveLength(3);
  expect(
    brochureColorVariantProducts([
      {
        ...legacy,
        bundleProducts: [
          members[0]!,
          { ...members[1]!, name: "SMARTWATCH SAMSUNG FIT4 GREY" },
        ],
      },
    ])[0]?.bundleProducts,
  ).toHaveLength(2);
  for (const conflictingSlot of [{ brochurePage: 12 }, { brochureOrder: 2 }])
    expect(
      brochureColorVariantProducts([
        {
          ...legacy,
          bundleProducts: [members[0]!, { ...members[1]!, ...conflictingSlot }],
        },
      ])[0]?.bundleProducts,
    ).toHaveLength(2);
});

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
});

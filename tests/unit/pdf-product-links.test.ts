import { afterEach, describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import type { Product } from "../../src/domain/models";
import {
  neptunProductPdfUrl,
  productPdfLinkCoverage,
  productPdfLinks,
} from "../../src/features/brochure/pdfProductLinks";

const url = "https://www.neptun-ks.com/products/galaxy-a37";
const phone: Product = { code: "phone", name: "Phone", url };

function box(
  node: Element,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {},
  });
}
function fixture(markup = '<article data-product-code="phone"></article>') {
  const page = document.createElement("section");
  page.innerHTML = markup;
  document.body.append(page);
  box(page, 100, 50, 400, 600);
  return page;
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("saved Neptun destinations", () => {
  it("accepts absolute and site-relative product pages", () => {
    expect(neptunProductPdfUrl(url)).toBe(url);
    expect(neptunProductPdfUrl(" /products/galaxy-a37 ")).toBe(url);
    expect(neptunProductPdfUrl("https://shop.neptun-ks.com/product/1")).toBe(
      "https://shop.neptun-ks.com/product/1",
    );
  });
  it("rejects foreign hosts, executable schemes, credentials, ports and missing product destinations", () => {
    for (const value of [
      undefined,
      "",
      "#photo",
      "galaxy-a37",
      "/",
      "https://neptun-ks.com",
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///tmp/photo",
      "https://neptun-ks.com.evil.test/product/1",
      "https://evilneptun-ks.com/product/1",
      "//evil.test/phone",
      "https://user:pass@neptun-ks.com/product/1",
      "https://neptun-ks.com:8080/product/1",
    ])
      expect(neptunProductPdfUrl(value)).toBeNull();
  });
});

it("maps the final scaled output frame to PDF millimeters even when the photograph is missing", () => {
  const page = fixture();
  box(page.firstElementChild!, 140, 110, 200, 240);
  expect(productPdfLinks(page, [phone], 200, 300)).toEqual([
    { url, x: 20, y: 30, width: 100, height: 120 },
  ]);
});

it("clips moved cards to the output page and skips off-page, hidden and export-hidden elements", () => {
  const page = fixture(
    '<article data-product-code="phone"></article>'.repeat(6),
  );
  const cards = [...page.children];
  box(cards[0]!, 50, 20, 200, 200);
  box(cards[1]!, 600, 60, 200, 200);
  box(cards[2]!, 140, 110, 200, 240);
  (cards[2]! as HTMLElement).style.visibility = "hidden";
  box(cards[3]!, 140, 110, 200, 240);
  cards[3]!.setAttribute("data-export-hide", "true");
  box(cards[4]!, 140, 110, 0, 240);
  box(cards[5]!, 140, 110, 200, 240);
  (cards[5]! as HTMLElement).style.opacity = "0";
  expect(productPdfLinks(page, [phone], 200, 300)).toEqual([
    { url, x: 0, y: 0, width: 75, height: 85 },
  ]);
});

it("also links photographs moved beyond the card, respecting ancestor crops", () => {
  const page = fixture(
    '<article data-product-code="phone"><div style="overflow:hidden"><img class="brochure-product-image"></div></article>',
  );
  box(page.firstElementChild!, 140, 110, 150, 240);
  box(page.querySelector("div")!, 290, 100, 100, 200);
  box(page.querySelector("img")!, 290, 80, 100, 250);
  expect(productPdfLinks(page, [phone], 200, 300)).toEqual([
    { url, x: 20, y: 30, width: 75, height: 120 },
    { url, x: 95, y: 25, width: 50, height: 100 },
  ]);
});

it("links genuine bundle members separately without an overlapping first-member link", () => {
  const other: Product = {
    code: "other",
    name: "Other",
    url: "/products/other",
  };
  const bundle: Product = {
    code: "set",
    name: "Set",
    url,
    bundleProducts: [phone, other, { code: "unknown", name: "Unknown" }],
  };
  const page = fixture(
    '<article data-product-code="set"><div data-bundle-artwork-code="phone"></div><div data-bundle-artwork-code="other"></div><div data-bundle-member-code="phone"></div><div data-bundle-member-code="unknown"></div></article>',
  );
  box(page.firstElementChild!, 100, 50, 400, 300);
  for (const [index, member] of [
    ...page.querySelectorAll("article > div"),
  ].entries())
    box(member, 100 + index * 80, 100, 60, 100);
  expect(productPdfLinks(page, [bundle], 200, 300)).toEqual([
    { url, x: 0, y: 25, width: 30, height: 50 },
    {
      url: "https://www.neptun-ks.com/products/other",
      x: 40,
      y: 25,
      width: 30,
      height: 50,
    },
    { url, x: 80, y: 25, width: 30, height: 50 },
  ]);
});

it("uses the primary SKU for a collapsed color choice and leaves unknown products unlinked", () => {
  const page = fixture(
    '<article data-product-code="phone"></article><article data-product-code="unknown"></article>',
  );
  for (const node of page.children) box(node, 140, 110, 200, 240);
  const variants: Product = {
    ...phone,
    brochureVariants: [
      {
        code: "phone",
        name: "Phone blue",
        color: { name: "blue", hex: "#0066cc" },
      },
      {
        code: "white",
        name: "Phone white",
        color: { name: "white", hex: "#ffffff" },
      },
    ],
  };
  expect(
    productPdfLinks(
      page,
      [variants, { code: "unknown", name: "Unknown" }],
      200,
      300,
    ),
  ).toHaveLength(1);
});

it("links legacy one-member offers as the single card rendered by the brochure", () => {
  const page = fixture();
  box(page.firstElementChild!, 140, 110, 200, 240);
  expect(
    productPdfLinks(
      page,
      [{ ...phone, bundleProducts: [{ code: "legacy", name: "Legacy" }] }],
      200,
      300,
    ),
  ).toEqual([{ url, x: 20, y: 30, width: 100, height: 120 }]);
  expect(
    productPdfLinkCoverage([
      phone,
      {
        code: "set",
        name: "Set",
        bundleProducts: [phone, { code: "missing", name: "Missing" }],
      },
    ]),
  ).toEqual({ linked: 2, total: 3 });
});

it("links complete source photos as single offers even when a legacy import split the model punctuation", () => {
  const page = fixture();
  box(page.firstElementChild!, 140, 110, 200, 240);
  const image = "/brochure-presets/black-friday/images/p01-im5.webp";
  const legacy: Product = {
    ...phone,
    image,
    bundleProducts: [
      {
        code: "fragment-one",
        name: "Fragment one",
        image,
        url: "/products/wrong-fragment",
      },
      { code: "fragment-two", name: "Fragment two", image },
    ],
  };
  expect(productPdfLinks(page, [legacy], 200, 300)).toEqual([
    { url, x: 20, y: 30, width: 100, height: 120 },
  ]);
  expect(productPdfLinkCoverage([legacy])).toEqual({ linked: 1, total: 1 });
});

it("serializes real URI annotations on the current PDF page with correct coordinates", () => {
  const page = fixture();
  box(page.firstElementChild!, 140, 110, 200, 240);
  const pdf = new jsPDF({ unit: "mm", format: [200, 300] });
  pdf.addPage([200, 300]);
  for (const link of productPdfLinks(page, [phone], 200, 300))
    pdf.link(link.x, link.y, link.width, link.height, { url: link.url });
  const output = pdf.output();
  expect(output.match(/\/Subtype \/Link/g)).toHaveLength(1);
  expect(output).toContain(`/A <</S /URI /URI (${url})`);
  const rect = output
    .match(/\/Rect \[([^\]]+)\]/)![1]!
    .trim()
    .split(/\s+/)
    .map(Number);
  const points = 72 / 25.4;
  [20, 270, 120, 150].forEach((mm, i) =>
    expect(rect[i]).toBeCloseTo(mm * points, 5),
  );
  expect(pdf.getCurrentPageInfo().pageNumber).toBe(2);
});

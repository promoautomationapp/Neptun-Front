import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  ProductPage,
  CoverPage,
  StoresPage,
  splitPages,
} from "../../src/features/brochure/Brochure";
import {
  blackFridayDesignDefaults,
  blackCollectionDesignDefaults,
  blackFridayReference,
  blackFridayPageArtworks,
} from "../../src/features/brochure/blackFridayDesign";
import {
  brochurePageCount,
  includesStoresPage,
  includesStoresFooter,
} from "../../src/features/brochure/storesSelection";
import { blackFridayStoresContent } from "../../src/features/brochure/blackFridayStores";
import { resolveSettings } from "../../src/features/settings/settings.schema";
const settings = {
  ...resolveSettings(null),
  stores: [
    {
      city: "Current City",
      name: "Current shop",
      address: "Current street",
      phone: "123 456 789",
    },
  ],
  contact: {
    serviceAddress: "Current service",
    servicePhones: "987 654 321",
    website: "current.example",
    email: "current@example.test",
  },
};
function markup(node: React.ReactNode) {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(node);
  return root;
}
function campaign(clean: boolean): Campaign {
  return {
    ...(clean ? blackCollectionDesignDefaults() : blackFridayDesignDefaults()),
    id: "footer",
    name: "Current campaign",
    showOnlineStore: false,
    products: blackFridayReference.pages.flatMap((page) =>
      page.frames.map((frame, index) => ({
        code: frame.code!,
        name: `Current product ${frame.code}`,
        sale: 199,
        brochurePage: page.number,
        brochureOrder: index + 1,
      })),
    ),
  };
}
test.each([false, true])(
  "both black designs default to an editable final stores page (clean=%s)",
  (clean) => {
    const value = campaign(clean),
      pages = splitPages(value),
      last = pages.at(-1)!;
    expect(value.includeStoresPage).toBe(true);
    expect(value.includeStoresFooter).toBe(false);
    expect(includesStoresPage(value)).toBe(true);
    expect(includesStoresFooter(value)).toBe(false);
    expect(brochurePageCount(value, pages.length)).toBe(pages.length + 2);
    expect(value.pageArtworks?.stores || []).toEqual([]);
    const productPage = markup(
      <ProductPage campaign={value} page={last} settings={settings} />,
    );
    expect(productPage.querySelector(".compact-stores-footer")).toBeNull();
    expect(
      productPage.querySelector('img[src*="/artwork/footer-"]'),
    ).toBeNull();
    expect(productPage.textContent).not.toContain("045 286 889");
    const storesPage = markup(
      <StoresPage campaign={value} settings={settings} />,
    );
    expect(
      storesPage.querySelector(".stores-black-reference.stores-blue"),
    ).not.toBeNull();
    expect(storesPage.querySelector(".needs-contrast-surfaces")).toBeNull();
    expect(
      storesPage.querySelector(".brochure-format-frame")?.getAttribute("style"),
    ).toContain(clean ? "background:#000000" : "background:#111213");
    expect(
      storesPage
        .querySelector<HTMLElement>(".brochure-stores")
        ?.style.getPropertyValue("--brochure-foreground"),
    ).toBe("#ffffff");
    expect(storesPage.textContent).toContain("Current shop");
    expect(storesPage.textContent).toContain("Current street");
    expect(storesPage.textContent).toContain("123 456 789");
    expect(storesPage.textContent).toContain("Current service");
    expect(
      storesPage.querySelector(".stores-hajde img")?.getAttribute("src"),
    ).toBe("/brochure-presets/black-friday/artwork/footer-neptun.svg");
    expect(
      storesPage.querySelector(".stores-service img")?.getAttribute("src"),
    ).toBe("/brochure-presets/black-friday/artwork/footer-service.svg");
    expect(
      storesPage.querySelector(".stores-balfin img")?.getAttribute("src"),
    ).toBe("/brochure-presets/black-friday/artwork/footer-balfin.svg");
    expect(
      storesPage.querySelector('[data-reference-role="person"]'),
    ).toBeNull();
    expect(storesPage.textContent).not.toContain("LOJË SHPËRBLYESE");
    expect(storesPage.textContent).not.toContain("045 286 889");
  },
);

test.each([false, true])(
  "the footer is an explicit alternative to the final stores page (clean=%s)",
  (clean) => {
    const value = {
      ...campaign(clean),
      includeStoresPage: false,
      includeStoresFooter: true,
    };
    const pages = splitPages(value),
      last = pages.at(-1)!;
    expect(includesStoresPage(value)).toBe(false);
    expect(includesStoresFooter(value)).toBe(true);
    expect(brochurePageCount(value, pages.length)).toBe(pages.length + 1);
    const page = markup(
      <ProductPage campaign={value} page={last} settings={settings} />,
    );
    expect(page.querySelectorAll(".compact-stores-footer")).toHaveLength(1);
    expect(page.querySelector(".compact-stores-footer-black")).not.toBeNull();
    expect(
      page
        .querySelector<HTMLElement>(".brochure-last-page-shell")
        ?.style.getPropertyValue("--brochure-disclaimer-surface"),
    ).toBe("transparent");
    expect(page.querySelector(".compact-stores-footer")?.textContent).toContain(
      "Current shop",
    );
    expect(page.querySelector(".compact-stores-footer")?.textContent).toContain(
      "123 456 789",
    );
    expect(
      page.querySelector(".compact-footer-neptun")?.getAttribute("src"),
    ).toBe("/brochure-presets/black-friday/artwork/footer-neptun.svg");
    expect(
      page.querySelector(".compact-footer-balfin")?.getAttribute("src"),
    ).toBe("/brochure-presets/black-friday/artwork/footer-balfin.svg");
    expect(
      page.querySelector(".compact-footer-service-logo")?.getAttribute("src"),
    ).toBe("/brochure-presets/black-friday/artwork/footer-service.svg");
    expect(page.textContent).not.toContain("045 286 889");
    expect(
      markup(<CoverPage campaign={value} settings={settings} />).querySelector(
        ".compact-stores-footer",
      ),
    ).toBeNull();
    expect(
      markup(
        <ProductPage
          campaign={{ ...value, includeStoresFooter: false }}
          page={last}
          settings={settings}
        />,
      ).querySelector(".compact-stores-footer"),
    ).toBeNull();
  },
);

test.each([false, true])(
  "saved display choices remain mutually exclusive (clean=%s)",
  (clean) => {
    const saved = {
      ...campaign(clean),
      includeStoresPage: true,
      includeStoresFooter: true,
    };
    expect(includesStoresPage(saved)).toBe(true);
    expect(includesStoresFooter(saved)).toBe(false);
    expect(
      includesStoresFooter({ ...saved, includeStoresFooter: undefined }),
    ).toBe(false);
    const none = {
      ...saved,
      includeStoresPage: false,
      includeStoresFooter: false,
    };
    expect(includesStoresPage(none)).toBe(false);
    expect(includesStoresFooter(none)).toBe(false);
    const last = splitPages(none).at(-1)!;
    const page = markup(
      <ProductPage campaign={none} page={last} settings={settings} />,
    );
    expect(page.querySelector(".compact-stores-footer")).toBeNull();
    expect(page.querySelector('img[src*="/artwork/footer-"]')).toBeNull();
  },
);

test("old source closing promotions are replaced without removing user artwork, logo overrides, or saved positions", () => {
  const value = campaign(false);
  const native = blackFridayPageArtworks().stores!;
  const custom = {
    id: "custom-note",
    type: "text",
    text: "Our custom note",
    x: 2,
    y: 82,
    width: 50,
  };
  value.pageArtworks = { ...value.pageArtworks, stores: [...native, custom] };
  value.storesElementPlacements = {
    heading: { x: 8, y: 4, width: 30, height: 5 },
  };
  value.storePositions = { 0: { x: 11, y: 12, width: 24, height: 18 } };
  value.brandAssets = {
    storesHajde: "/our-neptun.svg",
    service: "/our-service.svg",
    balfin: "/our-group.svg",
  };
  const original = JSON.stringify(value);
  const page = markup(<StoresPage campaign={value} settings={settings} />);
  expect(page.textContent).toContain("Our custom note");
  expect(page.querySelectorAll(".brochure-floating-artwork")).toHaveLength(1);
  expect(page.textContent).not.toContain("LOJË SHPËRBLYESE");
  expect(page.querySelector('img[src*="closing-prizes"]')).toBeNull();
  expect(
    page.querySelector<HTMLElement>('[data-store-element="heading"]')?.style
      .left,
  ).toBe("8%");
  expect(
    page.querySelector<HTMLElement>(
      '[data-store-scope="store"][data-store-element="0"]',
    )?.style.left,
  ).toBe("11%");
  expect(page.querySelector(".stores-hajde img")?.getAttribute("src")).toBe(
    "/our-neptun.svg",
  );
  expect(page.querySelector(".stores-service img")?.getAttribute("src")).toBe(
    "/our-service.svg",
  );
  expect(page.querySelector(".stores-balfin img")?.getAttribute("src")).toBe(
    "/our-group.svg",
  );
  expect(JSON.stringify(value)).toBe(original);
});

test("source page12 keeps its reserved14percent space, removes only unchanged native footer layers", () => {
  const value = {
      ...campaign(false),
      includeStoresPage: false,
      includeStoresFooter: true,
    },
    page = splitPages(value).at(-1)!;
  const before = JSON.stringify(value.pageArtworks);
  const content = blackFridayStoresContent(value, page);
  expect(content.reserved).toBe(true);
  expect(
    content.campaign.pageArtworks?.["product-10"]?.some(
      (item) => item.id === "bf-footer-neptun",
    ),
  ).toBe(false);
  expect(JSON.stringify(value.pageArtworks)).toBe(before);
  const rendered = markup(
    <ProductPage campaign={value} page={page} settings={settings} />,
  );
  expect(
    rendered.querySelector<HTMLElement>(".brochure-last-page-scaled")?.style
      .transform,
  ).toBe("scale(1)");
  const native = blackFridayPageArtworks()["product-10"]!.find(
    (item) => item.id === "bf-footer-neptun",
  )!;
  const custom = {
    ...value,
    pageArtworks: {
      ...value.pageArtworks,
      "product-10": [{ ...native, x: native.x + 1 }],
    },
  };
  expect(
    blackFridayStoresContent(custom, page).campaign.pageArtworks?.[
      "product-10"
    ],
  ).toEqual([{ ...native, x: native.x + 1 }]);
  const saved = {
    ...value,
    includeStoresFooter: false,
    includeStoresPage: true,
    compactStoresFooterHeight: 20,
  };
  expect(saved.includeStoresFooter).toBe(false);
});

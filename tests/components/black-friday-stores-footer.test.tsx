import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  ProductPage,
  CoverPage,
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
  "both black designs default to one dynamic bottom footer, with no extra stores page (clean=%s)",
  (clean) => {
    const value = campaign(clean),
      pages = splitPages(value),
      last = pages.at(-1)!;
    expect(value.includeStoresFooter).toBe(true);
    expect(value.includeStoresPage).toBe(false);
    expect(value.compactStoresFooterHeight).toBe(14);
    expect(includesStoresPage(value)).toBe(false);
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
    expect(page.querySelector(".brochure-stores")).toBeNull();
    expect(page.querySelector(".compact-stores-footer")?.textContent).toContain(
      "Current shop",
    );
    expect(page.querySelector(".compact-stores-footer")?.textContent).toContain(
      "123 456 789",
    );
    expect(page.querySelector(".compact-stores-footer")?.textContent).toContain(
      "Current service",
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
    expect(page.querySelector('[data-reference-role="person"]')).toBeNull();
    const cover = markup(<CoverPage campaign={value} settings={settings} />);
    expect(cover.querySelector(".compact-stores-footer")).toBeNull();
    const hidden = markup(
      <ProductPage
        campaign={{ ...value, includeStoresFooter: false }}
        page={last}
        settings={settings}
      />,
    );
    expect(hidden.querySelector(".compact-stores-footer")).toBeNull();
    expect(hidden.textContent).not.toContain("045 286 889");
  },
);
test.each([false, true])("legacy separate closing pages become the Black Friday bottom store section (clean=%s)", (clean) => {
  const saved = { ...campaign(clean), includeStoresPage: true, includeStoresFooter: undefined };
  expect(includesStoresPage(saved)).toBe(false);
  expect(includesStoresFooter(saved)).toBe(true);
  expect(includesStoresFooter({ ...saved, includeStoresFooter: false })).toBe(false);
  const pages = splitPages(saved);
  expect(brochurePageCount(saved, pages.length)).toBe(1 + pages.length);
});
test("source page12 keeps its reserved14percent space, removes only unchanged native footer layers", () => {
  const value = campaign(false),
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

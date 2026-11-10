import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { ProductBrandArtwork } from "../../src/features/brochure/ProductBrandArtwork";
import {
  AppleOfferBranding,
  appleOfferResellerAssetKey,
} from "../../src/features/brochure/ApplePageBranding";
import { bundleBrandArtworks } from "../../src/features/brochure/BundleBrandArtwork";
import {
  blackCollectionDesignDefaults,
  blackFridayDesignDefaults,
} from "../../src/features/brochure/blackFridayDesign";
import { brochurePage } from "../fixtures/brochure-page";

const iphone: Product = {
  code: "iphone",
  name: "iPhone 17 Pro",
  brand: "APPLE",
  image: "/iphone.png",
  brandLogo: "/imported-apple-logo.png",
  regular: 1699,
  sale: 1549,
};
const ipad: Product = {
  ...iphone,
  code: "ipad",
  name: "iPad 11",
  image: "/ipad.png",
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function markup(node: React.ReactNode) {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(node);
  return root;
}
test.each([false, true])(
  "Black Friday Apple-only pages show one editable reseller mark, with no repeated source brand logos (clean=%s)",
  (clean) => {
    const campaign: Campaign = {
      ...(clean
        ? blackCollectionDesignDefaults()
        : blackFridayDesignDefaults()),
      id: "apple-page",
      name: "Apple page",
      products: [iphone, ipad],
      includeStoresFooter: false,
    };
    const root = markup(
      <ProductPage
        campaign={campaign}
        page={brochurePage(campaign.products)}
      />,
    );
    expect(
      root.querySelectorAll(
        '.brochure-apple-page-branding img[alt="Apple Authorised Reseller"]',
      ),
    ).toHaveLength(1);
    expect(
      root.querySelectorAll('.brochure-product [data-detail-key="__brand"]'),
    ).toHaveLength(0);
    expect(
      root.querySelectorAll(".brochure-apple-offer-branding"),
    ).toHaveLength(0);
    expect(
      root.querySelectorAll('[data-apple-photo-clearance="true"]'),
    ).toHaveLength(2);
    const mixed = {
      ...campaign,
      products: [iphone, { ...ipad, brand: "SAMSUNG", name: "Samsung Tab" }],
    };
    expect(
      markup(
        <ProductPage campaign={mixed} page={brochurePage(mixed.products)} />,
      ).querySelector(".brochure-apple-page-branding"),
    ).toBeNull();
  },
);
test.each([false, true])(
  "mixed Black Friday pages show a reseller mark inside each Apple offer frame (clean=%s)",
  (clean) => {
    const samsung: Product = {
      code: "samsung",
      name: "Samsung Tab",
      brand: "SAMSUNG",
      image: "/samsung.png",
    };
    const campaign: Campaign = {
      ...(clean
        ? blackCollectionDesignDefaults()
        : blackFridayDesignDefaults()),
      id: "mixed-page",
      name: "Mixed page",
      products: [iphone, samsung, ipad],
      includeStoresFooter: false,
    };
    const root = markup(
      <ProductPage
        campaign={campaign}
        page={brochurePage(campaign.products)}
      />,
    );
    expect(root.querySelector(".brochure-apple-page-branding")).toBeNull();
    expect(
      root.querySelectorAll(
        '.brochure-apple-offer-branding img[alt="Apple Authorised Reseller"]',
      ),
    ).toHaveLength(2);
    expect(
      root.querySelector(
        ".cover-element-bf-product-iphone .brochure-apple-offer-branding",
      ),
    ).not.toBeNull();
    expect(
      root.querySelector(
        ".cover-element-bf-product-ipad .brochure-apple-offer-branding",
      ),
    ).not.toBeNull();
    expect(
      root.querySelector(
        ".cover-element-bf-product-samsung .brochure-apple-offer-branding",
      ),
    ).toBeNull();
    expect(
      root.querySelectorAll('.brochure-product [data-detail-key="__brand"]'),
    ).toHaveLength(1);
  },
);

test("mixed-page reseller replacement, placement and hiding remain specific to their offer", () => {
  const samsung: Product = {
    code: "samsung",
    name: "Samsung Tab",
    brand: "SAMSUNG",
  };
  const assetKey = appleOfferResellerAssetKey(iphone);
  const campaign: Campaign = {
    ...blackCollectionDesignDefaults(),
    id: "mixed-edits",
    name: "Mixed edits",
    products: [iphone, samsung, ipad],
    campaignAssets: {
      [assetKey]: {
        image: "/custom-offer-reseller.png",
        placement: { x: -1, y: 2, width: 80, height: 3 },
      },
    },
    includeStoresFooter: false,
  };
  const root = markup(
    <ProductPage campaign={campaign} page={brochurePage(campaign.products)} />,
  );
  const mark = root.querySelector<HTMLElement>(
    `.cover-element-bf-product-iphone [data-detail-key="__asset-${assetKey}"]`,
  )!;
  expect(mark.querySelector("img")?.getAttribute("src")).toBe(
    "/custom-offer-reseller.png",
  );
  expect(mark.style.transform).toBe("translate(-1cqw, 2cqw)");
  expect(mark.style.width).toBe("80%");
  expect(mark.style.height).toBe("3cqw");
  expect(
    root.querySelector(
      ".cover-element-bf-product-ipad .brochure-apple-reseller-default",
    ),
  ).not.toBeNull();
  const hidden = {
    ...campaign,
    campaignAssets: { [assetKey]: { hidden: true } },
  };
  expect(
    markup(
      <ProductPage campaign={hidden} page={brochurePage(hidden.products)} />,
    ).querySelector(
      ".cover-element-bf-product-iphone .brochure-apple-offer-branding img",
    ),
  ).toBeNull();
  const moved = markup(
    <ProductPage
      campaign={campaign}
      page={brochurePage(campaign.products, { index: 1 })}
    />,
  );
  expect(
    moved
      .querySelector(
        ".cover-element-bf-product-iphone .brochure-apple-offer-branding img",
      )
      ?.getAttribute("src"),
  ).toBe("/custom-offer-reseller.png");
});

test("offer reseller tools persist moves, resizing and removal through campaign assets", () => {
  const campaign: Campaign = {
    ...blackCollectionDesignDefaults(),
    id: "offer-tools",
    name: "Offer tools",
    products: [iphone],
  };
  const change = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ width: 200, height: 40 }),
  );
  const view = render(
    <section className="brochure-page">
      <AppleOfferBranding
        campaign={campaign}
        product={iphone}
        onChange={change}
      />
    </section>,
  );
  const asset = view.container.querySelector<HTMLElement>(
    ".campaign-asset-artwork",
  )!;
  fireEvent.focus(asset);
  fireEvent.keyDown(document.querySelector(".detail-context-move")!, {
    key: "ArrowRight",
  });
  const assetKey = appleOfferResellerAssetKey(iphone);
  expect(change).toHaveBeenLastCalledWith(assetKey, {
    placement: { x: 0.25, y: 0 },
  });
  fireEvent.keyDown(asset.querySelector("[data-resize-corner]")!, {
    key: "ArrowLeft",
  });
  expect(change).toHaveBeenLastCalledWith(assetKey, {
    placement: { x: 0.25, y: 0, width: 98 },
  });
  fireEvent.click(document.querySelector(".detail-context-more")!);
  fireEvent.click(document.querySelector(".detail-context-remove")!);
  expect(change).toHaveBeenLastCalledWith(assetKey, { hidden: true });
});
test("an explicitly restored Apple offer logo and a replacement reseller mark stay available", () => {
  const campaign: Campaign = {
    ...blackCollectionDesignDefaults(),
    id: "apple-edits",
    name: "Apple edits",
    products: [iphone],
    campaignAssets: {
      "product-0-apple-reseller": { image: "/custom-reseller.png" },
    },
    includeStoresFooter: false,
  };
  const root = markup(
    <ProductPage campaign={campaign} page={brochurePage(campaign.products)} />,
  );
  expect(
    root
      .querySelector(".brochure-apple-page-branding img")
      ?.getAttribute("src"),
  ).toBe("/custom-reseller.png");
  expect(root.querySelector(".brochure-apple-reseller-default")).toBeNull();
  const restored = markup(
    <ProductBrandArtwork
      campaign={campaign}
      product={{ ...iphone, hideBrandLogo: false }}
    />,
  );
  expect(restored.querySelector("img")?.getAttribute("src")).toBe(
    "/imported-apple-logo.png",
  );
  expect(
    bundleBrandArtworks(campaign, {
      ...iphone,
      bundleProducts: [iphone, ipad],
    }),
  ).toEqual([]);
});

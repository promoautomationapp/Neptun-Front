import type { Campaign, Product, JsonValue } from "../../domain/models";
import { productPageChunk } from "./brochureLayout";

export interface BrochurePage {
  index: number;
  layout: string;
  image: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundGradient: Campaign["coverBackgroundGradient"];
  showFooter: boolean;
  showFooterPageNumber: boolean;
  spacing: Record<string, JsonValue> | null;
  title: string;
  products: Product[];
}

export function coverProducts(campaign: Campaign) {
  const products = campaign?.products || [];
  // The UUU band occupies the middle of the cover. With it visible, two
  // product frames fit below it; remaining offers continue on product pages.
  const october =
    campaign.brochureVisualStyle === "october" ||
    campaign.brochurePresetId === "neptun-october";
  const limit = october || campaign.showCoverBand === true ? 2 : 3;
  if (products.some((product) => Number.isInteger(product.brochurePage)))
    return products
      .filter((product) => product.brochurePage === 1)
      .slice(0, limit);
  const chosenCodes = new Set((campaign?.coverProductCodes || []).map(String));
  const chosen = products
    .filter((product) => chosenCodes.has(String(product.code)))
    .slice(0, limit);
  return chosen.length ? chosen : products.slice(0, limit);
}

function buildPages(campaign: Campaign) {
  const pages: BrochurePage[] = [];
  const sourceIndexes: number[] = [];
  const october =
    campaign.brochureVisualStyle === "october" ||
    campaign.brochurePresetId === "neptun-october";
  const appendPage = (
    products: Product[],
    layout: string,
    title: string,
    sourceIndex = pages.length,
  ) => {
    const index = pages.length;
    const config = campaign.pages?.[sourceIndex] || {};
    sourceIndexes.push(sourceIndex);
    pages.push({
      index,
      layout,
      image: config.image || "",
      backgroundColor: config.backgroundColor || "",
      backgroundGradient: config.backgroundGradient || null,
      backgroundImage: config.backgroundImage || "",
      showFooter: config.showFooter ?? campaign.showInteriorFooter ?? false,
      showFooterPageNumber:
        config.showFooterPageNumber ?? campaign.showFooterPageNumber ?? false,
      spacing: config.spacing || null,
      title,
      products,
    });
  };
  const appendChunks = (products: Product[], sourceIndex?: number) => {
    for (let offset = 0; offset < products.length;) {
      // A saved page owns its background and explicit layout. When an
      // automatic group overflows, keep those settings with its chunks.
      const pageCampaign =
        october && sourceIndex !== undefined
          ? {
              ...campaign,
              pages: {
                [pages.length]: campaign.pages?.[sourceIndex] || {},
              },
            }
          : campaign;
      const chunk = productPageChunk(
        pageCampaign,
        products.slice(offset),
        pages.length,
      );
      appendPage(
        chunk.products,
        chunk.layout,
        `Page ${pages.length + 2}`,
        october ? sourceIndex : undefined,
      );
      offset += chunk.products.length;
    }
  };
  const positioned = (campaign.products || []).filter((product) =>
    Number.isInteger(product.brochurePage),
  );
  if (positioned.length) {
    const visibleCoverCodes = new Set(
      coverProducts(campaign).map((product) => String(product.code)),
    );
    // An older saved campaign may assign three products to page one while
    // the middle cover band is shown. Include the extra offer at the start
    // of page two so that its existing page background remains attached.
    const overflowCover = campaign.products.filter(
      (product) =>
        product.brochurePage === 1 &&
        !visibleCoverCodes.has(String(product.code)),
    );
    const maxPage = Math.max(
      overflowCover.length ? 2 : 1,
      ...positioned.map((product) => product.brochurePage ?? 1),
    );
    for (let number = 2; number <= maxPage; number++) {
      const products = [
        ...(number === 2 ? overflowCover : []),
        ...campaign.products.filter(
          (product) => product.brochurePage === number,
        ),
      ];
      if (
        products.length &&
        ((number === 2 && overflowCover.length > 0) ||
          campaign.autoProductLayout === true ||
          products.some((product) => product.brochureCardSize))
      )
        appendChunks(products, october ? number - 2 : undefined);
      else {
        // Preserve the imported page membership and layout of older designs.
        const fallback =
          products.length <= 4
            ? "grid4"
            : products.length <= 6
              ? "grid6"
              : products.length <= 8
                ? "classic8"
                : "grid9";
        appendPage(
          products,
          campaign.pages?.[october ? number - 2 : pages.length]?.layout ||
            campaign.layout ||
            fallback,
          `Page ${number}`,
          october ? number - 2 : undefined,
        );
      }
    }
    appendChunks(
      campaign.products.filter(
        (product) => !Number.isInteger(product.brochurePage),
      ),
    );
    return { pages, sourceIndexes };
  }
  const onCover = new Set(
    coverProducts(campaign).map((product) => String(product.code)),
  );
  appendChunks(
    campaign.products.filter((product) => !onCover.has(String(product.code))),
  );
  return { pages, sourceIndexes };
}

export function splitPages(campaign: Campaign) {
  return buildPages(campaign).pages;
}

// Materialize only after an explicit edit, so loading a saved design is pure.
export function materializeProductPages(campaign: Campaign) {
  if (campaign.autoProductLayout !== true) return;
  const covers = coverProducts(campaign);
  const { pages, sourceIndexes } = buildPages(campaign);
  if (
    (campaign.brochureVisualStyle === "october" ||
      campaign.brochurePresetId === "neptun-october") &&
    campaign.products.some((product) => Number.isInteger(product.brochurePage))
  ) {
    const firstTarget = new Map<number, number>();
    sourceIndexes.forEach((source, index) => {
      if (!firstTarget.has(source)) firstTarget.set(source, index);
    });
    const sourceCount = Math.max(
      0,
      ...campaign.products.map((product) => (product.brochurePage || 1) - 1),
    );
    const delta = pages.length - sourceCount;
    const targetIndex = (source: number) =>
      firstTarget.get(source) ??
      (source >= sourceCount ? source + delta : source);
    if (sourceIndexes.some((source, index) => source !== index)) {
      const prior = campaign.pages || {};
      campaign.pages = Object.fromEntries(
        Object.entries(prior)
          .filter(([key]) => !firstTarget.has(Number(key)))
          .map(([key, value]) => [
            Number.isInteger(Number(key)) ? targetIndex(Number(key)) : key,
            value,
          ]),
      );
      pages.forEach((page, index) => {
        const config = prior[sourceIndexes[index]!];
        if (config) campaign.pages![page.index] = { ...config };
      });
      if (campaign.pageArtworks)
        campaign.pageArtworks = Object.fromEntries(
          Object.entries(campaign.pageArtworks).map(([key, value]) => {
            const match = /^product-(\d+)$/.exec(key);
            return [
              match ? `product-${targetIndex(Number(match[1]))}` : key,
              value,
            ];
          }),
        );
      for (const comment of campaign.reviewComments || []) {
        if (!comment.id) continue;
        const index =
          campaign.reviewPagePlacements?.[comment.id] ?? comment.pageIndex;
        if (typeof index !== "number" || index < 1) continue;
        const next = targetIndex(index - 1) + 1;
        if (next !== index) {
          campaign.reviewPagePlacements ||= {};
          campaign.reviewPagePlacements[comment.id] = next;
        }
      }
    }
  }
  covers.forEach((product) => {
    product.brochurePage = 1;
  });
  pages.forEach((page) =>
    page.products.forEach((product, index) => {
      product.brochurePage = page.index + 2;
      product.brochureOrder = index + 1;
    }),
  );
}

// Selecting a grid is an explicit reflow of this group. Keep every other
// page's composition and shift its configuration/artwork together.
export function applyProductPageLayout(
  campaign: Campaign,
  pageIndex: number,
  layout: string,
) {
  const current = splitPages(campaign);
  const selected = current[pageIndex];
  if (!selected) return false;
  const chunks: Product[][] = [];
  const manual: Partial<Campaign> = { layout, autoProductLayout: false };
  for (let offset = 0; offset < selected.products.length;) {
    const chunk = productPageChunk(
      manual,
      selected.products.slice(offset),
      0,
    ).products;
    chunks.push(chunk);
    offset += chunk.length;
  }
  if (!chunks.length) chunks.push([]);
  const delta = chunks.length - 1;
  const prior = campaign.pages || {};
  campaign.pages = {};
  for (const [key, value] of Object.entries(prior)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) campaign.pages[key] = value;
    else if (index >= current.length) campaign.pages[index + delta] = value;
  }
  current.forEach((page, index) => {
    if (index === pageIndex) return;
    const target = index > pageIndex ? index + delta : index;
    campaign.pages![target] = { ...prior[index], layout: page.layout };
  });
  chunks.forEach((_, offset) => {
    campaign.pages![pageIndex + offset] = { ...prior[pageIndex], layout };
  });
  if (campaign.pageArtworks && delta) {
    campaign.pageArtworks = Object.fromEntries(
      Object.entries(campaign.pageArtworks).map(([key, value]) => {
        const match = /^product-(\d+)$/.exec(key);
        const index = match ? Number(match[1]) : -1;
        return [index > pageIndex ? `product-${index + delta}` : key, value];
      }),
    );
  }
  if (delta) {
    for (const comment of campaign.reviewComments || []) {
      if (!comment.id) continue;
      const index =
        campaign.reviewPagePlacements?.[comment.id] ?? comment.pageIndex;
      if (typeof index === "number" && index > pageIndex + 1) {
        campaign.reviewPagePlacements ||= {};
        campaign.reviewPagePlacements[comment.id] = index + delta;
      }
    }
  }
  const covers = coverProducts(campaign);
  const ordered = [
    ...current.slice(0, pageIndex).map((page) => page.products),
    ...chunks,
    ...current.slice(pageIndex + 1).map((page) => page.products),
  ];
  covers.forEach((product) => {
    product.brochurePage = 1;
  });
  ordered.forEach((products, index) =>
    products.forEach((product, order) => {
      product.brochurePage = index + 2;
      product.brochureOrder = order + 1;
    }),
  );
  return true;
}

// Review records are server-owned. Their display anchors are design metadata
// so a page reflow cannot accidentally edit the review text or workflow.
export function reviewCommentsForLayout(campaign: Partial<Campaign>) {
  return (campaign.reviewComments || []).map((comment) => {
    const index = comment.id
      ? campaign.reviewPagePlacements?.[comment.id]
      : undefined;
    return Number.isInteger(index) && index !== undefined && index >= 0
      ? { ...comment, pageIndex: index }
      : comment;
  });
}

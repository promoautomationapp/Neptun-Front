import type { Artwork, Box, Campaign, Product } from "../../domain/models";
import source from "./blackFridayReference.json";
import type { SourceDetail } from "./BlackFridayDetails";
import { airConditionerFeatures } from "./productArtwork";
import { coverProductPlacement } from "./coverElements";

export const BLACK_FRIDAY_ID = "neptun-black-friday";
export const BLACK_COLLECTION_ID = "neptun-black-collection";
export const BLACK_FRIDAY_ASPECT = 297 / 420;
export interface BlackFridayFrame extends Box {
  code?: string;
  brandImage?: string;
  priceParts?: (Box & { fill?: string; type?: string })[];
  productArtworks?: (Artwork & {
    imageUrl?: string;
    pointSize?: number;
    align?: Artwork["textAlign"];
    uppercase?: boolean;
  })[];
  detailRects?: SourceDetail[];
  copyStyle?: { pointSize: number; fontFamily: string; fontWeight: number };
  order: number;
  model: string;
  sourceImage?: string;
  photo?: Box | null;
  copy?: Box | null;
  price?: Box | null;
  specs?: Box | null;
  saving?: Box | null;
  brand?: Box | null;
}
interface SourceArtwork extends Omit<Artwork, "textAlign"> {
  imageUrl?: string;
  align?: Artwork["textAlign"];
  italic?: boolean;
  uppercase?: boolean;
}
interface SourcePage {
  number: number;
  frames: BlackFridayFrame[];
  artworks: SourceArtwork[];
}
export const blackFridayReference = source as unknown as {
  background: string;
  pages: SourcePage[];
};
export const isBlackCollectionBrochure = (campaign: Partial<Campaign>) =>
  campaign.brochurePresetId === BLACK_COLLECTION_ID ||
  campaign.brochureReferenceDesign === "black-collection";
export const isBlackFridayBrochure = (campaign: Partial<Campaign>) =>
  campaign.brochurePresetId === BLACK_FRIDAY_ID ||
  campaign.brochureReferenceDesign === "black-friday" ||
  isBlackCollectionBrochure(campaign);

export function blackFridayPage(number: number) {
  return blackFridayReference.pages.find((page) => page.number === number);
}

/** Source text frames use page-height percentages; editor typography uses page width. */
export function blackFridayPageArtworks(): NonNullable<
  Campaign["pageArtworks"]
> {
  return Object.fromEntries(
    blackFridayReference.pages.map((page) => [
      page.number === 1
        ? "cover"
        : page.number === 13
          ? "stores"
          : `product-${page.number - 2}`,
      page.artworks.map(
        (artwork) =>
          Object.fromEntries(
            Object.entries({
              ...artwork,
              image: artwork.image || artwork.imageUrl,
              text: artwork.text
                ? sourceText(
                    artwork.uppercase
                      ? artwork.text.toLocaleUpperCase("sq")
                      : artwork.text,
                  )
                : undefined,
              fontSize: artwork.fontSize
                ? artwork.fontSize / BLACK_FRIDAY_ASPECT
                : undefined,
              fontFamily: sourceFont(artwork.fontFamily),
              textRuns: artwork.textRuns?.map((run) => ({
                ...run,
                text: sourceText(
                  artwork.uppercase
                    ? run.text.toLocaleUpperCase("sq")
                    : run.text,
                ),
              })),
              whiteSpace:
                artwork.whiteSpace ||
                (artwork.type === "text" &&
                (artwork.text || "").length < 40 &&
                !/\n/.test(artwork.text || "")
                  ? "nowrap"
                  : "pre-wrap"),
              fontStyle: artwork.italic
                ? ("italic" as const)
                : ("normal" as const),
              textAlign: artwork.align || "left",
              lineHeight: artwork.lineHeight || 1.08,
              zIndex: artwork.zIndex ?? 2,
            }).filter(([, value]) => value !== undefined),
          ) as unknown as Artwork,
      ),
    ]),
  );
}

export function blackFridayDesignDefaults(): Partial<Campaign> {
  return {
    brochureVisualStyle: "current",
    brochureReferenceDesign: "black-friday",
    brochureFormat: "a3",
    layout: "grid6portrait",
    autoProductLayout: false,
    offerStyle: "current",
    priceLogo: "symbol",
    installments: 12,
    savingMode: "amount",
    automaticSavings: {
      enabled: true,
      amountThreshold: 30,
      basis: "offer-price",
    },
    coverTemplate: "blueClean",
    coverProductLayout: "hero",
    coverProductLayoutManual: false,
    coverLogoSource: "/brochure-presets/black-friday/cover-logo.png",
    coverBackgroundColor: "#111213",
    coverBackgroundGradient: null,
    coverBackgroundImage: blackFridayReference.background,
    productBackgroundColor: "#111213",
    productBackgroundGradient: null,
    productBackgroundImage: blackFridayReference.background,
    storesBackgroundColor: "#111213",
    storesBackgroundGradient: null,
    storesBackgroundImage: blackFridayReference.background,
    showCoverBand: false,
    showCoverLogo: false,
    showCoverMessage: false,
    showCoverHeadline: false,
    showCoverGradient: false,
    coverImage: "",
    coverBrandTagline: "",
    includeStoresPage: true,
    includeStoresFooter: false,
    showInteriorFooter: false,
    showFooterPageNumber: false,
    brochureFooter: { visible: false },
    pageArtworks: blackFridayPageArtworks(),
    pricePalette: {
      red: "#ef4023",
      blue: "#003870",
      blueBand: "#343434",
      saving: "#000000",
    },
    pageDecorationDefaults: {
      showHeader: false,
      showOnlineLogo: false,
      showFooterLogo: false,
      showFooterLine: false,
    },
  };
}

/** A reusable black catalogue, independent of the original campaign promotion. */
export function blackCollectionDesignDefaults(): Partial<Campaign> {
  return {
    ...blackFridayDesignDefaults(),
    brochureReferenceDesign: "black-collection",
    brandLogoMode: "white",
    autoProductLayout: true,
    includeStoresPage: false,
    pageArtworks: {
      cover: [
        {
          id: "black-collection-logo",
          type: "image",
          name: "NEPTUN",
          image: "/brochure-presets/black-friday/cover-logo.png",
          x: 30,
          y: 3,
          width: 40,
          height: 7.5,
          imageFit: "contain",
          zIndex: 3,
        },
        {
          id: "black-collection-title",
          type: "text",
          name: "Campaign title",
          text: "Titulli i fushatës",
          x: 5,
          y: 14,
          width: 90,
          height: 7,
          color: "#ffffff",
          fontFamily: "Cera Pro",
          fontSize: 5.2,
          fontWeight: 900,
          textAlign: "center",
          whiteSpace: "pre-wrap",
          zIndex: 3,
        },
      ],
    },
  };
}

/** Reference positions are used only when the imported page has the same offer
 * count. Other brochures receive a complete editable grid, never missing slots. */
export function blackFridayFrames(
  number: number,
  products: readonly Product[],
  campaign: Partial<Campaign> = {},
): BlackFridayFrame[] {
  const page = blackFridayPage(number);
  if (
    !isBlackCollectionBrochure(campaign) &&
    page?.frames.length === products.length
  )
    return page.frames;
  const count = products.length;
  if (number === 1 && isBlackCollectionBrochure(campaign)) {
    const coverCampaign = {
      id: "black-collection",
      name: "Black collection",
      ...campaign,
      products: [...products],
    } as Campaign;
    const placements = products.map((_, index) =>
      coverProductPlacement(coverCampaign, index, count),
    );
    const top = Math.min(...placements.map((frame) => frame.y));
    const bottom = Math.max(
      ...placements.map((frame) => frame.y + frame.height),
    );
    const scale = 67 / Math.max(1, bottom - top);
    return products.map((product, index) => ({
      ...placements[index]!,
      y: 31 + (placements[index]!.y - top) * scale,
      height: placements[index]!.height * scale,
      order: product.brochureOrder || index + 1,
      model: product.name,
    }));
  }
  const columns = count <= 2 ? 1 : count <= 6 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const top = number === 1 ? 31 : 9;
  const bottom = 98;
  const width = (96 - (columns - 1) * 2) / columns;
  const height = (bottom - top - (rows - 1) * 1.5) / Math.max(rows, 1);
  return products.map((product, index) => ({
    x: columns === 1 ? 15 : 2 + (index % columns) * (width + 2),
    y: top + Math.floor(index / columns) * (height + 1.5),
    width: columns === 1 ? 70 : width,
    height,
    order: product.brochureOrder || index + 1,
    model: product.name,
  }));
}

export function sourceText(value: string) {
  return value.replace(/\\n/g, "\n").replace(/\n[ \t]+/g, "\n");
}
export function sourceFont(value?: string) {
  return (
    (
      {
        "Gotham (TT)": "Gotham",
        "Hand Of Sean (Demo)": "Hand Of Sean",
        "Minion Pro": "Minion Pro",
      } as Record<string, string>
    )[value || ""] || value
  );
}
export function blackFridayProductArtworks(
  frame: BlackFridayFrame,
  product?: Product,
): Artwork[] {
  const native = frame.productArtworks || [];
  const optionalLabels = native.filter((artwork) =>
    /\bMODEL\s+I\s+RI\b|^\s*\d+(?:[.,]\d+)?\s*kg\s*$/i.test(
      sourceText(artwork.text || ""),
    ),
  );
  const optionalLabelBackdrop = (artwork: Artwork) =>
    artwork.type === "shape" &&
    optionalLabels.some((label) => {
      const x = label.x + label.width / 2,
        y = label.y + (label.height || 0) / 2;
      return (
        x >= artwork.x &&
        x <= artwork.x + artwork.width &&
        y >= artwork.y &&
        y <= artwork.y + (artwork.height || 0)
      );
    });
  const sameSource = product && product.code === frame.code;
  const supported = product
    ? airConditionerFeatures(
        product,
        sameSource
          ? {
              ...(native.some((item) => item.referenceRole === "wifi")
                ? { wifi: true }
                : {}),
              ...(native.some((item) => /\binverter\b/i.test(item.text || ""))
                ? { inverter: true }
                : {}),
            }
          : {},
      )
    : undefined;
  return native
    .filter(
      (artwork) =>
        !optionalLabels.includes(artwork) &&
        !optionalLabelBackdrop(artwork) &&
        (!product ||
          sameSource ||
          artwork.referenceRole === "wifi" ||
          artwork.referenceRole === "inverter" ||
          artwork.referenceRole === "energy" ||
          /\binverter\b/i.test(artwork.text || "")) &&
        !/BLACK\s+FRIDAY/i.test(artwork.text || "") &&
        (!supported ||
          ((artwork.referenceRole !== "wifi" || supported.wifi) &&
            (!/\binverter\b/i.test(artwork.text || "") || supported.inverter) &&
            (artwork.type !== "energy" || supported.energy))) &&
        (artwork.referenceRole !== "wifi" ||
          artwork.y < (frame.photo?.y || 20)),
    )
    .map(
      (artwork) =>
        Object.fromEntries(
          Object.entries({
            ...artwork,
            text: artwork.text ? sourceText(artwork.text) : undefined,
            image: artwork.image || artwork.imageUrl,
            fontSize: artwork.pointSize
              ? (artwork.pointSize / 841.88976) * 100
              : artwork.fontSize,
            fontFamily: sourceFont(artwork.fontFamily),
            fontStyle: artwork.fontStyle === "italic" ? "italic" : "normal",
            textAlign: artwork.align || artwork.textAlign || "left",
            whiteSpace: "nowrap",
          }).filter(([, value]) => value !== undefined),
        ) as unknown as Artwork,
    );
}

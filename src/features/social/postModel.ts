import { savedDetailEntries } from "../brochure/detailFacts";
import type {
  Campaign,
  Product,
  SocialPost,
  Background,
} from "../../domain/models";
import { normalizeImageBackgroundContext } from "../brochure/imagePreparationContext";
import { isAppleProduct } from "../brochure/priceDesign";
import { isMobilePhone, mobileDetailEntries } from "../brochure/mobileDetails";
import { conditionerDetailEntries } from "../brochure/conditionerDetails";
import { isAirConditioner } from "../brochure/productArtwork";

const IMAGE_PREPARATION_FIELDS = [
  "aiOriginalImage",
  "aiInchesEmbedded",
  "aiPreparationRevision",
  "aiAnnotationStyle",
  "aiPreparedScreenInches",
  "aiBackgroundSignature",
  "aiReviewedImageSource",
  "aiReviewedPreparationRevision",
  "aiReviewedBackgroundSignature",
] as const satisfies readonly (keyof Product)[];

export function postDetailEntries(product: Product): Array<[string, string]> {
  if (Array.isArray(product.brochureDetails))
    return savedDetailEntries(product) ?? [];
  if (isMobilePhone(product) && !isAppleProduct(product))
    return mobileDetailEntries(product, { includeFallback: false });
  if (isAirConditioner(product)) return conditionerDetailEntries(product);
  return Object.entries(product.specs || {}).filter(
    ([, value]) => value != null && String(value).trim(),
  );
}

export function postPriceCampaign(post: Partial<SocialPost> = {}) {
  return { offerStyle: post.priceStyle || "current" };
}

export function postPriceProduct(product: Product) {
  return product.offerStyle || !product.priceStyle
    ? product
    : { ...product, offerStyle: product.priceStyle };
}

export function clearPostImagePreparation(product: Product) {
  IMAGE_PREPARATION_FIELDS.forEach((field) => delete product[field]);
}

export function postImageBackgroundContext(post: SocialPost) {
  const background = post?.background || {};
  return normalizeImageBackgroundContext({
    kind: background.type || "solid",
    color: background.color || "#205184",
    gradient: {
      from: background.from,
      to: background.to,
      angle: background.angle,
    },
    image: background.image,
    ...(background.type === "image" && post?.backgroundPrompt
      ? { description: post.backgroundPrompt }
      : {}),
  });
}

export interface SocialPreset {
  id: string;
  label: string;
  channel: string;
  width: number;
  height: number;
  note: string;
  source?: string;
}
export const SOCIAL_PRESETS: readonly [SocialPreset, ...SocialPreset[]] = [
  {
    id: "ig-feed",
    label: "Instagram feed · portrait",
    channel: "Instagram",
    width: 1080,
    height: 1350,
    note: "4:5 uses more vertical feed space. Keep text and prices away from the edges.",
  },
  {
    id: "ig-square",
    label: "Instagram · square",
    channel: "Instagram",
    width: 1080,
    height: 1080,
    note: "1:1 is useful when the same artwork must work in square grids and feeds.",
  },
  {
    id: "ig-story",
    label: "Instagram Story / Reel",
    channel: "Instagram",
    width: 1080,
    height: 1920,
    note: "9:16 fills a phone screen. Leave room at the top and bottom for app controls.",
  },
  {
    id: "fb-feed",
    label: "Facebook feed · portrait",
    channel: "Facebook",
    width: 1200,
    height: 1500,
    note: "4:5 keeps the product prominent on mobile feeds.",
  },
  {
    id: "fb-landscape",
    label: "Facebook · landscape",
    channel: "Facebook",
    width: 1200,
    height: 675,
    note: "16:9 suits wide placements; important text stays in the center.",
  },
  {
    id: "tiktok",
    label: "TikTok photo / story",
    channel: "TikTok",
    width: 1080,
    height: 1920,
    note: "9:16 is the native full-screen shape. Leave safe space for captions and controls.",
  },
  {
    id: "pinterest",
    label: "Pinterest Pin",
    channel: "Pinterest",
    width: 1000,
    height: 1500,
    note: "2:3 is Pinterest's recommended vertical image ratio. Taller images may be cropped in feed.",
    source: "https://business.pinterest.com/creative-best-practices/",
  },
  {
    id: "linkedin-square",
    label: "LinkedIn · square",
    channel: "LinkedIn",
    width: 1200,
    height: 1200,
    note: "1:1 is recommended for single-image ads across desktop and mobile. Check LinkedIn's file-size limit before uploading.",
    source:
      "https://business.linkedin.com/advertise/ads/sponsored-content/single-image-ads-specs",
  },
  {
    id: "linkedin-wide",
    label: "LinkedIn · landscape",
    channel: "LinkedIn",
    width: 1200,
    height: 628,
    note: "1.91:1 is LinkedIn's recommended landscape single-image shape for desktop and mobile.",
    source:
      "https://business.linkedin.com/advertise/ads/sponsored-content/single-image-ads-specs",
  },
  {
    id: "x-landscape",
    label: "X / web · landscape",
    channel: "X / web",
    width: 1200,
    height: 675,
    note: "16:9 works for wide social cards and web sharing.",
  },
  {
    id: "youtube-thumb",
    label: "YouTube thumbnail",
    channel: "YouTube",
    width: 1920,
    height: 1080,
    note: "16:9 fits video thumbnails. Choose 4K for YouTube's current 3840×2160 recommendation.",
    source: "https://support.google.com/youtube/answer/72431",
  },
  {
    id: "custom",
    label: "Custom size",
    channel: "Custom",
    width: 1080,
    height: 1080,
    note: "Set exact pixel dimensions for a special placement.",
  },
];

export interface QualityPreset {
  id: string;
  label: string;
  longEdge: number;
}
export const QUALITY_PRESETS: readonly [QualityPreset, ...QualityPreset[]] = [
  { id: "hd", label: "Full HD", longEdge: 1920 },
  { id: "2k", label: "2K", longEdge: 2560 },
  { id: "4k", label: "4K", longEdge: 3840 },
  { id: "8k", label: "8K", longEdge: 7680 },
];

export function outputDimensions(post: SocialPost) {
  const preset =
    SOCIAL_PRESETS.find((item) => item.id === post.preset) || SOCIAL_PRESETS[0];
  const width =
    post.preset === "custom"
      ? Math.max(320, Math.min(8192, Number(post.customWidth) || 1080))
      : preset.width;
  const height =
    post.preset === "custom"
      ? Math.max(320, Math.min(8192, Number(post.customHeight) || 1080))
      : preset.height;
  const quality =
    QUALITY_PRESETS.find((item) => item.id === post.quality) ||
    QUALITY_PRESETS[0];
  if (post.preset === "custom" || post.quality === "hd")
    return { width, height };
  const factor = quality.longEdge / Math.max(width, height);
  return {
    width: Math.round(width * factor),
    height: Math.round(height * factor),
  };
}

const POST_PRODUCT_FIELDS = [
  "bundleCodes",
  "bundleProducts",
  "productArtworks",
  "brochureVariants",
  "hideColors",
  "brandLogo",
  "hideBrandLogo",
  "autoSpecsDisabled",
  "hideWarranty",
  "warranty",
  "detailPlacement",
  "detailBlockPlacements",
  "detailBlockStyles",
  "screenAnnotationPlacement",
  "brochureImagePlacement",
  "offerStyle",
  "priceStyle",
  "savingMode",
] as const satisfies readonly (keyof Product)[];
function copyProductFields<Key extends keyof Product>(
  product: Product,
  fields: readonly Key[],
  clone: boolean,
): Partial<Pick<Product, Key>> {
  const copy: Partial<Pick<Product, Key>> = {};
  for (const field of fields) {
    const value = product[field];
    if (value !== undefined)
      copy[field] = clone ? structuredClone(value) : value;
  }
  return copy;
}
export function productForPost(product: Product): Product {
  const brochureDetails = Array.isArray(product.brochureDetails)
    ? product.brochureDetails
        .map((line) =>
          typeof line === "string"
            ? line.trim()
            : { ...line, text: line.text.trim() },
        )
        .filter((line) =>
          typeof line === "string" ? Boolean(line) : Boolean(line.text),
        )
    : null;
  return {
    code: String(product.code || crypto.randomUUID()),
    name: product.name || "Product",
    brand: product.brand || "",
    category: product.category || "",
    subcategory: product.subcategory || "",
    description: product.description || "",
    postDetails: product.postDetails || "",
    specs: product.specs || {},
    ...(brochureDetails ? { brochureDetails } : {}),
    ...(product.screenArtwork
      ? { screenArtwork: structuredClone(product.screenArtwork) }
      : {}),
    ...copyProductFields(product, POST_PRODUCT_FIELDS, true),
    ...copyProductFields(product, IMAGE_PREPARATION_FIELDS, false),
    regular: Number(product.regular) || 0,
    sale: Number(product.sale) || 0,
    image:
      product.image ||
      product.localImage ||
      product.imageUrl ||
      product.originalImage ||
      "",
    imageChoices: [
      ...new Set(
        [
          product.image,
          product.localImage,
          product.imageUrl,
          product.originalImage,
          ...(product.images || []),
        ].filter((item) => typeof item === "string"),
      ),
    ],
    cutoutStatus: product.aiOriginalImage
      ? "done"
      : product.skipAiCutout || product.aiReviewedImageSource === product.image
        ? "skipped"
        : "new",
    skipAiCutout: Boolean(
      product.skipAiCutout || product.aiReviewedImageSource === product.image,
    ),
    x: 50,
    y: 49,
    scale: 52,
    showImage: true,
  };
}

export function createPost(
  products: Product[] = [],
  campaign: Campaign | null = null,
): SocialPost {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: campaign ? `${campaign.name} · social post` : "New social post",
    sourceCampaignId: campaign?.id || null,
    products: products.slice(0, 6).map(productForPost),
    preset: "ig-feed",
    quality: "hd",
    customWidth: 1080,
    customHeight: 1080,
    template: "classic",
    priceStyle:
      campaign?.offerStyle === "compact"
        ? "card"
        : campaign?.offerStyle || "current",
    detailStyle: "chips",
    background: {
      type: "solid",
      color: "#205184",
      from: "#174877",
      to: "#62addb",
      angle: 135,
      image: "",
    },
    textHtml: "",
    showPrice: true,
    showRegular: true,
    showSaving: true,
    savingMode: "money",
    showInstallments: true,
    showDetails: true,
    showSpecs: true,
    showInches: true,
    showNeptunLogo: true,
    neptunLogoUpload: "",
    logoVariant: "white",
    logoLayout: "corner",
    logoScale: 100,
    logoPosition: "top-left",
    showEventLogo: true,
    eventLogoUpload: campaign?.campaignLogo || "",
    eventLogo: "happy-day",
    eventPosition: "top-right",
    eventScale: 100,
    customLogo: "",
    customLogoPosition: "bottom-left",
    customLogoScale: 100,
    showCustomLogo: false,
    artworks: [],
    createdAt: now,
    updatedAt: now,
    revision: 0,
    aiReviewedFields: {},
  };
}

export function cssBackground(background?: Background): string {
  if (background?.type === "image" && background.image)
    return `url("${String(background.image).replaceAll('"', "%22")}") center / cover no-repeat`;
  if (background?.type === "gradient")
    return `linear-gradient(${Number(background.angle) || 135}deg, ${background.from || "#174877"}, ${background.to || "#62addb"})`;
  return background?.color || "#205184";
}

export function reorderByCode(
  products: Product[],
  source: string | null | undefined,
  target: string | null | undefined,
) {
  if (source === target) return products;
  const list = [...products];
  const start = list.findIndex((item) => item.code === source);
  const end = list.findIndex((item) => item.code === target);
  if (start < 0 || end < 0) return products;
  list.splice(end, 0, ...list.splice(start, 1));
  return list;
}

/** Grid affects product placements only; independent artwork layers stay untouched. */
export function layoutSocialProducts(
  products: readonly Product[],
  grid: { rows: number; columns: number; gap: number },
): Product[] {
  const columns = Math.max(1, Math.min(6, Math.round(grid.columns) || 1));
  const rows = Math.max(
    1,
    Math.min(6, Math.round(grid.rows) || 1),
    Math.ceil(products.length / columns),
  );
  const gap = Math.max(0, Math.min(20, grid.gap || 0));
  const cellWidth = 84 / columns;
  const cellHeight = 54 / rows;
  return products.map((product, index) => ({
    ...product,
    positioned: true,
    x: 8 + ((index % columns) + 0.5) * cellWidth,
    y: 22 + (Math.floor(index / columns) + 0.5) * cellHeight,
    scale: Math.max(10, Math.min(70, cellWidth - gap, cellHeight * 1.25)),
  }));
}

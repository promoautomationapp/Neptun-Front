import { coverMessageVisible } from "./coverPresentation";
import type { Campaign, Placement } from "../../domain/models";
import { coverProducts } from "./campaignPages";
import { productPageChunk } from "./brochureLayout";
type CoverPlacement = Placement & { x: number; y: number; width: number };
export const COVER_ELEMENT_DEFAULTS: Record<string, CoverPlacement> = {
  logo: { x: 27, y: 4, width: 46 },
  headline: { x: 10, y: 15, width: 85 },
  band: { x: 0, y: 25, width: 100 },
  message: { x: 47, y: 40, width: 49 },
  gradient: { x: 0, y: 13, width: 100, height: 30 },
};
export const COVER_GRADIENT_REGIONS: Record<
  string,
  CoverPlacement | undefined
> = {
  between: COVER_ELEMENT_DEFAULTS.gradient,
  whole: { x: 0, y: 0, width: 100, height: 100 },
  right: { x: 60, y: 0, width: 40, height: 100 },
  bottom: { x: 0, y: 50, width: 100, height: 50 },
};
export function coverElementPlacement(
  campaign: Pick<Campaign, "coverElementPlacements" | "showCoverBand" | "showCoverHeadline">,
  kind: string,
): CoverPlacement {
  return {
    x: 0,
    y: 0,
    width: 100,
    ...COVER_ELEMENT_DEFAULTS[kind],
    ...(kind === "message" && campaign.showCoverBand !== true
      ? { x: 10, y: campaign.showCoverHeadline === false ? 17 : 25, width: 80 }
      : {}),
    ...campaign.coverElementPlacements?.[kind],
  };
}
export function coverGradientFill(
  campaign: Pick<Campaign, "coverOverlayGradient">,
) {
  const value = campaign.coverOverlayGradient || {};
  const color = (value: string | undefined, fallback: string) =>
    /^#[\da-f]{6}$/i.test(value || "") ? value : fallback;
  return `linear-gradient(${Number.isFinite(Number(value.angle)) ? Number(value.angle) : 90}deg, ${color(value.from, "#0d5192")}, ${color(value.to, "#58a5ce")})`;
}

export function coverProductPlacement(
  campaign: Campaign,
  index: number,
  count: number,
) {
  const belowBand = campaign.showCoverBand === true;
  const messageAboveProducts = !belowBand && coverMessageVisible(campaign);
  const selectedCode = !belowBand && campaign.coverBannerProductCode;
  const heroY = messageAboveProducts ? (campaign.showCoverHeadline === false ? 24 : 34) : campaign.showCoverHeadline === false ? 18 : 26;
  const heroHeight = 64 - heroY;
  const covers = selectedCode ? coverProducts(campaign) : [];
  const featuredIndex = covers.findIndex(
    (item) => String(item.code) === String(selectedCode),
  );
  if (featuredIndex >= 0) {
    if (index === featuredIndex)
      return { x: 4, y: heroY, width: 92, height: heroHeight };
    const secondaryIndex = index > featuredIndex ? index - 1 : index;
    return count === 2
      ? {
          x: 6,
          y: messageAboveProducts ? 68 : 67,
          width: 88,
          height: messageAboveProducts ? 22 : 23,
        }
      : {
          x: 4 + secondaryIndex * 48,
          y: messageAboveProducts ? 68 : 67,
          width: 44,
          height: messageAboveProducts ? 22 : 23,
        };
  }
  const mode = campaign.coverProductLayout || (count >= 3 ? "hero" : "pair");
  if (mode === "hero" && count >= 3)
    return index === 0
      ? { x: 4, y: heroY, width: 92, height: heroHeight }
      : {
          x: 4 + ((index - 1) % 2) * 48,
          y:
            (messageAboveProducts ? 68 : 67) + Math.floor((index - 1) / 2) * 25,
          width: 44,
          height: messageAboveProducts ? 22 : 23,
        };
  if (mode === "row")
    return {
      x: 4 + (index * 92) / count,
      y: belowBand ? 54 : 46,
      width: 92 / count - 2,
      height: belowBand ? 36 : 42,
    };
  if (count === 1)
    return belowBand
      ? { x: 6, y: 54, width: 88, height: 36 }
      : { x: 6, y: 35, width: 88, height: 53 };
  return {
    x: 4 + (index % 2) * 48,
    y: belowBand
      ? 54
      : count > 2
        ? (messageAboveProducts ? 34 : 29) +
          Math.floor(index / 2) * (messageAboveProducts ? 28 : 30)
        : 48,
    width: 44,
    height: belowBand ? 36 : count > 2 ? (messageAboveProducts ? 26 : 29) : 40,
  };
}

interface CoverFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}
const COVER_GAP = 2;
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
function coverFrame(
  value: Placement | undefined,
  fallback: CoverFrame,
): CoverFrame {
  const data = { ...fallback, ...value };
  const width = clamp(Number(data.width) || fallback.width, 20, 92);
  const height = clamp(Number(data.height) || fallback.height, 18, 88);
  return {
    x: clamp(
      Number.isFinite(Number(data.x)) ? Number(data.x) : fallback.x,
      4,
      96 - width,
    ),
    y: clamp(
      Number.isFinite(Number(data.y)) ? Number(data.y) : fallback.y,
      4,
      92 - height,
    ),
    width,
    height,
  };
}
function clearCoverBand(
  campaign: Pick<Campaign, "showCoverBand">,
  frame: CoverFrame,
): CoverFrame {
  if (
    campaign.showCoverBand !== true ||
    frame.y >= 54 ||
    frame.y + frame.height <= 25
  )
    return frame;
  return { ...frame, y: 54, height: Math.min(frame.height, 34) };
}
function conflicts(frame: CoverFrame, placed: CoverFrame[]) {
  return placed.some(
    (other) =>
      frame.x < other.x + other.width + COVER_GAP &&
      frame.x + frame.width + COVER_GAP > other.x &&
      frame.y < other.y + other.height + COVER_GAP &&
      frame.y + frame.height + COVER_GAP > other.y,
  );
}
function nextClearFrame(
  frame: CoverFrame,
  placed: CoverFrame[],
): CoverFrame | null {
  if (!conflicts(frame, placed)) return frame;
  const ys = [
    ...new Set([
      frame.y,
      ...placed.map((other) => other.y + other.height + COVER_GAP),
    ]),
  ]
    .filter((y) => y >= frame.y && y + frame.height <= 92)
    .sort((a, b) => a - b);
  for (const y of ys) {
    const xs = [
      ...new Set([
        frame.x,
        4,
        ...placed.map((other) => other.x + other.width + COVER_GAP),
      ]),
    ]
      .filter((x) => x >= 4 && x + frame.width <= 96)
      .sort((a, b) => a - b);
    for (const x of xs) {
      const candidate = { ...frame, x, y };
      if (!conflicts(candidate, placed)) return candidate;
    }
  }
  return null;
}

function nextProductPage(
  campaign: Campaign,
  product: Campaign["products"][number],
): number {
  for (let page = 2; page <= campaign.products.length + 2; page += 1) {
    const current = campaign.products.filter(
      (item) => item.brochurePage === page,
    );
    const proposed = [...current, product];
    if (
      productPageChunk(campaign, proposed, page - 2).products.length ===
      proposed.length
    )
      return page;
  }
  return campaign.products.length + 2;
}

// Cover products use free-positioned frames, so CSS grid reflow cannot keep
// them apart. Pack around the edited frame and send overflow to product pages.
export function applyCoverProductPlacement(
  campaign: Campaign,
  kind: string,
  requested: Placement,
): boolean {
  if (!kind.startsWith("product-")) return false;
  const code = kind.slice("product-".length);
  const covers = coverProducts(campaign);
  const editedIndex = covers.findIndex(
    (product) => String(product.code) === code,
  );
  if (editedIndex < 0) return false;
  campaign.coverElementPlacements ||= {};
  const frameFor = (product: (typeof covers)[number], index: number) => {
    const key = `product-${product.code}`;
    return clearCoverBand(
      campaign,
      coverFrame(
        key === kind ? requested : campaign.coverElementPlacements?.[key],
        coverProductPlacement(campaign, index, covers.length),
      ),
    );
  };
  const anchor = frameFor(covers[editedIndex]!, editedIndex);
  const placed = [anchor];
  const kept = new Set([code]);
  campaign.coverElementPlacements[kind] = anchor;
  const overflow: typeof covers = [];
  covers.forEach((product, index) => {
    if (index === editedIndex) return;
    const key = `product-${product.code}`;
    const next = nextClearFrame(frameFor(product, index), placed);
    if (next) {
      placed.push(next);
      kept.add(String(product.code));
      campaign.coverElementPlacements![key] = next;
    } else {
      overflow.push(product);
      delete campaign.coverElementPlacements![key];
    }
  });
  if (overflow.length) {
    const positioned = campaign.products.some((product) =>
      Number.isInteger(product.brochurePage),
    );
    if (positioned)
      overflow.forEach((product) => {
        product.brochurePage = nextProductPage(campaign, product);
        delete product.brochureOrder;
      });
    else
      campaign.coverProductCodes = covers
        .filter((product) => kept.has(String(product.code)))
        .map((product) => String(product.code));
  }
  return true;
}

// Repair old saved frames on load without changing valid custom arrangements.
// The returned campaign is a copy, ready for editor preview and export.
export function repairCoverProductLayout(campaign: Campaign): Campaign {
  const covers = coverProducts(campaign);
  if (!covers.length) return campaign;
  const frames = covers.map((product, index) => {
    const key = `product-${product.code}`;
    return coverFrame(
      campaign.coverElementPlacements?.[key],
      coverProductPlacement(campaign, index, covers.length),
    );
  });
  const repaired = frames.map((frame) => clearCoverBand(campaign, frame));
  const needsRepair = covers.some((product, index) => {
    const saved = campaign.coverElementPlacements?.[`product-${product.code}`];
    const next = repaired[index]!;
    if (
      saved &&
      (Number(saved.x) !== next.x ||
        Number(saved.y) !== next.y ||
        Number(saved.width) !== next.width ||
        Number(saved.height) !== next.height)
    )
      return true;
    return conflicts(next, repaired.slice(0, index));
  });
  if (!needsRepair) return campaign;
  const result: Campaign = {
    ...campaign,
    products: campaign.products.map((product) => ({ ...product })),
    coverElementPlacements: { ...campaign.coverElementPlacements },
    coverProductCodes: campaign.coverProductCodes
      ? [...campaign.coverProductCodes]
      : undefined,
  };
  applyCoverProductPlacement(
    result,
    `product-${covers[0]!.code}`,
    repaired[0]!,
  );
  return result;
}

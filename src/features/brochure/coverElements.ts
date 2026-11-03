import { coverMessageVisible } from "./coverPresentation";
import type { Campaign, Placement } from "../../domain/models";
import { coverProducts } from "./campaignPages";
import { isOctoberBrochure } from "./octoberDesign";
type CoverPlacement = Placement & { x: number; y: number; width: number };
export const COVER_ELEMENT_DEFAULTS: Record<string, CoverPlacement> = {
  logo: { x: 27, y: 4, width: 46 },
  headline: { x: 10, y: 15, width: 85 },
  band: { x: 0, y: 25, width: 100 },
  message: { x: 47, y: 39.5, width: 49, height: 7.5 },
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
  campaign: Pick<
    Campaign,
    "coverElementPlacements" | "showCoverBand" | "showCoverHeadline"
  >,
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

/** The campaign ribbon has its own horizontal paint, independent of the page. */
export function coverRibbonColors(
  campaign: Pick<Campaign, "coverRibbonColors">,
) {
  const color = (value: string | undefined, fallback: string) =>
    /^#[\da-f]{6}$/i.test(value || "") ? value! : fallback;
  return {
    from: color(campaign.coverRibbonColors?.from, "#144c83"),
    to: color(campaign.coverRibbonColors?.to, "#70acdc"),
  };
}

interface CoverGridArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Balanced rows keep their final row centered and leave room between cards. */
function gridPlacement(
  area: CoverGridArea,
  index: number,
  count: number,
  columns: number,
) {
  const rows = Math.ceil(count / columns);
  const gap = Math.min(
    2.5,
    area.width / Math.max(1, columns * 8),
    area.height / Math.max(1, rows * 8),
  );
  const width = (area.width - gap * (columns - 1)) / columns;
  const height = (area.height - gap * (rows - 1)) / rows;
  const row = Math.floor(index / columns);
  const rowCount = Math.min(columns, count - row * columns);
  const inset = (area.width - (rowCount * width + (rowCount - 1) * gap)) / 2;
  return {
    x: area.x + inset + (index % columns) * (width + gap),
    y: area.y + row * (height + gap),
    width,
    height,
  };
}
function balancedColumns(area: CoverGridArea, count: number) {
  let best = 1,
    cost = Infinity;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const frame = gridPlacement(area, 0, count, columns);
    const aspect = (frame.width * 0.8) / frame.height;
    const candidate =
      Math.abs(Math.log(aspect)) +
      ((rows * columns - count) / count) * 1.4 +
      rows * 0.02;
    if (candidate < cost) {
      best = columns;
      cost = candidate;
    }
  }
  return best;
}
function featuredPlacement(
  area: CoverGridArea,
  index: number,
  count: number,
  main: number,
) {
  const secondaryCount = count - 1;
  const columns =
    secondaryCount <= 3 ? secondaryCount : Math.ceil(Math.sqrt(secondaryCount));
  const rows = Math.ceil(secondaryCount / columns);
  const gap = Math.min(4, area.height / (rows + 1) / 6);
  const height = (area.height - gap * rows) / (rows + 1);
  if (index === main) return { ...area, height };
  return gridPlacement(
    { ...area, y: area.y + height + gap, height: area.height - height - gap },
    index > main ? index - 1 : index,
    secondaryCount,
    columns,
  );
}

export function coverProductPlacement(
  campaign: Campaign,
  index: number,
  count: number,
) {
  const band = isOctoberBrochure(campaign) || campaign.showCoverBand === true;
  if (band && count > 2) {
    const area = isOctoberBrochure(campaign)
      ? { x: 3.85, y: 56.8, width: 92.5, height: 35.2 }
      : { x: 4, y: 54, width: 92, height: 36 };
    return gridPlacement(
      area,
      index,
      count,
      count === 3 ? 3 : balancedColumns(area, count),
    );
  }
  if (!band && count > 3) {
    const covers = campaign.coverBannerProductCode
      ? coverProducts(campaign)
      : [];
    const chosen = covers.findIndex(
      (product) =>
        String(product.code) === String(campaign.coverBannerProductCode),
    );
    const featured =
      chosen >= 0 || (campaign.coverProductLayout || "hero") === "hero";
    const reference =
      campaign.coverBandVariant === "hajde" ||
      campaign.brochureFooter?.style === "reference";
    const top = reference
      ? 12
      : coverMessageVisible(campaign)
        ? campaign.showCoverHeadline === false
          ? 24
          : 34
        : campaign.showCoverHeadline === false
          ? 18
          : 26;
    const area = {
      x: reference ? 2.25 : 4,
      y: top,
      width: reference ? 95.5 : 92,
      height: 92 - top,
    };
    return featured
      ? featuredPlacement(area, index, count, Math.max(0, chosen))
      : gridPlacement(area, index, count, balancedColumns(area, count));
  }
  if (campaign.coverBandVariant === "hajde" && count >= 3) {
    return index === 0
      ? { x: 3, y: 19, width: 94, height: 35 }
      : { x: 3 + (index - 1) * 49, y: 58, width: 45, height: 34 };
  }
  if (isOctoberBrochure(campaign))
    return { x: 3.85 + (index % 2) * 48, y: 56.8, width: 44.5, height: 35.2 };
  const belowBand = campaign.showCoverBand === true;
  const messageAboveProducts = !belowBand && coverMessageVisible(campaign);
  const selectedCode = !belowBand && campaign.coverBannerProductCode;
  const heroY = messageAboveProducts
    ? campaign.showCoverHeadline === false
      ? 24
      : 34
    : campaign.showCoverHeadline === false
      ? 18
      : 26;
  const heroHeight = 64 - heroY;
  const covers = selectedCode ? coverProducts(campaign) : [];
  const featuredIndex = covers.findIndex(
    (item) => String(item.code) === String(selectedCode),
  );
  if (
    campaign.brochureFooter?.style === "reference" &&
    !belowBand &&
    count >= 3 &&
    (featuredIndex >= 0 || campaign.coverProductLayout === "hero")
  ) {
    const main = featuredIndex >= 0 ? featuredIndex : 0;
    if (index === main) return { x: 2.25, y: 12, width: 95.5, height: 38 };
    const secondary = index > main ? index - 1 : index;
    return { x: 2.25 + secondary * 49, y: 54, width: 46.5, height: 38 };
  }
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
  const width = clamp(
    Number(data.width) || fallback.width,
    Math.min(20, fallback.width),
    Math.max(92, fallback.width),
  );
  const height = clamp(
    Number(data.height) || fallback.height,
    Math.min(18, fallback.height),
    88,
  );
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

// Cover products use free-positioned frames, so CSS grid reflow cannot keep
// them apart. Pack around the edited frame; if space runs out, reflow the
// cover instead of silently changing the products assigned to page one.
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
  campaign.coverElementPlacements[kind] = anchor;
  const overflow: typeof covers = [];
  covers.forEach((product, index) => {
    if (index === editedIndex) return;
    const key = `product-${product.code}`;
    const next = nextClearFrame(frameFor(product, index), placed);
    if (next) {
      placed.push(next);
      campaign.coverElementPlacements![key] = next;
    } else {
      overflow.push(product);
      delete campaign.coverElementPlacements![key];
    }
  });
  if (overflow.length) {
    covers.forEach((product, index) => {
      campaign.coverElementPlacements![`product-${product.code}`] =
        coverProductPlacement(campaign, index, covers.length);
    });
  }
  return true;
}

// Repair old saved frames on load without changing valid custom arrangements.
// The returned campaign is a copy, ready for editor preview and export.
export function repairCoverProductLayout(campaign: Campaign): Campaign {
  const covers = coverProducts(campaign);
  if (!covers.length) return campaign;
  const savedFrames = covers.some(
    (product) => campaign.coverElementPlacements?.[`product-${product.code}`],
  );
  // Automatic grids already fit their reserved region. Do not clamp/repack
  // dense cards or rewrite valid manual arrangements just by opening a file.
  if (
    !savedFrames ||
    covers.length >
      (isOctoberBrochure(campaign) || campaign.showCoverBand === true ? 2 : 3)
  )
    return campaign;
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

/** Scale default card typography/details with the available frame, without
 * changing saved content-region positions or the physical product photograph. */
export function coverProductDensity(
  campaign: Campaign,
  index: number,
  count: number,
) {
  if (
    count <=
    (isOctoberBrochure(campaign) || campaign.showCoverBand === true ? 2 : 3)
  )
    return 1;
  const frame = coverProductPlacement(campaign, index, count);
  const featured =
    !(isOctoberBrochure(campaign) || campaign.showCoverBand === true) &&
    (campaign.coverProductLayout || "hero") === "hero" &&
    (campaign.coverBannerProductCode
      ? String(coverProducts(campaign)[index]?.code) ===
        String(campaign.coverBannerProductCode)
      : index === 0);
  return Math.min(
    1,
    frame.width / (featured ? 95.5 : 44.5),
    frame.height / (featured ? 38 : 35.2),
  );
}

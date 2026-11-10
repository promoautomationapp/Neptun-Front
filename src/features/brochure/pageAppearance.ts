import type { CSSProperties } from "react";
import type { Campaign, PageAppearance, PageLayout } from "../../domain/models";
import {
  pageBackgroundReadability,
  pageImageBackgroundContext,
  validBackgroundColor,
  validBackgroundGradient,
  validBackgroundImage,
} from "./pageBackground";
import type { BackgroundPage } from "./pageBackground";
import { colorContrast } from "./backgroundContrast";

export type PageAppearanceKind = "cover" | "product" | "stores";
export type BackgroundValues = Pick<
  PageLayout,
  "backgroundColor" | "backgroundGradient" | "backgroundImage"
>;
export type AppearancePage = BackgroundPage & { index?: number };
export interface ResolvedPageAppearance {
  textColor: string;
  brandColor: string;
  screenLabelColor: string;
  priceStyle: "current" | "card";
  light: boolean;
}
export function pageAppearanceKey(
  kind: PageAppearanceKind,
  pageIndex?: number,
) {
  return kind === "product" && Number.isInteger(pageIndex)
    ? `product-${pageIndex}`
    : kind;
}
export function pageAppearanceFor(
  campaign: Partial<Campaign>,
  kind: PageAppearanceKind,
  page?: AppearancePage,
): PageAppearance {
  return (
    campaign.pageAppearances?.[pageAppearanceKey(kind, page?.index)] ||
    (kind === "product" ? campaign.pageAppearances?.product : undefined) ||
    {}
  );
}
export function hasPageAppearance(
  campaign: Partial<Campaign>,
  kind: PageAppearanceKind,
  page?: AppearancePage,
) {
  return Boolean(
    campaign.pageAppearances?.[pageAppearanceKey(kind, page?.index)] ||
    (kind === "product" && campaign.pageAppearances?.product),
  );
}
export function resolvedPageAppearance(
  campaign: Partial<Campaign>,
  kind: PageAppearanceKind,
  page?: AppearancePage,
): ResolvedPageAppearance {
  const saved = pageAppearanceFor(campaign, kind, page);
  const readability = pageBackgroundReadability(campaign, kind, page);
  const textColor =
    validBackgroundColor(saved.textColor) ||
    (readability.light ? "#000000" : readability.foreground);
  const nativePrice = ["card", "compact"].includes(campaign.offerStyle || "")
    ? "card"
    : "current";
  const priceStyle =
    saved.priceStyle === "card" || saved.priceStyle === "current"
      ? saved.priceStyle
      : hasPageAppearance(campaign, kind, page)
        ? readability.light
          ? "card"
          : "current"
        : nativePrice;
  return {
    textColor,
    brandColor:
      validBackgroundColor(saved.brandColor) ||
      validBackgroundColor(campaign.brandLogoColor) ||
      (readability.light ? "#343534" : "#ffffff"),
    screenLabelColor: validBackgroundColor(saved.screenLabelColor) || textColor,
    priceStyle,
    light: readability.light,
  };
}
function cleanAppearance(value: PageAppearance): PageAppearance {
  const result: PageAppearance = {};
  for (const key of ["textColor", "brandColor", "screenLabelColor"] as const) {
    const color = validBackgroundColor(value[key]);
    if (color) result[key] = color;
  }
  if (["auto", "current", "card"].includes(value.priceStyle || ""))
    result.priceStyle = value.priceStyle;
  return result;
}
export function setPageAppearance(
  campaign: Campaign,
  kind: PageAppearanceKind,
  pageIndex: number | undefined,
  changes: PageAppearance,
  scope: "page" | "all" = "page",
) {
  campaign.pageAppearances ||= {};
  const keys =
    scope === "all"
      ? ["cover", "product", "stores"]
      : [pageAppearanceKey(kind, pageIndex)];
  if (scope === "all")
    for (const key of Object.keys(campaign.pageAppearances))
      if (key.startsWith("product-")) delete campaign.pageAppearances[key];
  for (const key of keys)
    campaign.pageAppearances[key] = cleanAppearance({
      ...pageAppearanceFor(
        campaign,
        key.startsWith("product") ? "product" : (key as PageAppearanceKind),
        key.startsWith("product-")
          ? { index: Number(key.slice(8)) }
          : undefined,
      ),
      ...changes,
    });
}
/** Background-only mutations never rewrite any product/artwork geometry or call AI. */
export function applyPageBackground(
  campaign: Campaign,
  kind: PageAppearanceKind,
  pageIndex: number | undefined,
  values: BackgroundValues,
  scope: "page" | "all" = "page",
) {
  const backgroundColor = validBackgroundColor(values.backgroundColor);
  const backgroundGradient = validBackgroundGradient(values.backgroundGradient);
  const backgroundImage = validBackgroundImage(values.backgroundImage);
  const clean: BackgroundValues = {
    backgroundColor,
    backgroundGradient,
    backgroundImage,
  };
  const setDefault = (prefix: "cover" | "product" | "stores") => {
    campaign[`${prefix}BackgroundColor`] = backgroundColor;
    campaign[`${prefix}BackgroundGradient`] = backgroundGradient;
    campaign[`${prefix}BackgroundImage`] = backgroundImage;
    if (prefix === "cover") campaign.coverImage = "";
  };
  campaign.pageAppearances ||= {};
  if (scope === "all") {
    for (const prefix of ["cover", "product", "stores"] as const)
      setDefault(prefix);
    for (const page of Object.values(campaign.pages || {}))
      for (const field of [
        "backgroundColor",
        "backgroundGradient",
        "backgroundImage",
      ] as const)
        delete page[field];
    campaign.pageAppearances = {
      cover: { priceStyle: "auto" },
      product: { priceStyle: "auto" },
      stores: { priceStyle: "auto" },
    };
  } else {
    if (kind === "product" && Number.isInteger(pageIndex)) {
      campaign.pages ||= {};
      campaign.pages[String(pageIndex)] = {
        ...campaign.pages[String(pageIndex)],
        ...clean,
      };
    } else setDefault(kind);
    campaign.pageAppearances[pageAppearanceKey(kind, pageIndex)] = {
      priceStyle: "auto",
    };
  }
  // Product cutouts are reusable transparent assets; changing page color does
  // not invalidate them or request paid background removal again.
  campaign.aiBackgroundChanged = false;
}

/** A transient render copy supplies a page-scoped price choice, preserving a
 * deliberately chosen per-product price design. It is never persisted. */
export function campaignForPageAppearance(
  campaign: Campaign,
  kind: PageAppearanceKind,
  page?: AppearancePage,
): Campaign {
  if (!hasPageAppearance(campaign, kind, page)) return campaign;
  const resolved = resolvedPageAppearance(campaign, kind, page);
  return {
    ...campaign,
    offerStyle: resolved.priceStyle,
    brandLogoMode: "auto",
    __pageAppearancePrice: resolved.priceStyle,
  } as Campaign;
}
export function activePagePriceStyle(
  campaign: Partial<Campaign>,
): "current" | "card" | undefined {
  const value = (
    campaign as Partial<Campaign> & { __pageAppearancePrice?: string }
  ).__pageAppearancePrice;
  return value === "card" || value === "current" ? value : undefined;
}
export function pageAppearanceStyle(
  campaign: Partial<Campaign>,
  kind: PageAppearanceKind,
  page: AppearancePage | undefined,
  brandFilterId: string,
): CSSProperties & Record<`--${string}`, string> {
  if (!hasPageAppearance(campaign, kind, page)) {
    const color = validBackgroundColor(campaign.brandLogoColor);
    return color
      ? {
          "--brochure-brand-filter": `url("#${brandFilterId}")`,
          "--brochure-brand-color": color,
          "--brand-logo-mode-filter": `url("#${brandFilterId}")`,
          "--brand-logo-mode-ink": color,
        }
      : {};
  }
  const resolved = resolvedPageAppearance(campaign, kind, page);
  return {
    color: resolved.textColor,
    "--brochure-foreground": resolved.textColor,
    "--brochure-brand-filter": `url("#${brandFilterId}")`,
    "--brochure-brand-color": resolved.brandColor,
    ...(validBackgroundColor(campaign.brandLogoColor)
      ? {
          "--brand-logo-mode-filter": `url("#${brandFilterId}")`,
          "--brand-logo-mode-ink": resolved.brandColor,
        }
      : {}),
    "--brochure-screen-label-color": resolved.screenLabelColor,
    "--brochure-energy-ink": resolved.textColor,
  };
}
export function artworkTextColor(
  campaign: Partial<Campaign>,
  pageKey: string | number,
  color?: string,
) {
  const kind =
    pageKey === "cover" ? "cover" : pageKey === "stores" ? "stores" : "product";
  const match = String(pageKey).match(/^product-(\d+)$/);
  const page =
    kind === "product" && match
      ? { index: Number(match[1]), ...campaign.pages?.[match[1]!] }
      : undefined;
  if (!hasPageAppearance(campaign, kind, page)) return color || "#1c4075";
  const resolved = resolvedPageAppearance(campaign, kind, page);
  if (validBackgroundColor(pageAppearanceFor(campaign, kind, page).textColor))
    return resolved.textColor;
  const context = pageImageBackgroundContext(campaign, kind, page);
  const backgrounds =
    context.kind === "gradient"
      ? [context.gradient.from, context.gradient.to]
      : [context.color];
  return validBackgroundColor(color) &&
    backgrounds.every((background) => colorContrast(color!, background) >= 4.5)
    ? color!
    : resolved.textColor;
}

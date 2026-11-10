import type { Artwork, Box, Campaign } from "../../domain/models";
import { resolveBrochureFormat } from "./brochureFormat";
import { resolvedPageAppearance } from "./pageAppearance";

export type PageBannerKind = "color" | "text" | "image";
const bounded = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/** Only intentional banners affect layout. Ordinary page artwork stays free. */
export function pageBannerInset(
  campaign: Partial<Campaign>,
  pageKey: string | number,
): number {
  const ratio = resolveBrochureFormat(campaign).ratio;
  return Math.min(
    85,
    Math.max(
      0,
      ...(campaign.pageArtworks?.[pageKey] || []).flatMap((artwork) => {
        if (
          artwork.layoutRole !== "banner" ||
          artwork.hidden ||
          artwork.opacity === 0 ||
          !(artwork.width > 0 && (artwork.height || 0) > 0)
        )
          return [];
        const angle = ((artwork.rotation || 0) * Math.PI) / 180;
        const height = artwork.height!;
        const rotatedHeight =
          Math.abs(height * Math.cos(angle)) +
          Math.abs(artwork.width * ratio * Math.sin(angle));
        const bottom = artwork.y + height / 2 + rotatedHeight / 2;
        return Number.isFinite(bottom) ? [bounded(bottom + 1.2, 0, 85)] : [];
      }),
    ),
  );
}

/** Compress an existing cover composition beneath a banner, preserving its
 * relative rows. Call only for automatically positioned product frames. */
export function fitCoverBelowBanners<T extends Box>(
  placement: T,
  campaign: Partial<Campaign>,
  pageKey: string | number = "cover",
  originalTop = 25,
  contentBottom = 95,
): T {
  const top = Math.max(originalTop, pageBannerInset(campaign, pageKey));
  if (top <= originalTop || contentBottom <= originalTop) return placement;
  const scale = (contentBottom - top) / (contentBottom - originalTop);
  return {
    ...placement,
    y: top + (placement.y - originalTop) * scale,
    height: placement.height * scale,
  };
}

export function pageBannerProductStyle(
  campaign: Partial<Campaign>,
  pageKey: string | number,
  originalTop = 3,
) {
  const inset = pageBannerInset(campaign, pageKey);
  return inset > originalTop ? { top: `${inset}%` } : {};
}

export function createPageBanner(
  kind: PageBannerKind,
  campaign: Partial<Campaign>,
  pageKey: string,
  options: { id: string; text?: string; image?: string; name?: string },
): Artwork {
  const pageKind =
    pageKey === "cover" ? "cover" : pageKey === "stores" ? "stores" : "product";
  const pageIndex = /^product-(\d+)$/.exec(pageKey)?.[1];
  const ink = resolvedPageAppearance(
    campaign,
    pageKind,
    pageIndex == null ? undefined : { index: Number(pageIndex) },
  ).textColor;
  const previous = pageBannerInset(campaign, pageKey);
  const height = kind === "image" ? 25 : 7;
  return {
    id: options.id,
    layoutRole: "banner",
    type: kind === "image" ? "image" : "text",
    name: options.name || (kind === "image" ? "Image banner" : "Page banner"),
    x: kind === "image" ? 0 : 1,
    y: bounded(previous ? previous : kind === "image" ? 0 : 1, 0, 85 - height),
    width: kind === "image" ? 100 : 98,
    height,
    ...(options.image ? { image: options.image } : {}),
    imageFit: "cover",
    ...(options.text != null ? { text: options.text } : {}),
    color: kind === "color" ? "#ffffff" : ink,
    backgroundColor: kind === "color" ? "#ff3b1f" : "#00000000",
    fontFamily:
      campaign.brochurePresetId === "neptun-black-friday" ||
      campaign.brochureReferenceDesign === "black-friday"
        ? "Cera Pro"
        : "SkolaSans",
    fontSize: 2.4,
    fontWeight: 700,
    textAlign: "left",
    textVerticalAlign: "center",
    padding: 1.2,
    lineHeight: 1.12,
    zIndex: 6,
  };
}

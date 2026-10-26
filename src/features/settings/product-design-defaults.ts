import type { CSSProperties } from "react";
import type { Campaign, Placement, Product } from "../../domain/models";
import {
  productDesignSchema,
  type ProductDesignDefaults,
} from "./settings.schema";
import {
  defaultProductImageScale,
  otherScreenInches,
  tvScreenInches,
} from "../brochure/tvSpecs";

const baseline = productDesignSchema.parse({});

/** Consult the brochure snapshot only. Later workspace changes never restyle saved work. */
export function productDesignFor(
  campaign: Partial<Campaign> = {},
): ProductDesignDefaults {
  const parsed = productDesignSchema.safeParse(campaign.productDesign);
  return parsed.success ? parsed.data : baseline;
}

export function defaultPhotoPlacement(
  product: Partial<Product>,
  campaign: Partial<Campaign>,
  detailPlacement: string,
  hero = false,
) {
  const photo = productDesignFor(campaign).photo;
  if (photo.mode === "custom")
    return { x: photo.x, y: photo.y, scale: photo.scale };
  const television = tvScreenInches(product);
  // Keep the inch curve intact in every design. Enlarging and then capping it
  // made 55/65/75-inch TVs share the same default size in the Classic preset.
  const scale = photo.automaticTvSizing ? defaultProductImageScale(product) : 1;
  return {
    x: detailPlacement === "left" ? 63 : otherScreenInches(product) ? 46 : 50,
    y: otherScreenInches(product) ? 56 : 50,
    scale:
      hero && television && photo.automaticTvSizing
        ? Math.min(1, scale * 1.18)
        : scale,
  };
}

export function defaultDetailFill(
  campaign: Partial<Campaign>,
  automatic: boolean,
) {
  const fill = productDesignFor(campaign).details.fill;
  return fill === "automatic" ? automatic : fill === "filled";
}

/** Explicitly moved/resized price and savings regions retain their exact saved scale. */
export function defaultRegionScale(
  campaign: Partial<Campaign>,
  kind: "price" | "saving",
  placement?: Placement,
): CSSProperties {
  if (placement) return {};
  const defaults = productDesignFor(campaign);
  const scale = kind === "price" ? defaults.priceScale : defaults.savingsScale;
  return scale === 1
    ? {}
    : { scale, transformOrigin: kind === "price" ? "right bottom" : "center" };
}

export function productTypographyStyle(
  campaign: Partial<Campaign>,
): CSSProperties {
  const { typography, divider } = productDesignFor(campaign);
  return {
    ...(typography.font !== "automatic"
      ? { "--product-default-font": `"${typography.font}", Arial, sans-serif` }
      : {}),
    ...(typography.nameScale !== 1
      ? { "--product-name-scale": typography.nameScale }
      : {}),
    ...(typography.codeScale !== 1
      ? { "--product-code-scale": typography.codeScale }
      : {}),
    ...(typography.detailScale !== 1
      ? { "--product-detail-scale": typography.detailScale }
      : {}),
    ...(divider.color ? { "--product-divider-color": divider.color } : {}),
    ...(divider.lightColor
      ? { "--product-divider-light-color": divider.lightColor }
      : {}),
  } as CSSProperties;
}

/** Page edits take priority field by field over the snapshotted grid defaults. */
export function productGridStyle(
  campaign: Partial<Campaign>,
  spacing?: Record<string, unknown> | null,
): CSSProperties {
  const grid = productDesignFor(campaign).grid;
  if (!spacing && grid.mode === "automatic") return {};
  const effective = { ...grid, ...spacing };
  return {
    columnGap: `${effective.horizontal}cqw`,
    rowGap: `${effective.vertical}cqw`,
    "--brochure-content-gap": `${effective.content}cqw`,
  } as CSSProperties;
}

import React from "react";
import type { Box, Campaign, Product } from "../../domain/models";
import type { BrochurePage } from "./campaignPages";
import { CoverElement } from "./CoverElement";
import { PageArtwork, type PageArtworkProps } from "./PageArtwork";
import {
  blackFridayFrames,
  blackFridayProductArtworks,
  type BlackFridayFrame,
} from "./blackFridayDesign";
import { fitCoverBelowBanners } from "./pageBanners";
import {
  pageBackgroundReadability,
  pageBackgroundContrastColor,
} from "./pageBackground";
import { backgroundReadabilityStyle } from "./backgroundContrast";
import { hasPageAppearance, pageAppearanceStyle } from "./pageAppearance";
import { PageAppearanceFilters } from "./PageAppearanceFilters";
import "../../styles/black-friday.css";
import "../../styles/black-friday-fonts.css";

interface Props {
  campaign: Campaign;
  products: readonly Product[];
  page?: BrochurePage;
  closing?: boolean;
  onArtworkChange?: PageArtworkProps["onChange"];
  onArtworkRemove?: PageArtworkProps["onRemove"];
  onProductChange?: (product: Product, changes: Partial<Product>) => void;
  renderProduct?: (product: Product, index: number) => React.ReactNode;
}
function regionVariables(name: string, box: Box | null | undefined) {
  if (!box) return {};
  return Object.fromEntries(
    Object.entries(box).map(([key, value]) => [
      `--bf-${name}-${key}`,
      `${value}%`,
    ]),
  );
}
function frameStyle(frame: BlackFridayFrame): React.CSSProperties {
  const warranty = frame.detailRects?.find((detail) => detail.warranty);
  return {
    "--bf-type-scale": Math.min(1.1, frame.width / 47),
    ...(frame.detailRects?.find((d) => d.warranty)?.runs?.[0]?.pointSize
      ? {
          "--bf-warranty-count-font": `${(frame.detailRects.find((d) => d.warranty)!.runs![0]!.pointSize / 841.88976) * 100}cqw`,
        }
      : {}),
    ...(warranty?.runs?.[1]?.pointSize
      ? {
          "--bf-warranty-label-font": `${(warranty.runs[1].pointSize / 841.88976) * 100}cqw`,
        }
      : {}),
    ...(frame.copyStyle
      ? {
          "--bf-name-font": `${(frame.copyStyle.pointSize / 841.88976) * 100}cqw`,
        }
      : {}),
    ...regionVariables("photo", frame.photo),
    ...regionVariables("copy", frame.copy),
    ...regionVariables(
      "price",
      frame.priceParts?.find((part) => part.fill?.startsWith("Color/")) ||
        frame.price,
    ),
    ...regionVariables("specs", frame.specs),
    ...(frame.brand && frame.copy
      ? {
          "--bf-brand-x": `${((frame.brand.x - frame.copy.x) / Math.max(frame.copy.width, 45)) * 100}%`,
          "--bf-brand-y": `${((frame.brand.y - frame.copy.y) / Math.max(frame.copy.height, 3)) * 100}%`,
          "--bf-brand-width": `${(frame.brand.width / Math.max(frame.copy.width, 45)) * 100}%`,
          "--bf-brand-height": `${(frame.brand.height / Math.max(frame.copy.height, 3)) * 100}%`,
        }
      : {}),
    ...(frame.saving && frame.photo
      ? {
          "--bf-saving-x": `${((frame.saving.x - frame.photo.x) / frame.photo.width) * 100}%`,
          "--bf-saving-y": `${((frame.saving.y - frame.photo.y) / frame.photo.height) * 100}%`,
          "--bf-saving-width": `${(frame.saving.width / frame.photo.width) * 100}%`,
        }
      : {}),
  } as React.CSSProperties;
}

/** Product cards and promotional artwork are separate editable source elements.
 * No complete brochure page is used as an image. */
export function BlackFridayPage({
  campaign,
  products,
  page,
  closing,
  onArtworkChange,
  onArtworkRemove,
  onProductChange,
  renderProduct,
}: Props) {
  const kind = closing ? "stores" : page ? "product" : "cover";
  const number = closing ? 13 : page ? page.index + 2 : 1;
  const key = closing ? "stores" : page ? `product-${page.index}` : "cover";
  const id = `bf-brand-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const color = pageBackgroundContrastColor(campaign, kind, page);
  const readability = pageBackgroundReadability(campaign, kind, page);
  const frames = blackFridayFrames(number, products);
  const top = Math.min(100, ...frames.map((frame) => frame.y));
  const bottom = Math.max(95, ...frames.map((frame) => frame.y + frame.height));
  return (
    <section
      className={`brochure-page brochure-black-friday cover-editable-elements has-background-readability ${readability.light ? "light" : "blue"} bf-source-page-${number} count-${products.length}`}
      data-brand-logo-mode={campaign.brandLogoMode || "auto"}
      data-smart-appearance={
        hasPageAppearance(campaign, kind, page) ? "true" : undefined
      }
      style={{
        ...backgroundReadabilityStyle(readability, color),
        ...pageAppearanceStyle(campaign, kind, page, id),
      }}
    >
      <PageAppearanceFilters
        campaign={campaign}
        kind={kind}
        page={page}
        id={id}
      />
      <PageArtwork
        campaign={campaign}
        pageKey={key}
        onChange={onArtworkChange}
        onRemove={onArtworkRemove}
      />
      {products.map((product, index) => {
        const frame = frames[index]!;
        const frameKey = `bf-product-${product.code}`;
        const placement = product.brochureContentPlacement?.frame;
        const fitted = fitCoverBelowBanners(frame, campaign, key, top, bottom);
        const defaultPlacement = {
          x: fitted.x,
          y: fitted.y,
          width: fitted.width,
          height: fitted.height,
        };
        return (
          <CoverElement
            key={product.code}
            campaign={{
              coverElementPlacements: placement
                ? { [frameKey]: placement }
                : {},
            }}
            kind={frameKey}
            className="bf-product-frame"
            defaultPlacement={defaultPlacement}
            style={frameStyle(frame)}
            onChange={
              onProductChange
                ? (_, next) =>
                    onProductChange(product, {
                      brochureContentPlacement: {
                        ...product.brochureContentPlacement,
                        frame: next,
                      },
                    })
                : undefined
            }
            onHide={
              onProductChange
                ? () =>
                    onProductChange(product, {
                      brochureContentPlacement: {
                        ...product.brochureContentPlacement,
                        frame: { ...placement, hidden: true },
                      },
                    })
                : undefined
            }
          >
            {renderProduct?.(product, index)}
            <PageArtwork
              campaign={{
                ...campaign,
                pageAppearances: {},
                pageArtworks: {
                  product:
                    product.productArtworks ||
                    blackFridayProductArtworks(frame, product),
                },
              }}
              pageKey="product"
              onChange={
                onProductChange
                  ? (id, artwork) =>
                      onProductChange(product, {
                        productArtworks: (
                          product.productArtworks ||
                          blackFridayProductArtworks(frame, product)
                        ).map((item) => (item.id === id ? artwork : item)),
                      })
                  : undefined
              }
              onRemove={
                onProductChange
                  ? (id) =>
                      onProductChange(product, {
                        productArtworks: (
                          product.productArtworks ||
                          blackFridayProductArtworks(frame, product)
                        ).filter((item) => item.id !== id),
                      })
                  : undefined
              }
            />
          </CoverElement>
        );
      })}
    </section>
  );
}

import { brandLogoRenderMode } from "./brandLogoAppearance";
import React from "react";
import type { Box, Campaign, Product } from "../../domain/models";
import type { BrochurePage } from "./campaignPages";
import { CoverElement } from "./CoverElement";
import { PageArtwork, type PageArtworkProps } from "./PageArtwork";
import {
  blackFridayFrames,
  blackFridayProductArtworks,
  blackCollectionPageArtworks,
  BLACK_FRIDAY_ASPECT,
  isBlackCollectionBrochure,
  isBlackCollectionHeading,
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
import { productDesignFor } from "../settings/product-design-defaults";
import { ApplePageBranding, allAppleProducts } from "./ApplePageBranding";
import type { CampaignAssetChange } from "./CampaignAssetArtwork";
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
  onCampaignAssetChange?: CampaignAssetChange;
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
function frameStyle(
  frame: BlackFridayFrame,
  clean = false,
  displayed: Box = frame,
  largerPhoto = false,
  coverSingleton = false,
): React.CSSProperties {
  const warranty = frame.detailRects?.find((detail) => detail.warranty);
  const detailSize = Math.min(
    5.8,
    (displayed.height / BLACK_FRIDAY_ASPECT) *
      0.11 *
      (coverSingleton ? 1.12 : 1),
  );
  const photo = frame.photo || {
    x: 5,
    y: clean ? 2 : 1,
    width: 90,
    height: clean ? 57 : 65,
  };
  return {
    "--bf-type-scale": Math.min(1.1, frame.width / 47),
    "--bf-detail-size": `${detailSize}cqw`,
    "--bf-detail-gap": `${Math.min(0.7, detailSize * 0.12)}cqw`,
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
    ...(largerPhoto
      ? regionVariables("photo", {
          ...photo,
          x: photo.width < 96 ? 2 : photo.x,
          width: Math.max(96, photo.width),
          height: Math.max(78, photo.height),
        })
      : {}),
    ...(clean
      ? {
          "--bf-price-width": `${Math.min(36, (frame.height / frame.width) * 60)}%`,
          "--bf-price-x": `${100 - Math.min(36, (frame.height / frame.width) * 60)}%`,
          "--bf-warranty-count-font": `${frame.height * 0.085}cqw`,
          "--bf-warranty-label-font": `${Math.min(0.65, frame.height * 0.018)}cqw`,
          "--bf-saving-width": `${Math.min(16, (frame.height / frame.width) * 32)}%`,
        }
      : {}),
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
  onCampaignAssetChange,
  renderProduct,
}: Props) {
  const kind = closing ? "stores" : page ? "product" : "cover";
  const number = closing ? 13 : page ? page.index + 2 : 1;
  const key = closing ? "stores" : page ? `product-${page.index}` : "cover";
  const id = `bf-brand-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const color = pageBackgroundContrastColor(campaign, kind, page);
  const readability = pageBackgroundReadability(campaign, kind, page);
  const frames = blackFridayFrames(number, products, campaign);
  const top = Math.min(100, ...frames.map((frame) => frame.y));
  const bottom = Math.max(95, ...frames.map((frame) => frame.y + frame.height));
  const appleTop =
    allAppleProducts(products) && number > 1 ? Math.max(top, 9.5) : top;
  const fittedFrames = frames.map((frame) => {
    const reserved =
      appleTop > top
        ? {
            ...frame,
            y:
              appleTop +
              ((frame.y - top) * (bottom - appleTop)) / (bottom - top),
            height: (frame.height * (bottom - appleTop)) / (bottom - top),
          }
        : frame;
    return fitCoverBelowBanners(reserved, campaign, key, appleTop, bottom);
  });
  const displayed = fittedFrames.map((frame, index) => ({
    ...frame,
    ...products[index]?.brochureContentPlacement?.frame,
  }));
  const singletons = displayed.map(
    (frame, index) =>
      !frame.hidden &&
      displayed.every((other, peer) => {
        if (peer === index || other.hidden) return true;
        const overlap =
          Math.min(frame.y + frame.height, other.y + other.height) -
          Math.max(frame.y, other.y);
        return overlap <= Math.min(frame.height, other.height) * 0.5;
      }),
  );
  const twoRows = products.length === 2 && singletons.every(Boolean);
  const automaticPhotos = productDesignFor(campaign).photo.mode !== "custom";
  const pageArtworks = blackCollectionPageArtworks(campaign, key);
  const headingArtworks = isBlackCollectionBrochure(campaign)
    ? pageArtworks.filter(isBlackCollectionHeading)
    : [];
  const artworkCampaign = {
    ...campaign,
    pageArtworks: {
      ...campaign.pageArtworks,
      [key]: pageArtworks.filter(
        (artwork) => !headingArtworks.includes(artwork),
      ),
    },
  };
  return (
    <section
      className={`brochure-page brochure-black-friday ${isBlackCollectionBrochure(campaign) ? "bf-clean-collection" : `bf-source-page-${number}`} cover-editable-elements has-background-readability ${readability.light ? "light" : "blue"} count-${products.length}`}
      data-brand-logo-mode={brandLogoRenderMode(campaign)}
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
      <ApplePageBranding
        campaign={campaign}
        products={products}
        pageKey={key}
        onChange={onCampaignAssetChange}
      />
      <PageArtwork
        campaign={artworkCampaign}
        pageKey={key}
        onChange={onArtworkChange}
        onRemove={onArtworkRemove}
      />
      {headingArtworks.length > 0 && (
        <PageArtwork
          campaign={{
            ...campaign,
            // Preserve this editable heading's chosen ink independently of
            // page-wide automatic product text colors.
            pageAppearances: {},
            pageArtworks: { [key]: headingArtworks },
          }}
          pageKey={key}
          onChange={onArtworkChange}
          onRemove={onArtworkRemove}
        />
      )}
      {products.map((product, index) => {
        const frame = frames[index]!;
        const frameKey = `bf-product-${product.code}`;
        const placement = product.brochureContentPlacement?.frame;
        const fitted = fittedFrames[index]!;
        const manualDetails =
          Boolean(product.brochureContentPlacement?.specs) ||
          Object.values(product.detailBlockPlacements || {}).some((value) =>
            ["x", "y", "width", "height"].some(
              (field) => value[field as keyof typeof value] !== undefined,
            ),
          );
        const defaultDetails = !frame.detailRects?.length && !manualDetails;
        const neutralPhoto =
          !product.brochureImagePlacement ||
          Object.entries(product.brochureImagePlacement).every(
            ([field, value]) =>
              value === undefined ||
              (
                { x: 50, y: 50, scale: 1, hidden: false } as Record<
                  string,
                  unknown
                >
              )[field] === value,
          );
        const largerPhoto =
          twoRows &&
          (isBlackCollectionBrochure(campaign) || automaticPhotos) &&
          neutralPhoto;
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
            className={`bf-product-frame ${singletons[index] ? "bf-singleton-row" : ""} ${defaultDetails ? "bf-default-details" : ""} ${largerPhoto ? "bf-larger-default-photo" : ""}`}
            defaultPlacement={defaultPlacement}
            style={frameStyle(
              frame,
              isBlackCollectionBrochure(campaign),
              displayed[index]!,
              largerPhoto,
              number === 1 && singletons[index],
            )}
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

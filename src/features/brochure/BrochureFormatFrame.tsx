import React from "react";
import type { Campaign } from "../../domain/models";
import type { BackgroundPage } from "./pageBackground";
import { brochureFormatFrameStyle } from "./brochureFormat";
import {
  lightBackground,
  pageBackgroundColor,
  pageBackgroundContrastColor,
  pageBackgroundFill,
  pageBackgroundImage,
} from "./pageBackground";

// Fit the complete composition, including free placements and the final-page
// footer, so a format change never stretches or rewrites any design coordinates.
export function BrochureFormatFrame({
  campaign,
  page,
  kind,
  children,
}: {
  campaign: Partial<Campaign>;
  page?: BackgroundPage;
  kind: string;
  children: React.ReactNode;
}) {
  const color = pageBackgroundContrastColor(campaign, kind, page);
  const light = color ? lightBackground(color) : campaign.theme === "light";
  const image = pageBackgroundImage(campaign, kind, page);
  const fallback =
    kind === "stores" && light ? "#e4e4e4" : light ? "#f1f2f4" : "#1c4075";
  const fill =
    (image
      ? pageBackgroundColor(campaign, kind, page)
      : pageBackgroundFill(campaign, kind, page)) || fallback;
  return (
    <section
      className={`brochure-format-frame brochure-output-page ${light ? "light" : "blue"}`}
      style={{
        ...brochureFormatFrameStyle(campaign),
        background: fill,
        ...(campaign.pricePalette
          ? {
              "--brochure-price-red": campaign.pricePalette.red,
              "--brochure-price-blue": campaign.pricePalette.blue,
              "--brochure-price-blue-band": campaign.pricePalette.blueBand,
              "--brochure-price-saving": campaign.pricePalette.saving,
            }
          : {}),
      }}
    >
      {image && (
        <img
          className="brochure-format-background-image"
          src={image}
          alt=""
          aria-hidden="true"
        />
      )}
      <div className="brochure-format-content">{children}</div>
    </section>
  );
}

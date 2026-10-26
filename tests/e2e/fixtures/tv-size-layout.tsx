import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Campaign, Product } from "../../../src/domain/models";
import { ProductPage } from "../../../src/features/brochure/Brochure";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../../src/features/settings/settings.schema";
import "../../../src/styles/campaign.css";
import "../../../src/styles/brochure-reference.css";
import "../../../src/styles/cover-layout.css";
import "../../../src/styles/reference-price-card.css";
import "../../../src/styles/red-reference-price.css";
import "../../../src/styles/brochure-format.css";
import "../../../src/styles/page-background.css";
import "../../../src/styles/brochure-direct-edit.css";
import "../../../src/styles/brochure-import-artwork.css";
import "../../../src/styles/responsive.css";
import "../../../src/styles/artwork-typography.css";
import "../../../src/styles/offer-default-sizing.css";

const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#15191e"/><rect x="30" y="30" width="740" height="410" fill="#6faccb"/><path d="m95 435-35 55m645-55 35 55" stroke="#15191e" stroke-width="15"/></svg>')}`;
const wallpaper = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#d3975c"/></svg>')}`;
const sizes = [40, 55, 65, 75];
function Fixture() {
  const [manual, setManual] = useState(false);
  const products: Product[] = sizes.map((size, index) => ({
    code: `tv-${size}`,
    name: `TV LED ${size}ABC`,
    brand: "LG",
    category: "TV",
    subcategory: ["TV", "Televizorë", "Televisions", "OLED"][index],
    specs: { Ekrani: `${size} inch` },
    image,
    sale: 399,
    regular: 499,
    brochureDetails: ["4K UHD", "Smart TV", "HDR10"],
    screenArtwork: {
      image: wallpaper,
      box: { x: 0.06, y: 0.08, width: 0.88, height: 0.72 },
      detectedFor: image,
      fit: "contain",
    },
    ...(manual && index === 0
      ? { brochureImagePlacement: { x: 44, y: 48, scale: 1.12 } }
      : {}),
  }));
  return (
    <>
      <button type="button" onClick={() => setManual((value) => !value)}>
        {manual ? "Reset manual sizes" : "Use saved manual sizes"}
      </button>
      {(["neptun-current", "neptun-october"] as const).map((presetId) => {
        const campaign: Campaign = {
          id: presetId,
          name: "TV size comparison",
          products,
        };
        applyBrochurePreset(
          campaign,
          availableBrochurePresets(resolveSettings(null)).find(
            (preset) => preset.id === presetId,
          )!,
        );
        return (
          <section
            key={presetId}
            data-tv-preset={presetId}
            style={{ width: 1080 }}
          >
            <ProductPage
              campaign={campaign}
              page={{
                index: 0,
                layout: "duo4",
                products,
                title: "TVs",
                image: "",
                backgroundColor: "",
                backgroundImage: "",
                backgroundGradient: null,
                showFooter: true,
                showFooterPageNumber: true,
                spacing: null,
              }}
            />
          </section>
        );
      })}
    </>
  );
}
createRoot(document.getElementById("tv-size-fixture")!).render(<Fixture />);

import React from "react";
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
import "../../../src/styles/reference-price-card.css";
import "../../../src/styles/brochure-format.css";
import "../../../src/styles/page-background.css";
import "../../../src/styles/brochure-direct-edit.css";
import "../../../src/styles/responsive.css";
import "../../../src/styles/artwork-typography.css";
import "../../../src/styles/offer-default-sizing.css";
import "../../../src/styles/viewport-layout.css";

const image = (width: number, height: number) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="20" fill="#293445"/><rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="16" fill="#80afd0"/></svg>`)}`;
const products: Product[] = [
  {
    code: "android",
    name: "Samsung Galaxy A57",
    brand: "Samsung",
    subcategory: "Smartphone",
    image: image(230, 430),
    brochureDetails: [
      "Android 16",
      "Kamera: 50MP / Front: 12MP",
      "8GB / 256GB",
      "Bateria: 5000 mAh",
    ],
  },
  {
    code: "iphone",
    name: "iPhone 17",
    brand: "Apple",
    subcategory: "Smartphone",
    image: image(230, 430),
    brochureDetails: ["Memorje: 256 GB", 'Ekrani: 6.3"'],
  },
  {
    code: "soundbar",
    name: "Soundbar S40T",
    brand: "LG",
    subcategory: "Zmadhues zëri",
    image: image(500, 200),
    brochureDetails: [
      "Fuqia: 300 W",
      "Numri i kanaleve: 2.1ch",
      "Dolby Digital",
    ],
  },
  {
    code: "tablet",
    name: "Samsung Galaxy Tab",
    brand: "Samsung",
    subcategory: "Tablet",
    image: image(430, 310),
    brochureDetails: ["Android 15", "Bateria: 5100 mAh", "128 GB / 8 GB RAM"],
  },
].map((product) => ({
  ...product,
  sale: 139,
  regular: 249,
  warranty: "1 VIT",
  skipAiCutout: true,
}));
const settings = resolveSettings(null);
const campaign: Campaign = {
  id: "blue-reference-geometry",
  name: "Weekend offers",
  products,
};
applyBrochurePreset(
  campaign,
  availableBrochurePresets(settings).find(
    (preset) => preset.id === "neptun-october",
  )!,
);
// An inherited workspace choice must not turn the other categories vertical.
campaign.productDesign!.details.placement = "left";
const host = document.getElementById("blue-detail-fixture")!;
host.style.width = "1080px";
createRoot(host).render(
  <ProductPage
    campaign={campaign}
    page={{
      index: 0,
      layout: "duo4",
      products,
      title: "Products",
      image: "",
      backgroundColor: "#e3e3e3",
      backgroundImage: "",
      backgroundGradient: null,
      showFooter: true,
      showFooterPageNumber: true,
      spacing: null,
    }}
  />,
);

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Campaign, Product } from "../../../src/domain/models";
import { CoverPage } from "../../../src/features/brochure/Brochure";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../../src/features/settings/settings.schema";
import { setLanguage } from "../../../src/features/brochure/i18n";
import "../../../src/styles/campaign.css";
import "../../../src/styles/brochure-reference.css";
import "../../../src/styles/cover-layout.css";
import "../../../src/styles/product-editing.css";
import "../../../src/styles/import-flex.css";
import "../../../src/styles/reference-price-card.css";
import "../../../src/styles/red-reference-price.css";
import "../../../src/styles/brochure-format.css";
import "../../../src/styles/page-background.css";
import "../../../src/styles/brochure-direct-edit.css";
import "../../../src/styles/brochure-import-artwork.css";
import "../../../src/styles/artwork-typography.css";
import "../../../src/styles/offer-default-sizing.css";
import "../../../src/styles/brochure-ux.css";

const svg = (value: string) =>
  `data:image/svg+xml,${encodeURIComponent(value)}`;
const tv = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect x="10" y="10" width="780" height="440" fill="#15191e"/><rect x="16" y="16" width="768" height="428" fill="#bc6f24"/><path d="m95 435-35 55m645-55 35 55" stroke="#15191e" stroke-width="15"/></svg>',
);
const washer = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="600"><rect x="10" y="10" width="400" height="580" rx="15" fill="#eee"/><rect x="25" y="30" width="370" height="65" fill="#b7bdc5"/><circle cx="210" cy="330" r="158" fill="#abb1bb"/><circle cx="210" cy="330" r="133" fill="#303944"/></svg>',
);
const conditioner = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="350"><rect x="20" y="30" width="760" height="290" rx="40" fill="#eee"/><path d="M55 260h680M60 275h670M70 290h640" stroke="#a9a9ae" stroke-width="5"/></svg>',
);
const products: Product[] = [
  {
    code: "tv",
    name: "TV LED UE65U8092HUXXH",
    brand: "SAMSUNG",
    category: "TV",
    subcategory: "TV",
    image: tv,
    specs: { Ekrani: '65"' },
    regular: 749,
    sale: 529,
    warranty: "2 vite",
    brochureDetails: [
      "SMART TV",
      "4K UHD",
      "One UI Tizen",
      "Crystal Processor 4K",
      "HDR10+",
    ],
  },
  {
    code: "washer",
    name: "RROBALARËSE BM3WFSU38213WA",
    brand: "BEKO",
    category: "Appliance",
    subcategory: "RROBALARËSE",
    image: washer,
    regular: 429,
    sale: 269,
    warranty: "5 vite",
    brochureDetails: [
      "8 KG",
      "RROTULLIME: 1200",
      "Programet: 15",
      "Lloji i motorrit: ProSmart",
      "Energy Spin",
    ],
  },
  {
    code: "ac",
    name: "KONDICIONER FGTC12INV-WIFI-SERIA 6",
    brand: "FUEGO",
    category: "Appliance",
    subcategory: "KONDICIONER",
    image: conditioner,
    productArtworks: [],
    regular: 369,
    sale: 269,
    warranty: "3 vite",
    brochureDetails: [
      "12000 BTU",
      "A+++",
      "-25°C deri +53°C",
      "GAS EKOLOGJIK R32",
      "ANTI DIRECT AIR FLOW",
    ],
  },
];
function Fixture() {
  const [manual, setManual] = useState(false);
  const [campaign, setCampaign] = useState<Campaign>(() => {
    const value: Campaign = {
      id: "classic-cover",
      name: "November offers",
      startDate: "2026-11-05",
      endDate: "2026-11-21",
      products,
    };
    applyBrochurePreset(
      value,
      availableBrochurePresets(resolveSettings(null))[0]!,
    );
    value.showCoverLogo = false;
    return value;
  });
  const rendered = manual
    ? {
        ...campaign,
        coverElementPlacements: {
          ...campaign.coverElementPlacements,
          "product-tv": { x: 4, y: 11, width: 90, height: 40 },
          footer: { x: 5, y: 94, width: 90, height: 4 },
        },
        products: campaign.products.map((product, index) =>
          index
            ? product
            : {
                ...product,
                brochureImagePlacement: { x: 48, y: 49, scale: 0.9 },
                brochureContentPlacement: {
                  specs: { x: 3, y: 1, width: 65 },
                  price: { x: -1, y: 2, width: 24 },
                },
                detailBlockPlacements: {
                  "0": { x: 1, y: 0.5, width: 18, height: 6 },
                },
              },
        ),
      }
    : campaign;
  setLanguage("en");
  return (
    <>
      <button type="button" onClick={() => setManual((value) => !value)}>
        Toggle saved positions
      </button>
      <div data-classic-cover style={{ width: 1080 }}>
        <CoverPage
          campaign={rendered}
          onProductChange={(product, field, value) =>
            setCampaign((old) => ({
              ...old,
              products: old.products.map((item) =>
                item.code === product.code
                  ? {
                      ...item,
                      ...(typeof field === "string"
                        ? { [field]: value }
                        : field),
                    }
                  : item,
              ),
            }))
          }
          onEditDetails={(product, focus) => {
            document.body.dataset.detailEdit = `${product.code}:${focus ?? ""}`;
          }}
          onFooterTextChange={(field, value) =>
            setCampaign((old) =>
              field === "paymentText"
                ? { ...old, paymentText: value }
                : {
                    ...old,
                    brochureFooter: { ...old.brochureFooter, dateText: value },
                  },
            )
          }
        />
      </div>
    </>
  );
}
createRoot(document.getElementById("classic-cover-fixture")!).render(
  <Fixture />,
);

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Campaign, Product } from "../../../src/domain/models";
import { CampaignLibrary } from "../../../src/features/studio/Studio";
import { setLanguage } from "../../../src/features/brochure/i18n";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../../src/features/settings/settings.schema";
import "../../../src/features/appearance/dark-mode.css";
import "../../../src/styles/viewport-layout.css";

const svg = (content: string) =>
  `data:image/svg+xml,${encodeURIComponent(content)}`;
const image = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect x="35" y="30" width="730" height="410" rx="5" fill="#15191e"/><rect x="45" y="40" width="710" height="390" fill="#59a5d2"/><path d="m115 440-35 50m605-50 35 50" stroke="#15191e" stroke-width="15"/></svg>',
);
const logo = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="450" height="100"><text x="10" y="70" font-family="Arial" font-weight="900" font-size="70" fill="white">NEPTUN</text><path d="M10 85h420" stroke="#ff4a27" stroke-width="7"/></svg>',
);
const products: Product[] = [
  {
    code: "84066096",
    name: "TV LED 55 ABC",
    brand: "Samsung",
    category: "TV",
    subcategory: "Televizorë",
    specs: { Ekrani: "55 inch" },
    image,
    sale: 399,
    regular: 499,
    brochureDetails: ["4K UHD", "Smart TV", "HDR10"],
  },
];
const settings = resolveSettings(null);
const campaigns: Campaign[] = [
  {
    id: "active",
    name: "Weekend offers",
    type: "Black Friday",
    startDate: "2999-10-24",
    endDate: "2999-10-31",
    status: "in_progress",
    brochureFormat: "neptun1080x1350",
    products,
  },
  {
    id: "review",
    name: "A longer campaign name that must wrap and remain fully readable",
    type: "Campaign type with a deliberately long descriptive name",
    startDate: "2999-10-24",
    endDate: "2999-11-07",
    status: "changes_requested",
    brochureFormat: "portrait1080x1440",
    products: [],
  },
  {
    id: "expired",
    name: "Spring offers",
    type: "Spring offer",
    startDate: "2000-10-24",
    endDate: "2000-10-24",
    status: "in_review",
    brochureFormat: "square1080",
    products,
    reviewComments: [{ id: "open-comment", fixed: false, text: "Check price" }],
  },
  {
    id: "landscape",
    name: "Landscape brochure",
    type: "Black Friday",
    startDate: "2000-10-20",
    endDate: "2000-10-24",
    status: "completed",
    brochureFormat: "landscape1920x1080",
    products,
  },
].map((campaign, index) => {
  const value: Campaign = {
    ...campaign,
    updatedAt: `2026-10-${26 - index}T12:00:00Z`,
  };
  applyBrochurePreset(
    value,
    availableBrochurePresets(settings).find(
      (preset) =>
        preset.id === (index % 2 ? "neptun-current" : "neptun-october"),
    )!,
  );
  value.coverLogoSource = logo;
  value.brochureFormat = campaign.brochureFormat;
  return value;
});

const params = new URLSearchParams(location.search);
setLanguage(params.get("language") || "sq");
document.documentElement.dataset.theme = params.get("theme") || "dark";
localStorage.removeItem("neptun-campaign-filters");

function Fixture() {
  const [action, setAction] = useState("");
  return (
    <div className="campaign-app" style={{ display: "block" }}>
      <main className="cs-content" style={{ margin: 0 }}>
        <CampaignLibrary
          campaigns={campaigns}
          settings={settings}
          onCreate={() => setAction("create")}
          onOpen={(id) => setAction(`open:${id}`)}
          onDuplicate={(campaign) => setAction(`duplicate:${campaign.id}`)}
          onDelete={(campaign) => setAction(`delete:${campaign.id}`)}
          onPrint={(id) => setAction(`print:${id}`)}
        />
        <output data-testid="library-action">{action}</output>
      </main>
    </div>
  );
}

createRoot(document.getElementById("library-layout-fixture")!).render(
  <Fixture />,
);

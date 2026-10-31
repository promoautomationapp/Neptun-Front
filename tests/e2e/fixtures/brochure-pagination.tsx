import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Campaign, CampaignMutator } from "../../../src/domain/models";
import { BrochureEditor } from "../../../src/features/studio/Studio";
import { campaignDefaults } from "../../../src/features/settings/campaign-defaults";
import { resolveSettings } from "../../../src/features/settings/settings.schema";
import { setLanguage } from "../../../src/features/brochure/i18n";
import "../../../src/styles/campaign.css";
import "../../../src/styles/artwork-typography.css";
import "../../../src/styles/offer-default-sizing.css";
import "../../../src/features/appearance/dark-mode.css";
import "../../../src/styles/viewport-layout.css";

setLanguage("en");
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500"><rect width="700" height="450" rx="20" fill="#243947"/><rect x="12" y="12" width="676" height="426" rx="12" fill="#8abbce"/></svg>')}`;
const settings = resolveSettings(null);
settings.stores = [
  {
    id: "prishtina",
    city: "Prishtinë",
    name: "Central Park",
    address: "Store street",
    phone: "046 828 000",
    visible: true,
  },
];
const initial: Campaign = {
  ...campaignDefaults(settings),
  id: "pagination-fixture",
  name: "Brochure pagination regression",
  type: "Weekend offers",
  tagline: "Weekend offers",
  layout: "duo4",
  autoProductLayout: false,
  coverProductLayout: "pair",
  coverProductCodes: ["offer-0", "offer-1"],
  includeStoresPage: true,
  includeStoresFooter: false,
  products: Array.from({ length: 42 }, (_, index) => ({
    code: `offer-${index}`,
    name: `Product ${index}`,
    brand: "FUEGO",
    category: "Appliances",
    subcategory: "Washer",
    image,
    regular: 499,
    sale: 399,
    warranty: "2 VITE",
    brochurePage: index < 2 ? 1 : 2 + Math.floor((index - 2) / 4),
    brochureDetails: ["Feature one", "Feature two", "Feature three"],
  })),
};
const user: React.ComponentProps<typeof BrochureEditor>["user"] = {
  id: "pagination-editor",
  email: "staff@example.test",
  name: "Pagination editor",
  role: "staff",
  permissions: "editor",
  organizationId: "12345678-1234-4234-8234-123456789012",
  mustChangePassword: false,
  isSupport: false,
};
const noop = () => {};
function Fixture() {
  const [campaign, setCampaign] = useState(initial);
  const [dark, setDark] = useState(false);
  const [exportPage, setExportPage] = useState<number | null>(null);
  const update = (mutate: CampaignMutator) =>
    setCampaign((current) => {
      const next = structuredClone(current);
      mutate(next);
      return next;
    });
  return (
    <div className="campaign-app">
      <div className="cs-content">
        <header className="cs-topbar">
          <strong>Brochure test workspace</strong>
          <div className="cs-actions">
            <button
              type="button"
              onClick={() => {
                document.documentElement.dataset.theme = dark
                  ? "light"
                  : "dark";
                setDark(!dark);
              }}
            >
              {dark ? "Use light mode" : "Use dark mode"}
            </button>
            <button
              type="button"
              onClick={() =>
                update((draft) => {
                  draft.includeStoresPage = !draft.includeStoresPage;
                })
              }
            >
              {campaign.includeStoresPage
                ? "Exclude stores page"
                : "Include stores page"}
            </button>
          </div>
        </header>
        <main className="cs-main-panel cs-editor">
          <div className="cs-editor-hero">
            <h1>Brochure pagination regression</h1>
            <p>42 products · 12 brochure pages</p>
          </div>
          <BrochureEditor
            campaign={campaign}
            settings={settings}
            user={user}
            members={[]}
            onUpdate={update}
            onReviewAction={async () => true}
            onToast={noop}
            onAiReview={noop}
            onReCut={noop}
            onPrint={noop}
            onExport={setExportPage}
            onAddProducts={noop}
            onImportProducts={noop}
            onEditImage={noop}
            onEditScreen={noop}
            onEditDetails={noop}
            onEditPrice={noop}
            onEditSavings={noop}
            onMakeSocial={noop}
          />
        </main>
        <output id="pagination-fixture-snapshot" hidden>
          {JSON.stringify({
            products: campaign.products.map(
              ({ code, name, sale, regular }) => ({
                code,
                name,
                sale,
                regular,
              }),
            ),
            includeStoresPage: campaign.includeStoresPage,
            exportPage,
          })}
        </output>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);

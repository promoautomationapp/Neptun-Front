import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Campaign, Product } from "../../../src/domain/models";
import { ProductPage } from "../../../src/features/brochure/Brochure";
import { Details } from "../../../src/features/brochure/Modals";
import { ProductImageEditor } from "../../../src/features/brochure/ProductImageEditor";
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
import "../../../src/styles/reference-price-card.css";
import "../../../src/styles/brochure-format.css";
import "../../../src/styles/page-background.css";
import "../../../src/styles/brochure-direct-edit.css";
import "../../../src/styles/brochure-import-artwork.css";
import "../../../src/styles/artwork-typography.css";
import "../../../src/styles/offer-default-sizing.css";
import "../../../src/styles/brochure-ux.css";
import "../../../src/styles/brochure-editor-chrome.css";

const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="470"><rect x="30" y="20" width="740" height="420" rx="20" fill="#293c53"/><rect x="50" y="40" width="700" height="370" fill="#8ebacb"/></svg>')}`;
const base: Product = {
  code: "primary",
  name: "Headphones",
  brand: "Huawei",
  category: "Accessories",
  subcategory: "Headphones",
  regular: 219,
  sale: 149,
  brochureDetails: ["Bluetooth v6.0", "20 Hz to 20 kHz", "Battery 24 h"],
  image,
  skipAiCutout: true,
  productArtworks: [],
};
function Fixture() {
  const [mode, setMode] = useState("missing");
  const [number, setNumber] = useState("12");
  const [edited, setEdited] = useState<Record<string, Partial<Product>>>({});
  const [details, setDetails] = useState<{
    code: string;
    focus?: string;
  } | null>(null);
  const [imageCode, setImageCode] = useState<string | null>(null);
  const selected = {
    ...base,
    ...(mode === "missing"
      ? { image: "", catalogMissing: true }
      : mode === "apple"
        ? {
            brand: "Apple",
            name: "MacBook Air",
            subcategory: "Laptop",
            brochureDetails: ["Apple M5", "512 GB SSD", 'Ekrani 13.6"'],
          }
        : {}),
    ...edited.primary,
  };
  const products =
    mode === "pair"
      ? [
          selected,
          {
            ...selected,
            code: "secondary",
            name: "Second headphones",
            productArtworks: [],
            ...edited.secondary,
          },
        ]
      : [selected];
  if (mode === "custom")
    products[0] = {
      ...products[0]!,
      brochureCardSize: { width: 1, height: 1 },
      brochureImagePlacement: { x: 43, y: 47, scale: 0.82 },
    };
  const campaign: Campaign = {
    id: "single-workspace",
    name: "Weekend offers",
    products,
  };
  applyBrochurePreset(
    campaign,
    availableBrochurePresets(resolveSettings(null)).find(
      (preset) =>
        preset.id ===
        (mode === "classic" ? "neptun-current" : "neptun-october"),
    )!,
  );
  campaign.pages = { 10: { footerNumber: number } };
  const update = (
    field: keyof Product | Partial<Product>,
    value?: Product[keyof Product],
    code = details?.code || imageCode || "primary",
  ) =>
    setEdited((old) => ({
      ...old,
      [code]: {
        ...old[code],
        ...(typeof field === "string" ? { [field]: value } : field),
      },
    }));
  const editingProduct =
    products.find((product) => product.code === (details?.code || imageCode)) ||
    selected;
  setLanguage("en");
  return (
    <div className="campaign-app">
      <main className="cs-editor-section" style={{ padding: 0, width: "100%" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: "#fff",
            padding: 8,
          }}
        >
          <label>
            Case{" "}
            <select
              aria-label="Case"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value);
                setEdited({});
              }}
            >
              <option value="missing">Missing photo</option>
              <option value="apple">Apple</option>
              <option value="classic">Classic</option>
              <option value="pair">Two products</option>
              <option value="custom">Saved card size</option>
            </select>
          </label>
          <label>
            {" "}
            Page number{" "}
            <input
              aria-label="Page number fixture"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              document.documentElement.dataset.theme =
                document.documentElement.dataset.theme === "dark"
                  ? "light"
                  : "dark";
            }}
          >
            Toggle theme
          </button>
        </div>
        <div
          className="cs-page-preview edit-view"
          style={{
            width: "min(900px, calc(100vw - 50px))",
            margin: "0 auto",
            overflow: "hidden",
          }}
        >
          <ProductPage
            campaign={campaign}
            page={{
              index: 10,
              layout:
                mode === "apple"
                  ? "pair2"
                  : mode === "classic"
                    ? "feature3"
                    : "duo4",
              products,
              title: "Offers",
              image: "",
              backgroundColor: "",
              backgroundImage: "",
              backgroundGradient: null,
              showFooter: true,
              showFooterPageNumber: true,
              spacing: null,
            }}
            onEditImage={(product) => setImageCode(String(product.code))}
            onEditDetails={(product, focus) =>
              setDetails({ code: String(product.code), focus })
            }
            onMove={() => {
              document.body.dataset.moveRequested = "true";
            }}
            onEditScreen={() => {
              document.body.dataset.screenRequested = "true";
            }}
            onProductChange={(product, field, value) =>
              update(field, value, String(product.code))
            }
          />
        </div>
        {details && (
          <Details
            product={editingProduct}
            campaign={campaign}
            focusDetailKey={details.focus}
            canLoadCatalogPhotos={false}
            onProductChange={update}
            onClose={() => setDetails(null)}
          />
        )}
        {imageCode && (
          <ProductImageEditor
            product={editingProduct}
            onSave={(changes) => update(changes)}
            onClose={() => setImageCode(null)}
            onEditArtwork={() => {
              setImageCode(null);
              setDetails({ code: imageCode, focus: "__artwork" });
            }}
          />
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("single-product-fixture")!).render(
  <Fixture />,
);

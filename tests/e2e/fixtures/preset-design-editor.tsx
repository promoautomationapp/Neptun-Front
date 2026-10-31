import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SettingsEditor } from "../../../src/features/settings/SettingsEditor";
import {
  resolveSettings,
  type WorkspaceSettings,
} from "../../../src/features/settings/settings.schema";
import {
  applyBrochurePreset,
  availableBrochurePresets,
  brochurePresetFromSettings,
} from "../../../src/features/brochure/brochurePresets";
import type { Campaign } from "../../../src/domain/models";
import { setLanguage } from "../../../src/features/brochure/i18n";
import "../../../src/styles/campaign.css";
import "../../../src/styles/brochure-reference.css";
import "../../../src/styles/brochure-workspace.css";
import "../../../src/styles/cover-layout.css";
import "../../../src/styles/product-editing.css";
import "../../../src/styles/reference-price-card.css";
import "../../../src/styles/brochure-format.css";
import "../../../src/styles/page-background.css";
import "../../../src/styles/artwork-typography.css";
import "../../../src/features/appearance/dark-mode.css";

const storageKey = "fixture-preset-design";
function starting() {
  const settings = resolveSettings(null);
  settings.stores = [
    {
      id: "global",
      name: "Global store",
      city: "City",
      address: "Street",
      phone: "100",
      visible: true,
    },
  ];
  const custom = structuredClone(settings);
  custom.stores = [
    {
      id: "private",
      name: "Private store",
      city: "Private city",
      address: "Private street",
      phone: "200",
      visible: true,
    },
  ];
  custom.brochure.coverBackground = {
    color: "#123456",
    gradient: null,
    image: "",
  };
  settings.brochurePresets.push(
    brochurePresetFromSettings(
      custom,
      "custom-private",
      "Private design",
    ) as WorkspaceSettings["brochurePresets"][number],
  );
  return settings;
}
const initial = starting();
const existing: Campaign = {
  id: "existing",
  name: "Existing campaign",
  products: [],
};
applyBrochurePreset(
  existing,
  availableBrochurePresets(initial).find((p) => p.id === "custom-private")!,
);
setLanguage("en");
function Fixture() {
  const [settings, setSettings] = useState(() => {
    try {
      return resolveSettings(
        JSON.parse(localStorage.getItem(storageKey) || "null") || initial,
      );
    } catch {
      return initial;
    }
  });
  const [language, setLocale] = useState("en");
  const [saved, setSaved] = useState<WorkspaceSettings | null>(null);
  return (
    <div className="campaign-app" style={{ display: "block" }}>
      <div style={{ padding: 12, display: "flex", gap: 20 }}>
        <label>
          Fixture language
          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              setLocale(event.target.value);
            }}
          >
            <option value="en">English</option>
            <option value="sq">Shqip</option>
          </select>
        </label>
        <label>
          Fixture dark
          <input
            type="checkbox"
            onChange={(event) => {
              document.documentElement.dataset.theme = event.target.checked
                ? "dark"
                : "light";
            }}
          />
        </label>
      </div>
      <SettingsEditor
        initial={settings}
        onSave={async (next) => {
          localStorage.setItem(storageKey, JSON.stringify(next));
          setSaved(next);
          setSettings(next);
          return next;
        }}
      />
      <output hidden data-saved>
        {JSON.stringify(saved)}
      </output>
      <output hidden data-existing>
        {JSON.stringify(existing)}
      </output>
    </div>
  );
}
createRoot(document.getElementById("preset-design-editor")!).render(
  <Fixture />,
);

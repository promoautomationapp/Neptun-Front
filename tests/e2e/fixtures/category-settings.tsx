import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CategoryTreeSelect } from "../../../src/features/brochure/CategoryTreeSelect";
import { SettingsEditor } from "../../../src/features/settings/SettingsEditor";
import { resolveSettings } from "../../../src/features/settings/settings.schema";
import type { WorkspaceSettings } from "../../../src/features/settings/settings.schema";
import { setLanguage } from "../../../src/features/brochure/i18n";
import "../../../src/styles/campaign.css";
import "../../../src/styles/catalog-navigator.css";
import "../../../src/features/appearance/dark-mode.css";

const catalog = [
  {
    code: "cable",
    name: "Samsung custom cable",
    category: "Computers",
    subcategory: "USB C",
    categoryPath: "Computers > Accessories > Cables > USB C",
    regular: 19,
  },
  {
    code: "hdmi",
    name: "HDMI cable",
    category: "Computers",
    subcategory: "HDMI",
    categoryPath: "Computers > Accessories > Cables > HDMI",
    regular: 29,
  },
  {
    code: "audio",
    name: "Audio cable",
    category: "Audio",
    subcategory: "USB C",
    categoryPath: "Audio > Accessories > USB C",
    regular: 15,
  },
];
const initial = resolveSettings(null);
initial.categoryPathSavingModes["Archived > Custom preserved category"] =
  "amount";
setLanguage("en");
function Fixture() {
  const [language, languageState] = useState("en");
  const [path, setPath] = useState("Computers > Accessories > Cables > USB C");
  const [saved, setSaved] = useState<WorkspaceSettings | null>(null);
  const [dark, setDark] = useState(false);
  return (
    <div className="campaign-app" style={{ display: "block", padding: 20 }}>
      <div style={{ display: "flex", gap: 20, marginBottom: 15 }}>
        <label>
          Fixture language{" "}
          <select
            aria-label="Fixture language"
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              languageState(event.target.value);
            }}
          >
            <option value="en">English</option>
            <option value="sq">Shqip</option>
          </select>
        </label>
        <label>
          Fixture dark{" "}
          <input
            type="checkbox"
            checked={dark}
            onChange={(event) => {
              setDark(event.target.checked);
              document.documentElement.dataset.theme = event.target.checked
                ? "dark"
                : "light";
            }}
          />
        </label>
      </div>
      <div style={{ width: 450, marginBottom: 20 }}>
        <CategoryTreeSelect
          catalog={catalog}
          category={path.split(" > ")[0]!}
          subcategory={path.split(" > ").at(-1)!}
          categoryPath={path}
          onChange={() => {}}
          onPathChange={setPath}
        />
      </div>
      <output data-selected-path>{path}</output>
      <SettingsEditor
        initial={initial}
        onSave={async (value) => {
          setSaved(value);
          return value;
        }}
        facets={catalog}
      />
      <output data-saved-settings hidden>
        {JSON.stringify(saved)}
      </output>
    </div>
  );
}
createRoot(document.getElementById("category-settings-fixture")!).render(
  <Fixture />,
);

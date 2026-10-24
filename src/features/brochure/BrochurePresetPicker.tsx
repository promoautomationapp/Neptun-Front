import { useState } from "react";
import type {
  BrochurePresetDefinition,
  Campaign,
  Settings,
} from "../../domain/models";
import { Modal } from "../../components/Modal";
import { CoverPage, ProductPage, StoresPage } from "./Brochure";
import { splitPages } from "./campaignPages";
import { resolveBrochureFormat } from "./brochureFormat";
import { resolveSettings } from "../settings/settings.schema";
import {
  PreviewPaper,
  settingsPreviewCampaign,
} from "../settings/SettingsPreview";
import { applyBrochurePreset } from "./brochurePresets";
import type { BrochurePreset } from "./brochurePresets";
import { t } from "./i18n";
import "./brochure-presets.css";

export function PresetThumbnail({
  preset,
}: {
  preset: BrochurePresetDefinition;
}) {
  if (preset.id === "neptun-october")
    return <img src="/brochure-presets/october/cover-preview.webp" alt="" />;
  const d = preset.design;
  const background =
    d.productBackgroundColor || d.productBackgroundGradient?.from || "#245b89";
  const price = d.offerStyle === "card" ? "#003870" : "#ef4023";
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="216" height="270" viewBox="0 0 216 270"><rect width="216" height="270" fill="${/^#[a-f0-9]{6}$/i.test(background) ? background : "#245b89"}"/><text x="108" y="28" text-anchor="middle" fill="white" font-family="Arial" font-size="20" font-weight="900">NEPTUN</text><path d="M62 34h92" stroke="#ef4023" stroke-width="3"/><g fill="#172d44" stroke="#95b8c8" stroke-width="1.4"><rect x="36" y="54" width="144" height="83"/><rect x="12" y="162" width="88" height="53"/><rect x="116" y="162" width="88" height="53"/></g><g fill="${price}"><rect x="135" y="127" width="46" height="20" rx="2"/><rect x="58" y="209" width="44" height="19" rx="2"/><rect x="162" y="209" width="44" height="19" rx="2"/></g><g fill="white" font-family="Arial" font-weight="700" font-size="12"><text x="142" y="141">299€</text><text x="64" y="223">249€</text><text x="168" y="223">199€</text></g><path d="M10 250h196" stroke="white" stroke-opacity=".4"/></svg>`;
  return (
    <img src={`data:image/svg+xml,${encodeURIComponent(source)}`} alt="" />
  );
}

export function BrochurePresetPicker({
  presets,
  value,
  onChange,
  onPreview,
}: {
  presets: readonly BrochurePreset[];
  value: string;
  onChange: (preset: BrochurePreset) => void;
  onPreview: (preset: BrochurePreset) => void;
}) {
  return (
    <section className="cs-preset-picker" aria-label={t("Brochure designs")}>
      <div className="cs-preset-picker-heading">
        <strong>{t("Choose a brochure design")}</strong>
        <small>{t("Everything remains editable.")}</small>
      </div>
      <div className="cs-preset-cards">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={`cs-preset-card ${value === preset.id ? "selected" : ""}`}
          >
            <button
              type="button"
              className="cs-preset-thumb"
              aria-label={`${t("Preview design")} ${preset.name}`}
              onClick={() => onPreview(preset)}
            >
              <PresetThumbnail preset={preset} />
              <span>{t("Preview")}</span>
            </button>
            <button
              type="button"
              className="cs-preset-select"
              aria-pressed={value === preset.id}
              onClick={() => onChange(preset)}
            >
              <span className="cs-preset-radio" aria-hidden="true" />
              {preset.name}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BrochurePresetPreview({
  preset,
  settings,
  onClose,
  onUse,
}: {
  preset: BrochurePresetDefinition;
  settings: Settings;
  onClose: () => void;
  onUse?: () => void;
}) {
  const [page, setPage] = useState<"cover" | "products" | "stores">("cover");
  const resolved = resolveSettings(settings);
  const campaign: Campaign = settingsPreviewCampaign(resolved);
  applyBrochurePreset(campaign, preset);
  const format = resolveBrochureFormat(campaign);
  return (
    <Modal
      title={`${t("Brochure preview")} · ${preset.name}`}
      kicker={t("Editable brochure design")}
      wide
      onClose={onClose}
    >
      <div
        className="cs-preset-preview-pages"
        role="group"
        aria-label={t("Preview page")}
      >
        {(["cover", "products", "stores"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={page === value}
            onClick={() => setPage(value)}
          >
            {t(
              value === "cover"
                ? "Cover"
                : value === "products"
                  ? "Product page"
                  : "Stores page",
            )}
          </button>
        ))}
      </div>
      <div className="cs-preset-preview-paper">
        <PreviewPaper ratio={format.ratio} aspectRatio={format.aspectRatio}>
          {page === "cover" ? (
            <CoverPage campaign={campaign} settings={resolved} />
          ) : page === "stores" ? (
            <StoresPage campaign={campaign} settings={resolved} />
          ) : (
            <ProductPage
              campaign={campaign}
              settings={resolved}
              page={splitPages(campaign)[0]!}
            />
          )}
        </PreviewPaper>
      </div>
      <p className="cs-preset-preview-note">
        {t(
          "Sample products illustrate the design. Upload your own cover photograph and edit every element in your brochure.",
        )}
      </p>
      <div className="cs-modal-actions">
        <button type="button" className="cs-button secondary" onClick={onClose}>
          {t("Close")}
        </button>
        {onUse && (
          <button type="button" className="cs-button primary" onClick={onUse}>
            {t("Use this design")}
          </button>
        )}
      </div>
    </Modal>
  );
}

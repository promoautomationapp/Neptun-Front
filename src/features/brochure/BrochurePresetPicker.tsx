import { useRef, useState } from "react";
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
import { isBlackFridayBrochure } from "./blackFridayDesign";
import { BlackFridayPersonChoice } from "./BlackFridayPersonChoice";
import { blackFridaySampleProducts } from "./blackFridaySourceImages";
import { coverRibbonColors } from "./coverElements";
import "./brochure-presets.css";
const isBlackFridayPreset = (preset: BrochurePresetDefinition) =>
  isBlackFridayBrochure({ ...preset.design, brochurePresetId: preset.id });

export function PresetThumbnail({
  preset,
}: {
  preset: BrochurePresetDefinition;
}) {
  const d = preset.design;
  if (isBlackFridayPreset(preset))
    return <img src="/brochure-presets/black-friday/thumbnail.webp" alt="" />;
  const color = (v: string | undefined, fallback: string) =>
    /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(v || "") ? v! : fallback;
  const from = color(
    d.coverBackgroundGradient?.from || d.coverBackgroundColor,
    "#234173",
  );
  const to = color(
    d.coverBackgroundGradient?.to || d.coverBackgroundColor,
    from,
  );
  const grayInside = d.productBackgroundColor === "#e3e3e3";
  const band = d.showCoverBand === true || d.coverBandVariant === "online";
  const price = d.offerStyle === "card" ? "#003870" : "#ff4228";
  const vertical = d.coverBackgroundGradient?.angle === 180;
  const ribbon = coverRibbonColors(d);
  const products = band
    ? '<rect x="15" y="177" width="80" height="49"/><rect x="121" y="177" width="80" height="49"/>'
    : '<rect x="30" y="65" width="156" height="78"/><rect x="13" y="169" width="88" height="56"/><rect x="115" y="169" width="88" height="56"/>';
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="216" height="270" viewBox="0 0 216 270"><defs><linearGradient id="bg" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient><linearGradient id="ribbon" x1="35%" x2="100%" y1="0%" y2="0%"><stop stop-color="${ribbon.from}"/><stop offset="1" stop-color="${ribbon.to}"/></linearGradient></defs><rect width="216" height="270" fill="url(#bg)"/><text x="108" y="24" text-anchor="middle" fill="white" font-family="Arial" font-size="20" font-weight="900">NEPTUN</text><path d="M62 30h92" stroke="#ff4228" stroke-width="3"/>${band ? `<rect x="9" y="41" width="198" height="78" rx="3" fill="white" fill-opacity=".06" stroke="white" stroke-opacity=".35" stroke-dasharray="3 3"/><path d="m95 91 14-16 14 16" fill="none" stroke="white" stroke-opacity=".6"/><text x="108" y="106" text-anchor="middle" fill="white" font-family="Arial" font-size="7">${t("Your cover image")}</text><path d="M0 131 216 119v42L0 170Z" fill="url(#${d.showCoverBand ? "ribbon" : "bg"})"/><text x="18" y="148" fill="white" font-family="Arial" font-size="${d.showCoverBand ? 40 : 22}" font-weight="900" font-style="italic">${d.showCoverBand ? "UUU" : "hajde!"}</text><text x="${d.showCoverBand ? 118 : 96}" y="155" fill="${d.coverBandVariant === "online" ? "#ff4228" : "white"}" font-family="Arial" font-size="${d.coverBandVariant === "online" ? 14 : 7}" font-weight="900">${d.coverBandVariant === "online" ? "Blej ONLINE" : "hajde!"}</text>` : '<text x="108" y="48" text-anchor="middle" fill="white" font-family="Arial" font-size="15" font-style="italic" font-weight="900">hajde!</text>'}<g fill="#182c42" stroke="#95b8c8" stroke-width="1">${products}</g><g fill="${price}"><rect x="66" y="222" width="35" height="13" rx="1"/><rect x="168" y="222" width="35" height="13" rx="1"/>${band ? "" : '<rect x="150" y="138" width="36" height="13" rx="1"/>'}</g><rect x="8" y="246" width="200" height="16" rx="2" fill="${grayInside ? "#e3e3e3" : "url(#bg)"}" stroke="white" stroke-opacity=".35"/><text x="108" y="257" text-anchor="middle" fill="${grayInside ? "#343534" : "white"}" font-family="Arial" font-size="7">${t("Inside pages")}</text></svg>`;
  return (
    <img src={`data:image/svg+xml,${encodeURIComponent(source)}`} alt="" />
  );
}

export function BrochurePresetPicker({
  presets,
  value,
  onChange,
  onPreview,
  compact = false,
}: {
  presets: readonly BrochurePreset[];
  value: string;
  onChange: (preset: BrochurePreset) => void;
  onPreview: (preset: BrochurePreset) => void;
  compact?: boolean;
}) {
  const [choosing, setChoosing] = useState(false);
  const [personPreset, setPersonPreset] = useState<BrochurePreset | null>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const selected = presets.find((preset) => preset.id === value) ?? presets[0];
  const closeChoices = () => {
    setChoosing(false);
    changeButton.current?.focus({ preventScroll: true });
  };
  const choose = (preset: BrochurePreset) => {
    if (isBlackFridayPreset(preset)) {
      setChoosing(false);
      setPersonPreset(preset);
      return;
    }
    onChange(preset);
    closeChoices();
  };
  const personChoice = personPreset && (
    <BlackFridayPersonChoice
      preset={personPreset}
      onClose={() => setPersonPreset(null)}
      onSelect={(preset) => {
        onChange(preset);
        setPersonPreset(null);
        closeChoices();
      }}
    />
  );
  const cards = (
    <div className={`cs-preset-cards ${compact ? "cs-preset-gallery" : ""}`}>
      {presets.map((preset) => (
        <div
          key={preset.id}
          className={`cs-preset-card ${value === preset.id ? "selected" : ""}`}
        >
          <button
            type="button"
            className="cs-preset-thumb"
            aria-label={`${t("Preview design")} ${t(preset.name)}`}
            onClick={() => {
              setChoosing(false);
              onPreview(preset);
            }}
          >
            <PresetThumbnail preset={preset} />
            <span>{t("View details")}</span>
          </button>
          <button
            type="button"
            className="cs-preset-select"
            aria-pressed={value === preset.id}
            onClick={() => {
              choose(preset);
            }}
          >
            <span className="cs-preset-radio" aria-hidden="true" />
            {t(preset.name)}
          </button>
        </div>
      ))}
    </div>
  );
  if (compact && selected)
    return (
      <>
        <section
          className="cs-preset-summary"
          aria-label={t("Brochure designs")}
        >
          <div className="cs-preset-summary-thumb" aria-hidden="true">
            <PresetThumbnail preset={selected} />
          </div>
          <div className="cs-preset-summary-name">
            <small>{t("Selected design")}</small>
            <strong>{t(selected.name)}</strong>
          </div>
          <button
            ref={changeButton}
            type="button"
            className="cs-preset-change"
            onClick={() => setChoosing(true)}
          >
            {t("Change design")}
          </button>
          {isBlackFridayPreset(selected) && (
            <button
              type="button"
              className="cs-preset-change"
              onClick={() => setPersonPreset(selected)}
            >
              {t("Person image")}
            </button>
          )}
        </section>
        {choosing && (
          <Modal
            title={t("Choose a brochure design")}
            onClose={closeChoices}
            wide
          >
            <p className="cs-preset-gallery-note">
              {t("Select a design to continue. You can change it later.")}
            </p>
            {cards}
            <div className="cs-modal-actions">
              <button
                type="button"
                className="cs-button secondary"
                onClick={closeChoices}
              >
                {t("Back")}
              </button>
            </div>
          </Modal>
        )}
        {personChoice}
      </>
    );
  return (
    <>
      <section className="cs-preset-picker" aria-label={t("Brochure designs")}>
        <div className="cs-preset-picker-heading">
          <strong>{t("Choose a brochure design")}</strong>
          <small>{t("Everything remains editable.")}</small>
        </div>
        {cards}
      </section>
      {personChoice}
    </>
  );
}

export function BrochurePresetPreview({
  preset,
  settings,
  onClose,
  onUse,
}: {
  preset: BrochurePreset;
  settings: Settings;
  onClose: () => void;
  onUse?: (preset: BrochurePreset) => void;
}) {
  const [page, setPage] = useState<"cover" | "products" | "stores">("cover");
  const [personChoice, setPersonChoice] = useState(false);
  const resolved = resolveSettings(settings);
  const campaign: Campaign = settingsPreviewCampaign(resolved);
  applyBrochurePreset(campaign, preset);
  if (isBlackFridayPreset(preset)) {
    campaign.products = blackFridaySampleProducts();
    campaign.coverProductCodes = campaign.products
      .filter((product) => product.brochurePage === 1)
      .map((product) => product.code);
  }
  const format = resolveBrochureFormat(campaign);
  if (personChoice)
    return (
      <BlackFridayPersonChoice
        preset={preset}
        onClose={() => setPersonChoice(false)}
        onSelect={(next) => onUse?.(next)}
      />
    );
  return (
    <Modal
      title={`${t("Brochure preview")} · ${t(preset.name)}`}
      kicker={t("Editable brochure design")}
      wide
      onClose={onClose}
    >
      {preset.description && (
        <p className="cs-preset-preview-description">{t(preset.description)}</p>
      )}
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
          <button
            type="button"
            className="cs-button primary"
            onClick={() =>
              isBlackFridayPreset(preset)
                ? setPersonChoice(true)
                : onUse(preset)
            }
          >
            {t("Use this design")}
          </button>
        )}
      </div>
    </Modal>
  );
}

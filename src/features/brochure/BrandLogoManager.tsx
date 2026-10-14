import type { Campaign, Product, CampaignMutator } from "../../domain/models";
import { requestAi } from "../ai/ai.api";
import React, { useState } from "react";
import { Button } from "./Modals";
import { t } from "./i18n";
import {
  brandLogoFor,
  BUILTIN_BRAND_LOGOS,
  rememberPreparedBrandLogo,
} from "./brandLogos";
import { readImage } from "./utils";
import { ImageUploadButton } from "./ImageUploadButton";

const sources: Record<string, string> = {
  BEKO: "/api/assets/legacy/assets/brand-sources/beko.jpg",
  CANDY: "/api/assets/legacy/assets/brand-sources/candy.jpg",
  FUEGO: "/api/assets/legacy/assets/brand-sources/fuego.jpg",
  LENOVO: "/api/assets/legacy/assets/brand-sources/lenovo.png",
  LG: "/api/assets/legacy/assets/brand-sources/lg.png",
  PHILIPS: "/api/assets/legacy/assets/brand-sources/philips.jpg",
  SAMSUNG: "/api/assets/legacy/assets/brand-sources/samsung.jpg",
  TCL: "/api/assets/legacy/assets/brand-sources/tcl-reference.png",
  BOSCH: "/api/assets/legacy/assets/brand-sources/bosch-reference.png",
  HP: "/api/assets/legacy/assets/brand-sources/hp-reference.png",
  XIAOMI: "/api/assets/legacy/assets/brand-sources/xiaomi-reference.png",
  TEFAL: "/api/assets/legacy/assets/brand-sources/tefal-reference.png",
  INSTA360: "/api/assets/legacy/assets/brand-sources/insta360-reference.png",
  APPLE: "/api/assets/legacy/assets/brand-sources/apple-reference.png",
  LOGITECH: "/api/assets/legacy/assets/brand-sources/logitech-reference.png",
};

export function BrandLogoManager({
  campaign,
  onUpdate,
}: {
  campaign: Campaign;
  onUpdate: (mutator: CampaignMutator) => void;
}) {
  const brands = [
    ...new Set(
      (campaign.products || [])
        .map((product: Product) =>
          String(product.brand || "")
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ].sort();
  const inferredSources = (campaign.products || []).reduce<
    Record<string, string>
  >((result, product: Product) => {
    const key = String(product.brand || "")
      .trim()
      .toUpperCase();
    if (!result[key])
      result[key] =
        (product.images || []).find((image: string) =>
          /[?&]width=80(?:&|$)/i.test(image),
        ) || "";
    return result;
  }, {});
  const [brand, setBrand] = useState(brands[0] || "");
  const [source, setSource] = useState("");
  const [prepared, setPrepared] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!brands.length) return null;
  const activeBrand = brands.includes(brand) ? brand : (brands[0] ?? "");
  async function prepare() {
    if (!source && BUILTIN_BRAND_LOGOS[activeBrand]) {
      setPrepared(BUILTIN_BRAND_LOGOS[activeBrand] ?? "");
      setError("");
      return;
    }
    const image =
      source || sources[activeBrand] || inferredSources[activeBrand];
    if (!image || busy) return;
    const retry = Boolean(error);
    setBusy(true);
    setError("");
    setPrepared("");
    try {
      const result = await requestAi("ai-white-brand-logo", {
        image,
        brand: activeBrand,
        ...(retry ? { retry: true } : {}),
      });
      rememberPreparedBrandLogo(activeBrand, result.url);
      setPrepared(result.url);
    } catch (cause) {
      setError(
        (cause instanceof Error ? cause.message : "") ||
          t("Could not prepare the logo."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="cs-brand-manager">
      <summary>
        <strong>{t("Brand logos")}</strong>
        <span>
          {t(
            "The same cropped logo appears black on light designs and white on dark designs in brochures and social posts. AI preparation is saved for reuse.",
          )}
        </span>
      </summary>
      <div className="cs-brand-grid">
        {brands.map((name) => (
          <button
            type="button"
            key={name}
            className={name === activeBrand ? "chosen" : ""}
            onClick={() => {
              setBrand(name);
              setSource("");
              setPrepared("");
              setError("");
            }}
          >
            <span>
              {brandLogoFor(campaign, name) ? (
                <img src={brandLogoFor(campaign, name)} alt="" />
              ) : (
                name
              )}
            </span>
            <b>{name}</b>
          </button>
        ))}
      </div>
      <div className="cs-brand-prepare">
        <strong>{activeBrand}</strong>
        <ImageUploadButton
          label={t("Upload brand artwork")}
          hint="PNG, JPG or WebP · up to 12 MB"
          value={source}
          onFile={async (file: File) => {
            if (file.size > 12 * 1024 * 1024) {
              setError(t("Choose an image under 12 MB."));
              return;
            }
            setSource(await readImage(file));
            setPrepared("");
          }}
          onRemove={() => {
            setSource("");
            setPrepared("");
          }}
        />
        <div className="cs-brand-logo-pair">
          <div className="light">
            <small>{t("Light background")}</small>
            {prepared || brandLogoFor(campaign, activeBrand) ? (
              <img
                src={prepared || brandLogoFor(campaign, activeBrand)}
                alt={`${activeBrand} black logo preview`}
              />
            ) : (
              <b>{activeBrand}</b>
            )}
          </div>
          <div className="dark">
            <small>{t("Dark background")}</small>
            {prepared || brandLogoFor(campaign, activeBrand) ? (
              <img
                src={prepared || brandLogoFor(campaign, activeBrand)}
                alt={`${activeBrand} white logo preview`}
              />
            ) : (
              <b>{activeBrand}</b>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="cs-image-error">
            {error}
          </p>
        )}
        {busy && (
          <div className="cs-image-progress" role="status">
            <i />
            {t("AI is preparing and saving the logo…")}
          </div>
        )}
        <div className="cs-brand-actions">
          <Button
            disabled={
              busy ||
              !(
                source ||
                BUILTIN_BRAND_LOGOS[activeBrand] ||
                sources[activeBrand] ||
                inferredSources[activeBrand]
              )
            }
            onClick={prepare}
          >
            {source || !BUILTIN_BRAND_LOGOS[activeBrand]
              ? t("Prepare logo with AI")
              : t("Use prepared logo")}
          </Button>
          <Button
            tone="primary"
            disabled={!prepared || busy}
            onClick={() => {
              rememberPreparedBrandLogo(activeBrand, prepared);
              onUpdate((draft) => {
                draft.brandLogos ||= {};
                draft.brandLogos[activeBrand] = prepared;
              });
              setPrepared("");
            }}
          >
            {t("Use logo")}
          </Button>
          {campaign.brandLogos?.[activeBrand] && (
            <Button
              onClick={() =>
                onUpdate((draft: Campaign) => {
                  draft.brandLogos ||= {};
                  draft.brandLogos[activeBrand] =
                    BUILTIN_BRAND_LOGOS[activeBrand] || "";
                })
              }
            >
              {BUILTIN_BRAND_LOGOS[activeBrand]
                ? t("Use built-in logo here")
                : t("Use brand name here")}
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}

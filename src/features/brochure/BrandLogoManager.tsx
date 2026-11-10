import type { Campaign, Product, CampaignMutator } from "../../domain/models";
import { requestAi } from "../ai/ai.api";
import React, { useState } from "react";
import { Button } from "./Modals";
import { t } from "./i18n";
import {
  brandLogoFor,
  BUILTIN_BRAND_LOGOS,
  rememberPreparedBrandLogo,
  normalizeBrandLogoName,
} from "./brandLogos";
import {
  applyBrandLogoToMatchingProducts,
  campaignBrandLogoProducts,
} from "./campaignBrandLogos";
import { readImage } from "./utils";
import { ImageUploadButton } from "./ImageUploadButton";
import { BrandLogoPreview, applyBrandLogoAppearance } from "./BrandLogoPreview";

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
  const products = campaignBrandLogoProducts(campaign);
  const brands = [
    ...new Set(
      products
        .map((product: Product) => normalizeBrandLogoName(product.brand))
        .filter(Boolean),
    ),
  ].sort();
  const inferredSources = products.reduce<Record<string, string>>(
    (result, product: Product) => {
      const key = normalizeBrandLogoName(product.brand);
      if (!result[key])
        result[key] =
          (product.images || []).find((image: string) =>
            /[?&]width=80(?:&|$)/i.test(image),
          ) || "";
      return result;
    },
    {},
  );
  const [brand, setBrand] = useState(brands[0] || "");
  const [source, setSource] = useState("");
  const [prepared, setPrepared] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  if (!brands.length) return null;
  const activeBrand = brands.includes(brand) ? brand : (brands[0] ?? "");
  const currentLogo = (name: string) =>
    products.find(
      (product) =>
        normalizeBrandLogoName(product.brand) === name && product.brandLogo,
    )?.brandLogo || brandLogoFor(campaign, name);
  const selectedLogo = prepared || source || currentLogo(activeBrand);
  const applyToAll = (image: string) => {
    rememberPreparedBrandLogo(activeBrand, image);
    onUpdate((draft) => {
      applyBrandLogoToMatchingProducts(draft, activeBrand, image);
    });
    setPrepared("");
    setSource("");
    setError("");
    setApplied(true);
  };
  async function prepare() {
    if (!source && BUILTIN_BRAND_LOGOS[activeBrand]) {
      setPrepared(BUILTIN_BRAND_LOGOS[activeBrand] ?? "");
      setError("");
      setApplied(false);
      return;
    }
    const image =
      source || sources[activeBrand] || inferredSources[activeBrand];
    if (!image || busy) return;
    const retry = Boolean(error);
    setBusy(true);
    setApplied(false);
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
      <BrandLogoPreview
        campaign={campaign}
        products={campaign.products || []}
        onChange={(changes) =>
          onUpdate((draft) => applyBrandLogoAppearance(draft, changes))
        }
      />
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
              setApplied(false);
            }}
          >
            <span>
              {currentLogo(name) ? (
                <img src={currentLogo(name)} alt="" />
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
            if (
              !file.type.startsWith("image/") ||
              file.size > 12 * 1024 * 1024
            ) {
              setError(t("Choose an image under 12 MB."));
              return;
            }
            try {
              setSource(await readImage(file));
              setPrepared("");
              setError("");
              setApplied(false);
            } catch {
              setError(t("Could not read this image."));
            }
          }}
          onRemove={() => {
            setSource("");
            setPrepared("");
            setApplied(false);
          }}
        />
        <div className="cs-brand-logo-pair">
          <div className="light">
            <small>{t("Light background")}</small>
            {selectedLogo ? (
              <img
                src={selectedLogo}
                alt={`${activeBrand} black logo preview`}
              />
            ) : (
              <b>{activeBrand}</b>
            )}
          </div>
          <div className="dark">
            <small>{t("Dark background")}</small>
            {selectedLogo ? (
              <img
                src={selectedLogo}
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
            disabled={!selectedLogo || busy}
            onClick={() => applyToAll(selectedLogo)}
          >
            {t("Apply to all {brand} products").replace("{brand}", activeBrand)}
          </Button>
          {(currentLogo(activeBrand) !==
            (BUILTIN_BRAND_LOGOS[activeBrand] || "") ||
            Object.hasOwn(campaign.brandLogos || {}, activeBrand)) && (
            <Button
              onClick={() => applyToAll(BUILTIN_BRAND_LOGOS[activeBrand] || "")}
            >
              {BUILTIN_BRAND_LOGOS[activeBrand]
                ? t("Use built-in logo for all matching products")
                : t("Use brand name for all matching products")}
            </Button>
          )}
        </div>
        {applied && (
          <small role="status">
            {t("Logo updated for all matching products in this brochure.")}
          </small>
        )}
      </div>
    </details>
  );
}

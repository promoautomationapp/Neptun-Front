import { useEffect, useMemo, useState } from "react";
import { getCatalogBrands } from "../../api/catalogBrands";
import type { CatalogBrand } from "../../api/catalogBrands";
import { resolveAsset } from "../../api/client";
import { backgroundReadability } from "../brochure/backgroundContrast";
import { brandLogoFor, BUILTIN_BRAND_LOGOS } from "../brochure/brandLogos";
import { AssetPicker, Field, Toggle } from "./components";
import type { SettingsTabProps } from "./SettingsEditor";
import "./brands.css";

const normalizeBrand = (value: string) => value.trim().toUpperCase();
const PAGE_SIZE = 24;
function BrandImage({ source, name }: { source: string; name: string }) {
  const [failedSource, setFailedSource] = useState("");
  return source && failedSource !== source ? (
    <img
      src={resolveAsset(source)}
      alt={name + " website logo"}
      loading="lazy"
      onError={() => setFailedSource(source)}
    />
  ) : (
    <span className="ns-brand-wordmark">{name}</span>
  );
}

export function BrandsTab({
  draft,
  update,
  brands = [],
}: SettingsTabProps & { brands?: string[] }) {
  const [sourceBrands, setSourceBrands] = useState<CatalogBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void getCatalogBrands(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSourceBrands(result.brands);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load website brands.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  const sourceByName = useMemo(
    () =>
      new Map(sourceBrands.map((brand) => [normalizeBrand(brand.name), brand])),
    [sourceBrands],
  );
  const available = useMemo(
    () =>
      [
        ...new Set(
          [
            ...brands,
            ...sourceBrands.map((brand) => brand.name),
            ...Object.keys(BUILTIN_BRAND_LOGOS),
            ...Object.keys(draft.brandLogos),
          ].map(normalizeBrand),
        ),
      ]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [brands, sourceBrands, draft.brandLogos],
  );
  const filtered = available.filter((brand) =>
    brand.includes(normalizeBrand(query)),
  );
  const currentBrand = filtered.includes(selected)
    ? selected
    : filtered[0] || "";
  const source = sourceByName.get(currentBrand);
  const hasOverride = Object.hasOwn(draft.brandLogos, currentBrand);
  const override = draft.brandLogos[currentBrand] || "";
  const hidden = hasOverride && !override;
  const background = draft.brochure.productBackground;
  const color = background.color || "#1c4075";
  const readability = backgroundReadability(
    background.image
      ? { kind: "image", color, image: background.image }
      : background.gradient
        ? { kind: "gradient", gradient: background.gradient }
        : { kind: "solid", color },
  );
  const previewBackground = background.image
    ? `url("${resolveAsset(background.image)}") center / cover`
    : background.gradient
      ? `linear-gradient(${background.gradient.angle}deg, ${background.gradient.from}, ${background.gradient.to})`
      : color;

  return (
    <section className="ns-section ns-brands-section">
      <div className="ns-brands-heading">
        <div>
          <h2>Brands</h2>
          <p>
            Browse brand images from Neptun and choose the logos used in new
            brochures. Your uploaded and saved logo choices stay in place when
            the catalog is refreshed.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {loading ? "Loading brands…" : "Refresh brand images"}
        </button>
      </div>
      {error && (
        <p className="ns-brands-status" role="alert">
          {error} Current brochure logos and saved choices are still available.
        </p>
      )}
      {!loading && sourceBrands.length === 0 && !error && (
        <p className="ns-brands-status" role="status">
          Website brand images will appear after the next product fetch. You can
          already upload logos or use the current brochure artwork.
        </p>
      )}
      <Field label="Search brands">
        <input
          type="search"
          value={query}
          placeholder="For example, Apple, Samsung, or Beko"
          onChange={(event) => {
            setQuery(event.target.value);
            setShown(PAGE_SIZE);
          }}
        />
      </Field>
      <p className="ns-brand-count" role="status">
        {filtered.length
          ? "Showing " +
            Math.min(shown, filtered.length) +
            " of " +
            filtered.length +
            " brands"
          : "No matching brands."}
      </p>
      <div className="ns-brand-gallery">
        {filtered.slice(0, shown).map((brand) => {
          const website = sourceByName.get(brand);
          const chosen = Object.hasOwn(draft.brandLogos, brand);
          return (
            <button
              type="button"
              key={brand}
              className={currentBrand === brand ? "selected" : ""}
              aria-pressed={currentBrand === brand}
              aria-label={"Choose " + brand + " brand"}
              onClick={() => setSelected(brand)}
            >
              <span className="ns-brand-thumb">
                <BrandImage
                  source={website?.image || website?.sourceImageUrl || ""}
                  name={brand}
                />
              </span>
              <strong>{brand}</strong>
              <small>
                {chosen
                  ? draft.brandLogos[brand]
                    ? "Custom brochure logo"
                    : "Logo hidden"
                  : website
                    ? "From Neptun website"
                    : "Current brochure artwork"}
              </small>
            </button>
          );
        })}
      </div>
      {shown < filtered.length && (
        <button
          type="button"
          onClick={() => setShown((value) => value + PAGE_SIZE)}
        >
          Show more brands
        </button>
      )}
      {currentBrand && (
        <fieldset className="ns-brand-editor">
          <legend>{currentBrand} · brochure logo</legend>
          <div className="ns-brand-comparison">
            <div>
              <span>Neptun website image</span>
              <div className="ns-brand-source-preview">
                <BrandImage
                  source={source?.image || source?.sourceImageUrl || ""}
                  name={currentBrand}
                />
              </div>
              {!source?.image && source?.sourceImageUrl && (
                <small>
                  The website image is being saved to the catalog. Refresh this
                  view once the fetch is complete.
                </small>
              )}
              {source?.image && (
                <button
                  type="button"
                  onClick={() =>
                    update((next) => {
                      next.brandLogos[currentBrand] = source.image;
                    })
                  }
                >
                  Use website image for {currentBrand}
                </button>
              )}
            </div>
            <div>
              <span>Logo in new brochures</span>
              <div
                className="ns-brand-brochure-preview"
                style={{
                  background: previewBackground,
                  color: readability.foreground,
                }}
              >
                {hidden ? (
                  <strong>{currentBrand}</strong>
                ) : brandLogoFor(draft, currentBrand) ? (
                  <img
                    src={resolveAsset(brandLogoFor(draft, currentBrand))}
                    alt={currentBrand + " brochure logo"}
                    style={{ filter: readability.brandFilter }}
                  />
                ) : (
                  <strong>{currentBrand}</strong>
                )}
              </div>
              <small>
                {hidden
                  ? "Hidden logo: the brand name will appear as text."
                  : hasOverride
                    ? "Your selected logo overrides the current brochure artwork."
                    : "Current brochure artwork. Website refreshes do not replace it."}
              </small>
            </div>
          </div>
          <Toggle
            label={"Hide " + currentBrand + " logo"}
            checked={hidden}
            onChange={(hide) =>
              update((next) => {
                if (hide) next.brandLogos[currentBrand] = "";
                else delete next.brandLogos[currentBrand];
              })
            }
          />
          {!hidden && (
            <AssetPicker
              label={currentBrand + " logo"}
              value={override}
              defaultImage={brandLogoFor(undefined, currentBrand)}
              defaultHint="The brand name is shown until a logo is selected."
              library={draft.logoLibrary}
              onUpload={(asset) =>
                update((next) => {
                  next.logoLibrary.push(asset);
                })
              }
              onChange={(image) =>
                update((next) => {
                  if (image) next.brandLogos[currentBrand] = image;
                  else delete next.brandLogos[currentBrand];
                })
              }
            />
          )}
          {hasOverride && (
            <button
              type="button"
              onClick={() =>
                update((next) => {
                  delete next.brandLogos[currentBrand];
                })
              }
            >
              Restore current {currentBrand} logo
            </button>
          )}
          <p className="ns-brand-editor-note">
            Saving applies this choice to new brochures. Existing brochures keep
            their own editable logos.
          </p>
        </fieldset>
      )}
    </section>
  );
}

import { useState } from "react";
import type { Product } from "../../domain/models";
import { resolveAsset } from "../../api/client";
import { t } from "../brochure/i18n";
import "./product-details.css";

function imageKey(source: string) {
  try {
    const url = new URL(source, "https://catalog.local");
    for (const key of ["width", "height", "w", "h", "quality", "q"])
      url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch {
    return source;
  }
}
function imageResolution(source: string) {
  try {
    const url = new URL(source, "https://catalog.local");
    const value = Number(
      url.searchParams.get("width") || url.searchParams.get("w"),
    );
    return value > 0 ? value : Infinity;
  } catch {
    return Infinity;
  }
}
/** Keep every known photo, while collapsing thumbnail/resize variants of the same source. */
export function productGalleryImages(
  product: Product,
  catalogProduct?: Product,
) {
  const result = new Map<string, string>();
  for (const item of [product, catalogProduct]) {
    if (!item) continue;
    for (const value of [
      item.image,
      item.imageUrl,
      item.localImage,
      ...(item.images || []),
      ...(item.imageChoices || []),
      item.aiOriginalImage,
      item.originalImage,
      item.preview,
      item.thumbnail,
    ]) {
      if (typeof value !== "string" || !value.trim()) continue;
      const source = resolveAsset(value.trim());
      if (!/^(?:https?:\/\/|\/|blob:|data:image\/)/i.test(source)) continue;
      const key = imageKey(source);
      const existing = result.get(key);
      if (!existing || imageResolution(source) > imageResolution(existing))
        result.set(key, source);
    }
  }
  return [...result.values()];
}
export function ProductGallery({
  product,
  catalogProduct,
  loading = false,
  onRetry,
}: {
  product: Product;
  catalogProduct?: Product;
  loading?: boolean;
  onRetry?: () => void;
}) {
  const photos = productGalleryImages(product, catalogProduct);
  return (
    <Gallery
      key={product.code}
      photos={photos}
      name={product.name}
      loading={loading}
      onRetry={onRetry}
    />
  );
}
function Gallery({
  photos,
  name,
  loading,
  onRetry,
}: {
  photos: string[];
  name: string;
  loading: boolean;
  onRetry?: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const available = photos.filter((source) => !failed.includes(source));
  const index = Math.max(0, available.indexOf(selected));
  const current = available[index];
  function move(offset: number) {
    const source =
      available[(index + offset + available.length) % available.length];
    if (source) setSelected(source);
  }
  return (
    <section
      className="np-product-gallery"
      aria-label={t("Product photos")}
      aria-roledescription={t("Photo carousel")}
      tabIndex={available.length > 1 ? 0 : undefined}
      onKeyDown={(event) => {
        if (available.length < 2) return;
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          if (event.key === "Home") setSelected(available[0]!);
          else if (event.key === "End") setSelected(available.at(-1)!);
          else move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <div className="np-gallery-stage">
        {current ? (
          <img
            key={current}
            className="np-gallery-main"
            src={current}
            alt={`${name} · ${t("Photo")} ${index + 1}`}
            referrerPolicy="no-referrer"
            onError={() => setFailed((previous) => [...previous, current])}
          />
        ) : (
          <div className="np-gallery-empty">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect x="4" y="5" width="24" height="22" rx="4" />
              <circle cx="12" cy="12" r="2" />
              <path d="m5 23 8-8 6 6 4-4 5 5" />
            </svg>
            <span>
              {t(
                loading
                  ? "Loading product photos…"
                  : "No product photos available",
              )}
            </span>
          </div>
        )}
        {available.length > 1 && (
          <>
            <button
              type="button"
              className="np-gallery-arrow previous"
              aria-label={t("Previous photo")}
              onClick={() => move(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="np-gallery-arrow next"
              aria-label={t("Next photo")}
              onClick={() => move(1)}
            >
              ›
            </button>
          </>
        )}
        {current && (
          <span className="np-gallery-counter" aria-hidden="true">
            {index + 1} / {available.length}
          </span>
        )}
      </div>
      <div className="np-gallery-caption">
        <span role="status" aria-live="polite">
          {current
            ? `${t("Photo")} ${index + 1} / ${available.length}`
            : t("Product photos")}
          {loading && current ? ` · ${t("Loading more photos…")}` : ""}
        </span>
        {current && (
          <a
            href={current}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("Open full-size photo")}
          >
            {t("Full size")} ↗
          </a>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry}>
            {t("Reload photos")}
          </button>
        )}
      </div>
      {available.length > 1 && (
        <div
          className="np-gallery-thumbnails"
          role="group"
          aria-label={t("Choose product photo")}
        >
          {available.map((source, number) => (
            <button
              type="button"
              key={source}
              className={source === current ? "selected" : ""}
              aria-label={`${t("Show photo")} ${number + 1}`}
              aria-pressed={source === current}
              onClick={() => setSelected(source)}
            >
              <img
                src={source}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setFailed((previous) => [...previous, source])}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function productWebsiteLink(
  value?: string,
): { href: string; host: string } | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, "https://www.neptun-ks.com");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return { href: url.href, host: url.hostname.replace(/^www\./i, "") };
  } catch {
    return null;
  }
}

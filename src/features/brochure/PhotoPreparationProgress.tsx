import React, { useEffect, useState } from "react";
import type { Campaign } from "../../domain/models";
import { t } from "./i18n";
import "../../styles/photo-preparation-progress.css";
export interface PhotoProgressItem {
  key: string;
  code: string;
  name: string;
  image?: string;
  state: "queued" | "preparing" | "saving" | "ready" | "original" | "failed";
}
export function PhotoPreparationProgress({
  items,
  campaign,
  onRetry,
  onEdit,
}: {
  items: PhotoProgressItem[];
  campaign: Campaign;
  onRetry: () => void;
  onEdit: (code: string) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const ready = items.filter((x) => x.state === "ready").length,
    originals = items.filter((x) => x.state === "original"),
    failed = items.filter((x) => x.state === "failed"),
    active = items.filter(
      (x) => x.state === "preparing" || x.state === "saving",
    ),
    queued = items.filter((x) => x.state === "queued").length;
  const finished = ready + originals.length + failed.length,
    percent = Math.round((finished / items.length) * 100),
    busy = finished < items.length;
  useEffect(() => {
    setDismissed(false);
    if (busy || failed.length || !items.length) return;
    const timer = window.setTimeout(() => setDismissed(true), 4000);
    return () => window.clearTimeout(timer);
  }, [busy, failed.length, campaign.id, items.length]);
  if (!items.length || dismissed) return null;
  const missing = campaign.products
    .flatMap((p) => (p.bundleProducts?.length ? p.bundleProducts : [p]))
    .filter((p) => !p.image && !p.localImage && !p.imageUrl).length;
  return (
    <section
      className={`cs-photo-progress ${busy ? "is-active" : ""}`}
      aria-label={t("Product photo preparation")}
    >
      <div className="cs-photo-progress-heading">
        <span className="cs-photo-progress-icon" aria-hidden="true">
          {busy ? "◌" : failed.length ? "!" : "✓"}
        </span>
        <div>
          <h3>
            {t(
              busy
                ? "Preparing product photos…"
                : failed.length
                  ? "Photo preparation needs attention"
                  : "Product photos are ready",
            )}
          </h3>
          <p role="status" aria-live="polite">
            {ready} / {items.length} {t("ready")}
            {originals.length > 0
              ? ` · ${originals.length} ${t("Using original photo")}`
              : ""}
            {queued > 0 ? ` · ${queued} ${t("waiting")}` : ""}
            {failed.length ? ` · ${failed.length} ${t("need attention")}` : ""}
          </p>
        </div>
        <strong>{percent}%</strong>
      </div>
      <progress
        aria-label={t("Photo preparation progress")}
        value={finished}
        max={items.length}
      />
      <p className="cs-photo-progress-note">
        {t(
          "Your brochure stays editable. Each finished photo is saved automatically. Prepared images are reused when available.",
        )}
      </p>
      {active.length > 0 && (
        <div className="cs-photo-progress-current">
          {active.map((item) => (
            <div key={item.key}>
              {item.image && <img src={item.image} alt="" />}
              <span>
                <small>
                  {t(
                    item.state === "saving"
                      ? "Saving photo…"
                      : "Preparing / waiting for AI",
                  )}
                </small>
                <strong>{item.name}</strong>
                <small>{item.code}</small>
              </span>
            </div>
          ))}
        </div>
      )}
      {(failed.length > 0 || missing > 0 || originals.length > 0) && (
        <div className="cs-photo-progress-actions">
          {originals.length > 0 && (
            <>
              <span>
                {t(
                  "Original photos remain in your brochure. You can keep editing or upload a replacement.",
                )}
              </span>
              {originals.slice(0, 3).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onEdit(item.code)}
                >
                  {t("Upload / edit photo")} · {item.name}
                </button>
              ))}
            </>
          )}
          {failed.length > 0 && (
            <>
              <span>{t("Some photos need a retry or your own upload.")}</span>
              <button type="button" disabled={busy} onClick={onRetry}>
                {t("Retry failed photos")}
              </button>
              {failed.slice(0, 3).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onEdit(item.code)}
                >
                  {t("Upload / edit photo")} · {item.name}
                </button>
              ))}
            </>
          )}
          {missing > 0 && (
            <span>
              {missing}{" "}
              {t(
                "products still need a photo. Use Products & prices to upload images or identify the model.",
              )}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

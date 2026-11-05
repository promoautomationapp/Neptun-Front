import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Campaign } from "../../domain/models";
import { CloseButton } from "../../components/CloseButton";
import { t } from "./i18n";
import "../../styles/photo-preparation-progress.css";
export interface PhotoProgressItem {
  key: string;
  code: string;
  name: string;
  image?: string;
  state:
    | "queued"
    | "preparing"
    | "retrying"
    | "saving"
    | "ready"
    | "original"
    | "failed";
  retryAttempt?: number;
  retryLimit?: number;
}

function progressLabel(item: PhotoProgressItem) {
  if (item.state === "retrying")
    return `${t("Retrying photo")} · ${item.retryAttempt ?? 1}/${item.retryLimit ?? 3}`;
  return t(
    item.state === "saving"
      ? "Saving photo…"
      : item.state === "ready"
        ? "ready"
        : item.state === "queued"
          ? "waiting"
          : item.state === "original"
            ? "Original photo — background removal incomplete"
            : item.state === "failed"
              ? "Photo preparation could not finish"
              : "Preparing / waiting for AI",
  );
}

function missingPhotoReason(status?: string) {
  return t(
    status === "searching"
      ? "Searching for the exact product photo…"
      : status === "not_found"
        ? "Exact product photo not found"
        : status === "failed"
          ? "Photo search could not finish"
          : "No photo has been added yet",
  );
}

/** Closing this editor notice never cancels the independent preparation queue. */
function PreparationDetails({
  id,
  onClose,
  children,
}: {
  id: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (element?.showModal) element.showModal();
    else element?.setAttribute("open", "");
    return () => {
      element?.close?.();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      id={id}
      className="cs-photo-progress-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="cs-photo-progress-dialog-content">
        <header className="cs-photo-progress-dialog-header">
          <h2 id={`${id}-title`}>{t("Photo preparation details")}</h2>
          <CloseButton onClick={onClose} />
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

export function PhotoPreparationProgress({
  items,
  campaign,
  onRetry,
  onEdit,
  onCancelWaiting,
}: {
  items: PhotoProgressItem[];
  campaign: Campaign;
  onRetry: () => void;
  onEdit: (code: string) => void;
  onCancelWaiting?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const dialogId = useId();
  const ready = items.filter((item) => item.state === "ready").length;
  const originals = items.filter((item) => item.state === "original");
  const failed = items.filter((item) => item.state === "failed");
  const active = items.filter((item) =>
    ["preparing", "retrying", "saving"].includes(item.state),
  );
  const queued = items.filter((item) => item.state === "queued").length;
  const preparing = ready + originals.length + failed.length < items.length;
  const retrying = active.some((item) => item.state === "retrying");
  const missing = campaign.products.flatMap((offer) =>
    (offer.bundleProducts?.length ? offer.bundleProducts : [offer])
      .filter(
        (product) => !product.image && !product.localImage && !product.imageUrl,
      )
      .map((product) => ({
        ...product,
        editCode: String(offer.code),
        key: JSON.stringify([offer.code, product.code]),
      })),
  );
  const searching = missing.filter(
    (product) => product.imageSearch?.status === "searching",
  );
  const missingPhotos = missing.filter(
    (product) => product.imageSearch?.status !== "searching",
  );
  const busy = preparing || searching.length > 0;
  const needsAttention =
    originals.length + failed.length + missingPhotos.length > 0;
  const percent = items.length ? Math.round((ready / items.length) * 100) : 0;
  const title = busy
    ? retrying
      ? "Retrying some product photos…"
      : preparing
        ? "Preparing product photos…"
        : "Searching for the exact product photo…"
    : needsAttention
      ? "Photo preparation needs attention"
      : "Product photos are ready";
  const summary = [
    items.length ? `${t("Prepared photos")}: ${ready}` : "",
    queued ? `${queued} ${t("waiting")}` : "",
    originals.length ? `${t("Original photos")}: ${originals.length}` : "",
    failed.length ? `${failed.length} ${t("need attention")}` : "",
    searching.length
      ? `${searching.length} ${t("Searching for product photos")}`
      : "",
    missing.length ? `${t("Missing photos")}: ${missing.length}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  useEffect(() => {
    setDismissed(false);
    if (busy || needsAttention || detailsOpen || !items.length) return;
    const timer = window.setTimeout(() => setDismissed(true), 4000);
    return () => window.clearTimeout(timer);
  }, [busy, needsAttention, detailsOpen, campaign.id, items.length]);
  if ((!items.length && !missing.length) || dismissed) return null;
  const editPhoto = (code: string) => {
    setDetailsOpen(false);
    onEdit(code);
  };
  return (
    <>
      <section
        className={`cs-photo-progress ${busy ? "is-active" : ""}`}
        aria-label={t("Product photo preparation")}
      >
        <button
          type="button"
          className="cs-photo-progress-notice"
          onClick={() => setDetailsOpen(true)}
          aria-label={t("View photo preparation details")}
          aria-haspopup="dialog"
          aria-expanded={detailsOpen}
          aria-controls={dialogId}
        >
          <span className="cs-photo-progress-icon" aria-hidden="true">
            {busy ? "◌" : needsAttention ? "!" : "✓"}
          </span>
          <span className="cs-photo-progress-copy">
            <strong>{t(title)}</strong>
            <span role="status" aria-live="polite">
              {summary}
            </span>
          </span>
          <span className="cs-photo-progress-view">
            {t("View details")} <span aria-hidden="true">›</span>
          </span>
        </button>
      </section>
      {detailsOpen && (
        <PreparationDetails id={dialogId} onClose={() => setDetailsOpen(false)}>
          <div className="cs-photo-progress-detail-heading">
            <strong>{t(title)}</strong>
            {items.length > 0 && <b>{percent}%</b>}
          </div>
          <p className="cs-photo-progress-detail-summary">{summary}</p>
          {items.length > 0 && (
            <p className="cs-photo-progress-detail-scope">
              {t("Photos selected for preparation")}: {ready} / {items.length}{" "}
              {t("ready")}
            </p>
          )}
          {items.length > 0 && (
            <progress
              aria-label={t("Photo preparation progress")}
              value={ready}
              max={items.length}
            />
          )}
          {ready > 0 && (
            <p className="cs-photo-progress-detail-note">
              {t(
                missing.length > 0
                  ? "Finished photos have been saved. You can upload the missing photos or correct the product name and model in Products & prices."
                  : "Finished photos have been saved.",
              )}
            </p>
          )}
          {originals.length > 0 && (
            <p className="cs-photo-progress-detail-note">
              {t(
                "Original photos are still in use; their backgrounds have not been removed completely.",
              )}
            </p>
          )}
          {items.length > 0 && missing.length > 0 && (
            <p className="cs-photo-progress-detail-note">
              {t(
                "Missing photos are counted separately from background-removal progress.",
              )}
            </p>
          )}
          {items.length > 0 && (
            <ul
              className="cs-photo-progress-list"
              aria-label={t("Product photo preparation")}
            >
              {items.map((item) => (
                <li key={item.key}>
                  <div className="cs-photo-progress-product">
                    <strong>{item.name}</strong>
                    <small>{item.code}</small>
                    <span>{progressLabel(item)}</span>
                  </div>
                  {["original", "failed"].includes(item.state) && (
                    <button
                      type="button"
                      onClick={() => editPhoto(item.code)}
                      aria-label={`${t("Upload / edit photo")} · ${item.name}`}
                    >
                      {t("Upload / edit photo")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && (
            <section className="cs-photo-progress-missing">
              <h3>
                {t("Photos without an image")} · {missing.length}
              </h3>
              <p>
                {t(
                  "Upload a photo with Upload / edit photo, or complete the exact product name and model in Products & prices.",
                )}
              </p>
              <ul className="cs-photo-progress-list">
                {missing.map((product) => (
                  <li key={product.key}>
                    <div className="cs-photo-progress-product">
                      <strong>{product.name}</strong>
                      <small>{product.code}</small>
                      <span>
                        {missingPhotoReason(product.imageSearch?.status)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => editPhoto(product.editCode)}
                      aria-label={`${t("Upload / edit photo")} · ${product.name}`}
                    >
                      {t("Upload / edit photo")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(failed.length > 0 || originals.length > 0) && (
            <p className="cs-photo-progress-detail-note">
              {t("Some photos need a retry or your own upload.")}
            </p>
          )}
          <footer className="cs-photo-progress-dialog-actions">
            {queued > 0 && onCancelWaiting && (
              <button type="button" onClick={onCancelWaiting}>
                {t("Stop waiting photos")} · {queued}
              </button>
            )}
            {(failed.length > 0 || originals.length > 0) && (
              <button type="button" disabled={busy} onClick={onRetry}>
                {t("Retry failed photos")}
              </button>
            )}
          </footer>
          {queued > 0 && onCancelWaiting && (
            <p className="cs-photo-progress-detail-note">
              {t(
                "Only photos already running will finish. Waiting photos have not been sent to AI.",
              )}
            </p>
          )}
        </PreparationDetails>
      )}
    </>
  );
}

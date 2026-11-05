import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { Campaign } from "../../domain/models";
import type { PhotoProgressItem } from "./PhotoPreparationProgress";
import { t } from "./i18n";
import "../../styles/photo-preparation-modal.css";

export interface PhotoPreparationModalProps {
  campaign: Campaign;
  items: PhotoProgressItem[];
  busy: boolean;
  error?: string;
  onRetry: () => void;
  onOpenBrochure: () => void;
}

function photoStatus(item: PhotoProgressItem) {
  if (item.state === "retrying")
    return `${t("Retrying photo")} · ${item.retryAttempt ?? 1}/${item.retryLimit ?? 3}`;
  return t(
    item.state === "checking"
      ? "Checking saved photo…"
      : item.state === "saving"
        ? "Saving photo…"
        : item.state === "queued"
          ? "waiting"
          : item.state === "original"
            ? "Original photo — background removal incomplete"
            : item.state === "failed"
              ? "Photo preparation could not finish"
              : "Preparing / waiting for AI",
  );
}

/** Import/create gate: dismissal is available after preparation and persistence
 * settle, then the brochure opens for editing and manual photo uploads. */
export function PhotoPreparationModal({
  campaign,
  items,
  busy,
  error,
  onRetry,
  onOpenBrochure,
}: PhotoPreparationModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (element?.showModal) element.showModal();
    else element?.setAttribute("open", "");
    heading.current?.focus();
    return () => {
      element?.close?.();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);

  const products = campaign.products.flatMap((product) =>
    product.bundleProducts?.length ? product.bundleProducts : [product],
  );
  const searching = products.filter(
    (product) =>
      !product.image &&
      !product.localImage &&
      !product.imageUrl &&
      product.imageSearch?.status === "searching",
  );
  const searchFailures = products.filter(
    (product) =>
      !product.image &&
      !product.localImage &&
      !product.imageUrl &&
      product.imageSearch?.status !== "searching",
  );
  const ready = items.filter((item) => item.state === "ready").length;
  const queued = items.filter((item) => item.state === "queued").length;
  const unfinished = items.filter((item) =>
    ["checking", "preparing", "retrying", "saving", "queued"].includes(
      item.state,
    ),
  );
  const attention = items.filter((item) =>
    ["original", "failed"].includes(item.state),
  );
  const total = items.length + searching.length + searchFailures.length;
  const percent = total ? Math.round((ready / total) * 100) : null;
  const retrying = items.some((item) => item.state === "retrying");
  const checking = items.some((item) => item.state === "checking");
  const needsAttention = Boolean(
    error ||
    attention.length ||
    searchFailures.length ||
    (!busy && searching.length),
  );
  const title = busy
    ? checking
      ? "Checking saved product photos…"
      : retrying
        ? "Retrying some product photos…"
        : "Preparing product photos…"
    : needsAttention
      ? "Photo preparation needs attention"
      : "Product photos are ready";
  const visibleWork = (busy ? unfinished : attention).slice(0, 4);

  return createPortal(
    <dialog
      ref={dialog}
      className="cs-photo-preparation-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      data-preparation-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onOpenBrochure();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onOpenBrochure();
        }
      }}
    >
      <div className="cs-photo-preparation-content">
        {!busy && (
          <button
            type="button"
            className="cs-photo-preparation-close"
            aria-label={t("Close")}
            title={t("Close")}
            onClick={onOpenBrochure}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        )}
        <header className="cs-photo-preparation-heading">
          <span
            className={`cs-photo-preparation-symbol ${busy ? "is-running" : ""}`}
            aria-hidden="true"
          >
            {busy ? "" : needsAttention ? "!" : "✓"}
          </span>
          <div>
            <p className="cs-photo-preparation-kicker">
              {t(checking ? "Saved product photos" : "AI photo preparation")}
            </p>
            <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>
              {t(title)}
            </h2>
            <p className="cs-photo-preparation-campaign">{campaign.name}</p>
          </div>
        </header>
        <p
          id={`${id}-description`}
          className="cs-photo-preparation-description"
        >
          {t(
            busy
              ? checking
                ? "We are checking saved photos first. Finished cutouts are reused without new AI processing."
                : "We are removing photo backgrounds and saving the finished images before opening your brochure."
              : "Processing has finished. You can retry the unfinished photos or open the brochure and upload them manually.",
          )}
        </p>
        <div
          className="cs-photo-preparation-progress-heading"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>
            {total > 0
              ? `${ready} / ${total} ${t("ready")}`
              : t(
                  busy
                    ? "Starting photo preparation…"
                    : "Photo preparation needs attention",
                )}
            {queued > 0 ? ` · ${queued} ${t("waiting")}` : ""}
            {searching.length > 0
              ? ` · ${searching.length} ${t("Searching for product photos")}`
              : ""}
            {attention.length > 0
              ? ` · ${t("Photos needing preparation")}: ${attention.length}`
              : ""}
            {searchFailures.length > 0
              ? ` · ${t("Missing photos")}: ${searchFailures.length}`
              : ""}
          </span>
          {percent !== null && <strong>{percent}%</strong>}
        </div>
        <progress
          aria-label={t("Photo preparation progress")}
          value={total ? ready : busy ? undefined : 0}
          max={total || 1}
        />
        {!busy && needsAttention && ready > 0 && (
          <p className="cs-photo-preparation-description">
            {t(
              "Finished photos have been saved. You can upload the missing photos or correct the product name and model in Products & prices.",
            )}
          </p>
        )}
        {(visibleWork.length > 0 ||
          searching.length > 0 ||
          (!busy && searchFailures.length > 0)) && (
          <ul
            className="cs-photo-preparation-list"
            aria-label={t("Product photo preparation")}
          >
            {visibleWork.map((item) => (
              <li key={item.key}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.code}</small>
                </div>
                <span>{photoStatus(item)}</span>
              </li>
            ))}
            {searching.slice(0, 4).map((product) => (
              <li key={`search:${product.code}`}>
                <div>
                  <strong>{product.name}</strong>
                  <small>{product.code}</small>
                </div>
                <span>{t("Searching for the exact product photo…")}</span>
              </li>
            ))}
            {!busy &&
              searchFailures.slice(0, 4).map((product) => (
                <li key={`missing:${product.code}`}>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.code}</small>
                  </div>
                  <span>
                    {t(
                      product.imageSearch?.status === "not_found"
                        ? "Exact product photo not found"
                        : product.imageSearch?.status === "failed"
                          ? "Photo search could not finish"
                          : "No photo has been added yet",
                    )}
                  </span>
                </li>
              ))}
          </ul>
        )}
        {error && (
          <p className="cs-photo-preparation-error" role="alert">
            {t(error)}
          </p>
        )}
        {!busy && (
          <footer className="cs-photo-preparation-actions">
            {needsAttention && (
              <button type="button" onClick={onRetry} disabled={busy}>
                {t("Retry failed photos")}
              </button>
            )}
            <button
              type="button"
              className="is-primary"
              onClick={onOpenBrochure}
            >
              {t("Close and upload photos")}
            </button>
          </footer>
        )}
      </div>
    </dialog>,
    document.body,
  );
}

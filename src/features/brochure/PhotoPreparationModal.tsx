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
  onReturnToProducts: () => void;
}

function photoStatus(item: PhotoProgressItem) {
  if (item.state === "retrying")
    return `${t("Retrying photo")} · ${item.retryAttempt ?? 1}/${item.retryLimit ?? 3}`;
  return t(
    item.state === "saving"
      ? "Saving photo…"
      : item.state === "queued"
        ? "waiting"
        : item.state === "original"
          ? "Using original photo"
          : item.state === "failed"
            ? "need attention"
            : "Preparing / waiting for AI",
  );
}

/** Import/create gate: the parent releases the brochure only after preparation
 * and persistence settle. Neither Escape nor a backdrop click skips this step. */
export function PhotoPreparationModal({
  campaign,
  items,
  busy,
  error,
  onRetry,
  onReturnToProducts,
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
    (product) => product.imageSearch?.status === "searching",
  );
  const searchFailures = products.filter(
    (product) =>
      !product.image &&
      ["failed", "not_found"].includes(product.imageSearch?.status || ""),
  );
  const ready = items.filter((item) => item.state === "ready").length;
  const queued = items.filter((item) => item.state === "queued").length;
  const unfinished = items.filter((item) =>
    ["preparing", "retrying", "saving", "queued"].includes(item.state),
  );
  const attention = items.filter((item) =>
    ["original", "failed"].includes(item.state),
  );
  const total = items.length + searching.length + searchFailures.length;
  const percent = total ? Math.round((ready / total) * 100) : null;
  const retrying = items.some((item) => item.state === "retrying");
  const needsAttention = Boolean(
    error ||
    attention.length ||
    searchFailures.length ||
    (!busy && searching.length),
  );
  const title = busy
    ? retrying
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
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="cs-photo-preparation-content">
        <header className="cs-photo-preparation-heading">
          <span
            className={`cs-photo-preparation-symbol ${busy ? "is-running" : ""}`}
            aria-hidden="true"
          >
            {busy ? "" : needsAttention ? "!" : "✓"}
          </span>
          <div>
            <p className="cs-photo-preparation-kicker">
              {t("AI photo preparation")}
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
              ? "We are removing photo backgrounds and saving the finished images before opening your brochure."
              : "The brochure stays hidden until its photos are ready. Retry or return to Products & prices to repair the photos.",
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
            {attention.length + searchFailures.length > 0
              ? ` · ${attention.length + searchFailures.length} ${t("need attention")}`
              : ""}
          </span>
          {percent !== null && <strong>{percent}%</strong>}
        </div>
        <progress
          aria-label={t("Photo preparation progress")}
          value={total ? ready : busy ? undefined : 0}
          max={total || 1}
        />
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
                  <span>{t("Photo needed")}</span>
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
              onClick={onReturnToProducts}
            >
              {t("Return to Products & prices")}
            </button>
          </footer>
        )}
      </div>
    </dialog>,
    document.body,
  );
}

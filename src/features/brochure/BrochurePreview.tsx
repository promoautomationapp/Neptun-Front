import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Campaign, Settings } from "../../domain/models";
import { CoverPage, ProductPage, StoresPage, splitPages } from "./Brochure";
import { includesStoresPage } from "./storesSelection";
import { t } from "./i18n";
import { resolveBrochureFormat } from "./brochureFormat";

export function BrochurePreview({
  campaign,
  settings,
  selected,
  onSelect,
  onClose,
  onExport,
}: {
  campaign: Campaign;
  settings: Settings;
  selected: number;
  onSelect: (page: number) => void;
  onClose: () => void;
  onExport: (page: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const pages = splitPages(campaign);
  const last = pages.length - (includesStoresPage(campaign) ? 0 : 1);
  const current = Math.max(-1, Math.min(last, selected));
  const count = last + 2;
  const title = (index: number) =>
    index === -1
      ? t("Cover")
      : index === pages.length
        ? t("Stores & details")
        : `${t("Page")} ${index + 2}`;
  const renderPage = (index: number) =>
    index === -1 ? (
      <CoverPage campaign={campaign} />
    ) : index === pages.length ? (
      <StoresPage campaign={campaign} settings={settings} />
    ) : (
      <ProductPage
        campaign={campaign}
        settings={settings}
        page={pages[index]!}
      />
    );
  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement as HTMLElement | null;
    if (element?.showModal) element.showModal();
    else element?.setAttribute("open", "");
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close?.();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);
  useEffect(() => {
    strip.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [current]);
  return createPortal(
    <dialog
      ref={dialog}
      className="cs-brochure-preview-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t("Brochure preview")}
      style={
        {
          "--brochure-preview-ratio": resolveBrochureFormat(campaign).ratio,
        } as React.CSSProperties
      }
      data-theme={document.documentElement.dataset.theme || "light"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (
          (event.target as Element).closest(
            "input, textarea, select, [contenteditable='true']",
          )
        )
          return;
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          onSelect(
            event.key === "Home"
              ? -1
              : event.key === "End"
                ? last
                : Math.max(
                    -1,
                    Math.min(
                      last,
                      current + (event.key === "ArrowLeft" ? -1 : 1),
                    ),
                  ),
          );
        }
      }}
    >
      <header className="cs-preview-dialog-header">
        <div>
          <span className="cs-eyebrow">{t("Brochure preview")}</span>
          <strong>{campaign.name}</strong>
        </div>
        <div className="cs-actions">
          <button
            type="button"
            className="cs-button secondary"
            onClick={() => {
              onClose();
              onExport(current + 1);
            }}
          >
            ↓ {t("Download brochure")}
          </button>
          <button
            type="button"
            className="cs-button secondary"
            onClick={onClose}
          >
            <span aria-hidden="true">✎</span> {t("Back to editing")}
          </button>
        </div>
      </header>
      <div className="cs-preview-dialog-body">
        <nav
          className="cs-preview-thumbnails"
          aria-label={t("Brochure pages")}
          ref={strip}
        >
          {Array.from({ length: count }, (_, i) => i - 1).map((index) => (
            <button
              key={index}
              type="button"
              aria-label={title(index)}
              aria-current={current === index ? "page" : undefined}
              onClick={() => onSelect(index)}
            >
              <span
                className="cs-preview-thumbnail-art"
                inert
                aria-hidden="true"
              >
                {renderPage(index)}
              </span>
              <span>
                {String(index + 2).padStart(2, "0")} · {title(index)}
              </span>
            </button>
          ))}
        </nav>
        <div className="cs-preview-dialog-stage">
          <div className="cs-preview-dialog-paper" key={current}>
            {renderPage(current)}
          </div>
        </div>
      </div>
      <footer className="cs-preview-dialog-footer">
        <button
          type="button"
          className="cs-button secondary"
          disabled={current === -1}
          onClick={() => onSelect(current - 1)}
          aria-label={t("Previous page")}
        >
          ← {t("Previous")}
        </button>
        <div aria-live="polite">
          <strong>{title(current)}</strong>
          <span>
            {current + 2} / {count} · {t("Use ← → to browse pages")}
          </span>
        </div>
        <button
          type="button"
          className="cs-button secondary"
          disabled={current === last}
          onClick={() => onSelect(current + 1)}
          aria-label={t("Next page")}
        >
          {t("Next")} →
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}

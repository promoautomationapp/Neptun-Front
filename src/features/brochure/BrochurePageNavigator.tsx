import { useEffect, useRef } from "react";
import type { CSSProperties, DragEvent } from "react";
import type { Campaign, Product } from "../../domain/models";
import { resolveAsset } from "../../api/client";
import { coverProducts } from "./campaignPages";
import { includesStoresPage } from "./storesSelection";
import { pageBackgroundColor } from "./pageBackground";
import { t } from "./i18n";

/** Lightweight page thumbnails keep navigation fast even in long brochures. */
export function BrochurePageNavigator({
  campaign,
  pages,
  selected,
  onSelect,
  draggingCode,
  overPage,
  onOverPage,
  onDropPage,
}: {
  campaign: Campaign;
  pages: { index: number; products: Product[] }[];
  selected: number;
  onSelect: (page: number) => void;
  draggingCode: string | null;
  overPage: number | null;
  onOverPage: (page: number | null) => void;
  onDropPage: (page: number, event: DragEvent<HTMLElement>) => void;
}) {
  const strip = useRef<HTMLElement>(null);
  const hasStores = includesStoresPage(campaign);
  const count = pages.length + 1 + Number(hasStores);
  const entries = [
    { index: -1, label: t("Cover"), products: coverProducts(campaign) },
    ...pages.map((page) => ({
      ...page,
      label: `${t("Page")} ${page.index + 2}`,
    })),
    { index: pages.length, label: t("Stores & details"), products: [] },
  ];
  useEffect(() => {
    strip.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [selected]);
  return (
    <div className="cs-page-navigator">
      <div className="cs-page-navigator-heading">
        <span>
          {t("Brochure pages")} <b>{count}</b>
        </span>
        <div
          className="cs-inline-page-navigation"
          role="group"
          aria-label={t("Page navigation")}
        >
          <button
            type="button"
            disabled={selected === -1}
            onClick={() => onSelect(selected - 1)}
            aria-label={t("Previous page")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="m12 5-5 5 5 5" />
            </svg>
          </button>
          <span>
            {selected === pages.length && !hasStores ? "—" : selected + 2} /{" "}
            {count}
          </span>
          <button
            type="button"
            disabled={selected >= pages.length - Number(!hasStores)}
            onClick={() => onSelect(selected + 1)}
            aria-label={t("Next page")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="m8 5 5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
      <nav
        className="cs-pages-sidebar"
        aria-label={t("Brochure pages")}
        ref={strip}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? -1
              : event.key === "End"
                ? pages.length
                : Math.max(
                    -1,
                    Math.min(
                      pages.length,
                      selected + (event.key === "ArrowLeft" ? -1 : 1),
                    ),
                  );
          onSelect(next);
          strip.current
            ?.querySelectorAll<HTMLButtonElement>("button")
            [next + 1]?.focus();
        }}
      >
        {entries.map((entry) => {
          const excluded = entry.index === pages.length && !hasStores;
          const kind =
            entry.index === -1
              ? "cover"
              : entry.index === pages.length
                ? "stores"
                : "product";
          const background = pageBackgroundColor(
            campaign,
            kind,
            campaign.pages?.[entry.index],
          );
          return (
            <button
              key={entry.index}
              type="button"
              className={`${selected === entry.index ? "active" : ""} ${overPage === entry.index ? "cs-page-drop-target" : ""} ${excluded ? "cs-page-not-included" : ""}`}
              aria-label={`${entry.label}${excluded ? ` · ${t("Not included")}` : ""}`}
              aria-current={selected === entry.index ? "page" : undefined}
              onClick={() => onSelect(entry.index)}
              onDragOver={(event) => {
                if (draggingCode && kind !== "stores") {
                  event.preventDefault();
                  onOverPage(entry.index);
                }
              }}
              onDragLeave={() => onOverPage(null)}
              onDrop={(event) => onDropPage(entry.index, event)}
            >
              <span
                className="cs-page-miniature"
                style={
                  {
                    backgroundColor: background,
                    "--mini-columns":
                      entry.products.length === 1
                        ? 1
                        : entry.products.length > 4
                          ? 3
                          : 2,
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                {kind === "cover" && (
                  <span className="cs-page-miniature-brand">NEPTUN</span>
                )}
                {kind === "cover" && campaign.coverImage && (
                  <img
                    className="cs-page-miniature-cover"
                    src={resolveAsset(campaign.coverImage)}
                    alt=""
                    loading="lazy"
                  />
                )}
                <span className="cs-page-miniature-products">
                  {entry.products.slice(0, 8).map((product) => (
                    <span key={product.code}>
                      {product.image && (
                        <img
                          src={resolveAsset(product.image)}
                          alt=""
                          loading="lazy"
                        />
                      )}
                      <i />
                    </span>
                  ))}
                </span>
                {kind === "stores" && (
                  <span className="cs-page-miniature-stores">
                    {Array.from({ length: 12 }, (_, index) => (
                      <i key={index} />
                    ))}
                  </span>
                )}
                <span className="cs-page-miniature-number">
                  {excluded ? "—" : String(entry.index + 2).padStart(2, "0")}
                </span>
              </span>
              <strong>{entry.label}</strong>
              <small>
                {excluded
                  ? t("Not included")
                  : kind === "product"
                    ? `${entry.products.length} ${t("products")}`
                    : kind === "cover"
                      ? "01"
                      : String(entry.index + 2).padStart(2, "0")}
              </small>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

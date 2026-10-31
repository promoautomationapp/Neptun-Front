import { t } from "./i18n";
import "../../styles/brochure-pagination.css";

export type BrochureNavigationPage = {
  index: number;
  label: string;
  excluded?: boolean;
};

/** Reveal a thumbnail inside its strip without moving the document or canvas. */
export function revealPageThumbnail(strip: HTMLElement | null) {
  const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
  if (!strip || !active) return;
  const bounds = strip.getBoundingClientRect();
  const item = active.getBoundingClientRect();
  const horizontal = strip.scrollWidth > strip.clientWidth;
  const offset = horizontal
    ? item.left < bounds.left
      ? item.left - bounds.left - 6
      : item.right > bounds.right
        ? item.right - bounds.right + 6
        : 0
    : item.top < bounds.top
      ? item.top - bounds.top - 6
      : item.bottom > bounds.bottom
        ? item.bottom - bounds.bottom + 6
        : 0;
  if (offset)
    strip.scrollTo?.({
      left: strip.scrollLeft + (horizontal ? offset : 0),
      top: strip.scrollTop + (horizontal ? 0 : offset),
      behavior: "instant",
    });
}

/** Page selection is local view state; it never modifies the saved brochure. */
export function BrochurePagination({
  pages,
  selected,
  onSelect,
}: {
  pages: BrochureNavigationPage[];
  selected: number;
  onSelect: (page: number) => void;
}) {
  if (!pages.length) return null;
  const included = pages.filter((page) => !page.excluded);
  const current = pages.find((page) => page.index === selected);
  const number = included.findIndex((page) => page.index === selected) + 1;
  const previous = included.filter((page) => page.index < selected).at(-1);
  const next = included.find((page) => page.index > selected);
  return (
    <nav
      className="cs-brochure-pagination"
      aria-label={t("Page navigation")}
      data-export-hide="true"
    >
      <button
        type="button"
        disabled={!previous}
        onClick={() => previous && onSelect(previous.index)}
        aria-label={t("Previous page")}
        title={
          previous
            ? `${t("Previous page")} · ${previous.label}`
            : t("Previous page")
        }
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>
      <label className="cs-brochure-pagination-picker">
        <span
          className="cs-brochure-pagination-current"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{current?.label || t("Page")}</span>
          <strong>
            {number || "—"}
            <i>/</i>
            {included.length}
          </strong>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
        <select
          aria-label={t("Go to page")}
          value={selected}
          onChange={(event) => onSelect(Number(event.target.value))}
        >
          {pages.map((page) => (
            <option key={page.index} value={page.index}>
              {page.excluded
                ? `${page.label} · ${t("Not included")}`
                : `${included.findIndex((item) => item.index === page.index) + 1} · ${page.label}`}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && onSelect(next.index)}
        aria-label={t("Next page")}
        title={next ? `${t("Next page")} · ${next.label}` : t("Next page")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m10 6 6 6-6 6" />
        </svg>
      </button>
    </nav>
  );
}

import { useLayoutEffect, type RefObject } from "react";
import redGeometry from "./redPriceGeometry.json";

/** Reserve the visible old-price band too: it extends above the SVG view box. */
export function DefaultSavingsClearance({
  photoAreaRef,
  enabled,
}: {
  photoAreaRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  useLayoutEffect(() => {
    const card =
      photoAreaRef.current?.closest<HTMLElement>(".brochure-product");
    if (!card || !enabled) return;
    const badge = card.querySelector<HTMLElement>(
      ".brochure-red-reference-saving, .brochure-saving",
    );
    const price = card.querySelector<HTMLElement>(
      ".brochure-product-bottom > .brochure-price",
    );
    if (!badge || !price) return;
    const original = badge.style.translate;
    let offset = 0;
    let queued = false;
    let disposed = false;
    let mutations: MutationObserver | undefined;
    const observe = () =>
      mutations?.observe(card, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "style", "data-name-divider-manual"],
      });
    const update = () => {
      queued = false;
      if (disposed) return;
      mutations?.disconnect();
      try {
        // A first drag materializes this correction into the requested coordinates.
        if (badge.dataset.nameDividerManual === "true") return;
        const cardBox = card.getBoundingClientRect();
        const scale = cardBox.width / (card.offsetWidth || cardBox.width);
        if (!scale || !cardBox.width) return;
        const badgeBox = badge.getBoundingClientRect();
        const priceBox = price.getBoundingClientRect();
        const svg = price.querySelector<SVGSVGElement>(
          ".red-reference-price-svg",
        );
        const svgBox = svg?.getBoundingClientRect();
        const priceTop = svgBox?.width
          ? svgBox.top +
            (Math.min(0, redGeometry.parts.oldBand.y) * svgBox.width) /
              redGeometry.parts.saleBand.width
          : priceBox.top;
        const pageWidth =
          card.closest(".brochure-page")?.getBoundingClientRect().width ||
          cardBox.width;
        const gap = (6 * pageWidth) / 1080;
        const requestedBottom = badgeBox.bottom - offset * scale;
        const horizontalOverlap =
          badgeBox.right > priceBox.left && badgeBox.left < priceBox.right;
        const next = horizontalOverlap
          ? Math.min(0, (priceTop - gap - requestedBottom) / scale)
          : 0;
        offset = next;
        const translate = next ? `0 ${next}px` : original;
        if (badge.style.translate !== translate)
          badge.style.translate = translate;
      } finally {
        observe();
      }
    };
    const schedule = () => {
      if (!queued && !disposed) {
        queued = true;
        queueMicrotask(update);
      }
    };
    const resize =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(schedule)
        : undefined;
    resize?.observe(card);
    resize?.observe(badge);
    resize?.observe(price);
    if (typeof MutationObserver === "function")
      mutations = new MutationObserver(schedule);
    void document.fonts?.ready.then(schedule);
    update();
    return () => {
      disposed = true;
      resize?.disconnect();
      mutations?.disconnect();
      badge.style.translate = original;
    };
  }, [photoAreaRef, enabled]);
  return null;
}

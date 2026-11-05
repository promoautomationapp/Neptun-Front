import { useLayoutEffect, type RefObject } from "react";
import redGeometry from "./redPriceGeometry.json";
import { fitSavingsBesidePhotos } from "./applePhotoGeometry";
import { productArtworkPhotoBox } from "./ProductArtworkLayer";
import { requestedLayoutChanged } from "./layoutObservation";
import "../../styles/default-savings-clearance.css";

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
    const price = card.querySelector<HTMLElement>(".brochure-price");
    if (!badge || !price) return;
    const original = badge.style.translate;
    let offset = { x: 0, y: 0 };
    let queued = false;
    let disposed = false;
    let mutations: MutationObserver | undefined;
    const observe = () =>
      mutations?.observe(card, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["class", "style", "src", "data-name-divider-manual"],
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
        const photoBox = photoAreaRef.current?.getBoundingClientRect();
        if (!photoBox) return;
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
        const requestedBottom = badgeBox.bottom - offset.y * scale;
        const horizontalOverlap =
          badgeBox.right > priceBox.left && badgeBox.left < priceBox.right;
        const clearance = horizontalOverlap
          ? Math.min(0, (priceTop - gap - requestedBottom) / scale)
          : 0;
        const originalTop = badgeBox.top - offset.y * scale;
        const next = Math.max(
          clearance,
          (photoBox.top + gap - originalTop) / scale,
        );
        const requested = {
          x: (badgeBox.left - cardBox.left) / scale - offset.x,
          y: (originalTop - cardBox.top) / scale,
          width: badgeBox.width / scale,
          height: badgeBox.height / scale,
        };
        const photos = [
          ...card.querySelectorAll<HTMLImageElement>(
            ".brochure-product-image,.product-artwork-item > img:not(.bundle-screen-artwork)",
          ),
        ].flatMap((image) => {
          const box = productArtworkPhotoBox(image, card);
          return box
            ? [
                {
                  x: (box.x * cardBox.width) / scale / 100,
                  y: (box.y * cardBox.height) / scale / 100,
                  width: (box.width * cardBox.width) / scale / 100,
                  height: (box.height * cardBox.height) / scale / 100,
                },
              ]
            : [];
        });
        // Large bundles reserve a separate right-hand sidebar for the badge.
        // Keep that space available rather than pulling it back over the photos.
        const badgeBounds = photoAreaRef.current?.contains(badge)
          ? photoBox
          : cardBox;
        const fit = photos.length
          ? fitSavingsBesidePhotos(
              requested,
              {
                x: (badgeBounds.left - cardBox.left) / scale,
                y: (badgeBounds.top - cardBox.top) / scale,
                width: badgeBounds.width / scale,
                height:
                  Math.max(
                    0,
                    Math.min(badgeBounds.bottom, priceTop - gap) -
                      badgeBounds.top,
                  ) / scale,
              },
              [],
              photos,
              gap / scale,
            )
          : null;
        offset =
          fit && fit.scale >= 0.999999
            ? { x: fit.rect.x - requested.x, y: fit.rect.y - requested.y }
            : { x: 0, y: next };
        const translate =
          offset.x || offset.y ? `${offset.x}px ${offset.y}px` : original;
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
      mutations = new MutationObserver((records) => {
        if (requestedLayoutChanged(records)) schedule();
      });
    card.addEventListener("load", schedule, true);
    void document.fonts?.ready.then(schedule);
    update();
    return () => {
      disposed = true;
      resize?.disconnect();
      mutations?.disconnect();
      card.removeEventListener("load", schedule, true);
      badge.style.translate = original;
    };
  }, [photoAreaRef, enabled]);
  return null;
}

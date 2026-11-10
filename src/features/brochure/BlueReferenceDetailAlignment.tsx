import { useLayoutEffect, type RefObject } from "react";

/** The supplied blue price fixes the reference baseline. Align only automatic
 * detail rows to its savings center; never move or restyle the savings badge. */
export function BlueReferenceDetailAlignment({
  photoAreaRef,
  enabled,
}: {
  photoAreaRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  useLayoutEffect(() => {
    const card =
      photoAreaRef.current?.closest<HTMLElement>(".brochure-product");
    const specs = card?.querySelector<HTMLElement>(
      '.brochure-specs[data-detail-layout="strip"]',
    );
    const badge = card?.querySelector<HTMLElement>(".reference-saving-tab");
    if (!enabled || !card || !specs || !badge) return;
    const original = specs.style.translate;
    const copy = card.querySelector<HTMLElement>(".brochure-product-copy");
    const originalCopy = copy?.style.translate || "";
    const colors = card.querySelector<HTMLElement>(
      ":scope > .brochure-colors.blue-reference-colors",
    );
    const originalColors = colors?.style.translate || "";
    const photoHeight = card.style.getPropertyValue(
      "--blue-reference-photo-height",
    );
    const photoCenter = card.style.getPropertyValue(
      "--blue-reference-photo-center",
    );
    let offset = 0;
    let copyOffset = 0;
    let frame = 0;
    let disposed = false;
    const observe = () =>
      mutations?.observe(card, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    const update = () => {
      frame = 0;
      if (disposed) return;
      mutations?.disconnect();
      try {
        const cardBox = card.getBoundingClientRect();
        const row = specs.getBoundingClientRect();
        const saving = badge.getBoundingClientRect();
        if (!cardBox.width || !row.width || !row.height || !saving.height)
          return;
        const scale = cardBox.width / (card.offsetWidth || cardBox.width);
        const sourceCenter = row.top + row.height / 2 - offset * scale;
        const next =
          Math.round(
            ((saving.top + saving.height / 2 - sourceCenter) / scale) * 100,
          ) / 100;
        if (Math.abs(next - offset) >= 0.01) {
          offset = next;
          specs.style.translate = offset ? `0 ${offset}px` : original;
        }
        if (colors)
          colors.style.translate = next ? `0 ${next}px` : originalColors;
        if (
          copy &&
          card.dataset.defaultBottomRow === "true" &&
          copy.dataset.copyFrameManual !== "true"
        ) {
          // The anchored row already gives every automatic card one shared
          // baseline. A previous clearance translation must not push only a
          // short name/warranty block below its neighboring phone's copy.
          copyOffset = 0;
          copy.style.translate = "";
        } else if (copy && copy.dataset.copyFrameManual !== "true") {
          const copyBox = copy.getBoundingClientRect();
          if (copyBox.width && copyBox.height) {
            const sourceTop = copyBox.top - copyOffset * scale;
            const pageWidth =
              card.closest(".brochure-page")?.getBoundingClientRect().width ||
              cardBox.width;
            const rowBottom = sourceCenter + next * scale + row.height / 2;
            const gap = (pageWidth * 6) / 1080;
            const copyTop = Math.max(sourceTop, rowBottom + gap);
            copyOffset =
              Math.round(((copyTop - sourceTop) / scale) * 100) / 100;
            copy.style.translate = copyOffset
              ? `0 ${copyOffset}px`
              : originalCopy;
          }
        } else if (copy) {
          copyOffset = 0;
          copy.style.translate = originalCopy;
        }
        const photo = photoAreaRef.current?.getBoundingClientRect();
        if (photo && card.dataset.defaultPhoto === "true") {
          const gap =
            (4 *
              (card.closest(".brochure-page")?.getBoundingClientRect().width ||
                cardBox.width)) /
            1080;
          const rowTop = sourceCenter + next * scale - row.height / 2;
          const available = Math.max(
            1,
            Math.min(photo.height, rowTop - photo.top - gap) / scale,
          );
          card.style.setProperty(
            "--blue-reference-photo-height",
            `${available}px`,
          );
          card.style.setProperty(
            "--blue-reference-photo-center",
            `${available / 2}px`,
          );
        }
      } finally {
        observe();
      }
    };
    const queue = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(update);
    };
    const resize =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(queue)
        : undefined;
    resize?.observe(card);
    resize?.observe(specs);
    resize?.observe(badge);
    const mutations =
      typeof MutationObserver === "function"
        ? new MutationObserver(queue)
        : undefined;
    update();
    void document.fonts?.ready.then(queue);
    window.addEventListener("resize", queue);
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      mutations?.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", queue);
      specs.style.translate = original;
      if (copy) copy.style.translate = originalCopy;
      if (colors) colors.style.translate = originalColors;
      if (photoHeight)
        card.style.setProperty("--blue-reference-photo-height", photoHeight);
      else card.style.removeProperty("--blue-reference-photo-height");
      if (photoCenter)
        card.style.setProperty("--blue-reference-photo-center", photoCenter);
      else card.style.removeProperty("--blue-reference-photo-center");
    };
  }, [enabled, photoAreaRef]);
  return null;
}

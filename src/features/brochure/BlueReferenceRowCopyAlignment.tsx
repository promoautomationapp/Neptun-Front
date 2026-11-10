import { useLayoutEffect, useRef, type RefObject } from "react";

const offsetName = "--blue-copy-row-offset";
const scaleName = "--blue-copy-row-scale";
const colorsName = "--blue-phone-colors-offset";

/** One pass owns shared row clearance. Price and savings geometry are read-only;
 * automatic copy peers move together and stay inside the next row/footer gap. */
export function BlueReferenceRowCopyAlignment({
  pageRef,
}: {
  pageRef: RefObject<HTMLElement | null>;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    // React can run a child's layout effect before attaching its parent ref.
    const page =
      pageRef.current || marker.current?.closest<HTMLElement>(".brochure-page");
    if (!page) return;
    let frame = 0;
    let disposed = false;
    const originals = new Map<HTMLElement, string[]>();
    const observed = new Set<Element>();
    const resize =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(queue)
        : undefined;
    const watch = (element: Element) => {
      if (!observed.has(element)) {
        resize?.observe(element);
        observed.add(element);
      }
    };
    const restore = (card: HTMLElement, values: string[]) =>
      [offsetName, scaleName, colorsName].forEach((key, index) => {
        if (values[index]) card.style.setProperty(key, values[index]!);
        else card.style.removeProperty(key);
      });
    const observe = () =>
      mutations?.observe(page, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["style", "class", "data-default-bottom-row"],
      });
    const update = () => {
      frame = 0;
      if (disposed) return;
      mutations?.disconnect();
      try {
        const pageBox = page.getBoundingClientRect();
        if (!pageBox.width || !pageBox.height) return;
        const allCards = [
          ...page.querySelectorAll<HTMLElement>(".brochure-product"),
        ].filter((card) => card.closest(".brochure-page") === page);
        const eligible = allCards.filter((card) =>
          card.matches('.blue-reference-offer[data-default-bottom-row="true"]'),
        );
        const current = new Set(eligible);
        for (const [card, values] of originals)
          if (!current.has(card)) {
            restore(card, values);
            originals.delete(card);
          }
        for (const element of observed)
          if (element !== page && !page.contains(element)) {
            resize?.unobserve(element);
            observed.delete(element);
          }
        const rows: Array<
          Array<{
            card: HTMLElement;
            copy: HTMLElement;
            top: number;
            naturalHeight: number;
            sourceTop: number;
            sourceBottom: number;
            anchorFromBottom: number;
            scale: number;
            requiredTop: number;
          }>
        > = [];
        for (const card of eligible) {
          const copy = card.querySelector<HTMLElement>(
            '.brochure-product-copy:not([data-copy-frame-manual="true"])',
          );
          const box = card.getBoundingClientRect();
          if (!copy || !box.width) continue;
          const copyBox = copy.getBoundingClientRect();
          if (!copyBox.height) continue;
          if (!originals.has(card))
            originals.set(
              card,
              [offsetName, scaleName, colorsName].map((key) =>
                card.style.getPropertyValue(key),
              ),
            );
          const scale = box.width / (card.offsetWidth || box.width);
          const previousOffset =
            (Number.parseFloat(card.style.getPropertyValue(offsetName)) || 0) *
            scale;
          const previousScale =
            Number.parseFloat(card.style.getPropertyValue(scaleName)) || 1;
          const sourceBottom = copyBox.bottom - previousOffset;
          const naturalHeight = copyBox.height / previousScale;
          const sourceTop = sourceBottom - naturalHeight;
          const anchor = copy.querySelector<HTMLElement>(
            ".brochure-brand-mark img,.brochure-brand-mark strong,[data-product-name]",
          );
          const anchorFromBottom =
            (copyBox.bottom -
              (anchor?.getBoundingClientRect().top ?? copyBox.top)) /
            previousScale;
          const specs = card.querySelector<HTMLElement>(
            '.brochure-specs[data-detail-layout="strip"]',
          );
          const requiredTop =
            specs?.getBoundingClientRect().bottom || sourceTop;
          const record = {
            card,
            copy,
            top: box.top,
            naturalHeight,
            sourceTop,
            sourceBottom,
            anchorFromBottom,
            scale,
            requiredTop,
          };
          let row = rows.find((items) => Math.abs(items[0]!.top - box.top) < 2);
          if (!row) {
            row = [];
            rows.push(row);
          }
          row.push(record);
          watch(card);
          watch(copy);
          if (specs) watch(specs);
        }
        const footerTops = [
          ...page.querySelectorAll<HTMLElement>(
            ".brochure-footer-element,.cover-element-footer,.brochure-interior-brand-footer,.october-footer-logo,.compact-stores-footer",
          ),
        ].flatMap((footer) => {
          const box = footer.getBoundingClientRect();
          return box.width && box.height ? [box.top] : [];
        });
        const set = (card: HTMLElement, key: string, value: string) => {
          if (card.style.getPropertyValue(key) !== value)
            card.style.setProperty(key, value);
        };
        const gap = (pageBox.width * 6) / 1080;
        for (const row of rows) {
          const top = row[0]!.top;
          const nextCard = allCards
            .map((card) => card.getBoundingClientRect().top)
            .filter((next) => next > top + 2);
          const boundary = Math.min(
            pageBox.bottom,
            ...nextCard,
            ...footerTops.filter((next) => next > top + 2),
          );
          const bottom = Math.max(...row.map((item) => item.sourceBottom));
          const available = Math.max(0, boundary - bottom - gap);
          const required = Math.max(
            0,
            ...row.map((item) => item.requiredTop + gap - item.sourceTop),
          );
          // If a row's gutter is tight, fit automatic copy uniformly before
          // allowing it to cross a following product or the footer.
          const copyScale =
            required <= available
              ? 1
              : Math.max(
                  0.5,
                  Math.min(
                    1,
                    ...row.map(
                      (item) =>
                        (item.sourceBottom +
                          available -
                          item.requiredTop -
                          gap) /
                        item.naturalHeight,
                    ),
                  ),
                );
          const shared = Math.min(
            available,
            Math.max(
              0,
              ...row.map(
                (item) =>
                  item.requiredTop +
                  gap -
                  (item.sourceBottom - item.naturalHeight * copyScale),
              ),
            ),
          );
          for (const item of row) {
            set(
              item.card,
              offsetName,
              `${Math.round((shared / item.scale) * 100) / 100}px`,
            );
            set(
              item.card,
              scaleName,
              String(Math.round(copyScale * 10000) / 10000),
            );
            if (item.card.matches(".details-left,.details-right")) {
              const colors = item.card.querySelector<HTMLElement>(
                ":scope > .brochure-colors.blue-reference-colors",
              );
              if (colors) {
                const box = colors.getBoundingClientRect();
                const previous =
                  (Number.parseFloat(
                    item.card.style.getPropertyValue(colorsName),
                  ) || 0) * item.scale;
                const colorBottom = box.bottom - previous;
                const copyTop =
                  item.sourceBottom -
                  item.anchorFromBottom * copyScale +
                  shared;
                set(
                  item.card,
                  colorsName,
                  `${Math.round(((copyTop - gap - colorBottom) / item.scale) * 100) / 100}px`,
                );
                watch(colors);
              }
            }
          }
        }
      } finally {
        observe();
      }
    };
    function queue() {
      if (!disposed && !frame) frame = requestAnimationFrame(update);
    }
    const mutations =
      typeof MutationObserver === "function"
        ? new MutationObserver(queue)
        : undefined;
    watch(page);
    update();
    void document.fonts?.ready.then(queue);
    window.addEventListener("resize", queue);
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      mutations?.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", queue);
      for (const [card, values] of originals) restore(card, values);
    };
  }, [pageRef]);
  return (
    <span ref={marker} hidden data-export-hide="true" aria-hidden="true" />
  );
}

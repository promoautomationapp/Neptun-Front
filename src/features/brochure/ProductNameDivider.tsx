import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import "../../styles/product-name-divider.css";
import type { ProductDesignDefaults } from "../settings/settings.schema";

interface DividerPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Bake the automatic name alignment into the first manual gesture so its
// displayed position is also the saved/reloaded position, without a jump.
export function materializeProductNameAlignment(
  copy: HTMLElement,
  pageWidth: number,
  visualScale: number,
) {
  const [x = "0", y = "0"] = copy.style.translate.trim().split(/\s+/);
  copy.dataset.nameDividerManual = "true";
  copy.style.translate = "";
  return {
    x: (((Number.parseFloat(x) || 0) * visualScale) / pageWidth) * 100,
    y: (((Number.parseFloat(y) || 0) * visualScale) / pageWidth) * 100,
  };
}

// Draw the sale/installment boundary from the start of the name, underneath
// its final line. Measured coordinates retain the selected format and moves.
export function ProductNameDivider({
  rowRef,
  alignName = true,
  defaults,
}: {
  rowRef: RefObject<HTMLElement | null>;
  alignName?: boolean;
  defaults?: ProductDesignDefaults["divider"];
}) {
  const [placement, setPlacement] = useState<DividerPlacement | null>(null);
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (defaults?.visible === false) return;
    const row =
      rowRef.current ??
      marker.current?.closest<HTMLElement>(".brochure-product-bottom");
    const copy = row?.querySelector<HTMLElement>(".brochure-product-copy");
    const name = copy?.querySelector<HTMLElement>("[data-product-name]");
    if (!row || !copy || !name) return;
    const originalTranslate = copy.style.translate;
    if (!alignName) delete copy.dataset.nameDividerManual;
    let disposed = false;
    let queued = false;
    let nameCorrection = 0;
    let mutations: MutationObserver | undefined;
    const observe = () =>
      mutations?.observe(row, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["style", "class", "data-name-divider-manual"],
      });
    const update = () => {
      queued = false;
      if (disposed) return;
      mutations?.disconnect();
      try {
        const native = row.querySelector<SVGGraphicsElement>(
          "[data-offer-price-divider]",
        );
        const sale = row.querySelector<HTMLElement>(
          ".brochure-price:not(.reference-price-card) > .brochure-price-sale",
        );
        const month = row.querySelector<HTMLElement>(
          ".brochure-price:not(.reference-price-card) > .brochure-price-month",
        );
        if (!native && !(sale && month)) {
          if (copy.style.translate !== originalTranslate)
            copy.style.translate = originalTranslate;
          nameCorrection = 0;
          setPlacement(null);
          return;
        }
        const rowBox = row.getBoundingClientRect();
        if (!rowBox.width || !rowBox.height) return;
        const scale = rowBox.width / (row.offsetWidth || rowBox.width);
        const pageWidth =
          row.closest(".brochure-page, .social-canvas")?.getBoundingClientRect().width ??
          rowBox.width;
        const gap = ((defaults?.gap ?? 2) * pageWidth) / 1080;
        const boundary = native?.getBoundingClientRect();
        const saleBox = sale?.getBoundingClientRect();
        const monthBox = month?.getBoundingClientRect();
        if ((boundary && !boundary.width) || (!boundary && !saleBox?.width))
          return;
        const boundaryY = boundary
          ? boundary.top + boundary.height / 2
          : saleBox && monthBox
            ? (saleBox.bottom + monthBox.top) / 2
            : 0;
        const boundaryRight = boundary?.right ?? saleBox?.right ?? rowBox.right;
        const textRects = (element: Element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const lines =
            typeof range.getClientRects === "function"
              ? [...range.getClientRects()].filter(
                  (line) => line.width > 0 && line.height > 0,
                )
              : [];
          return lines.length ? lines : [element.getBoundingClientRect()];
        };
        const before = textRects(name)[0]!;
        if (alignName && copy.dataset.nameDividerManual !== "true") {
          const style = getComputedStyle(name);
          const canvas = document.createElement("canvas").getContext("2d");
          let descent = 0;
          if (canvas) {
            canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            const metrics = canvas.measureText("Hg");
            descent = Math.max(
              0,
              metrics.fontBoundingBoxDescent ??
                metrics.actualBoundingBoxDescent ??
                0,
            );
          }
          const baseline = before.bottom - descent * scale;
          const correction =
            Math.round(
              ((boundaryY - baseline) / scale + nameCorrection) * 10000,
            ) / 10000;
          const translate = `0 ${correction}px`;
          if (copy.style.translate !== translate)
            copy.style.translate = translate;
          nameCorrection = correction;
        }
        const height =
          defaults?.thickness != null
            ? (defaults.thickness * pageWidth) / 1080
            : boundary?.height || pageWidth / 1080;
        const lines = textRects(name);
        const distance = (rect: DOMRect) =>
          Math.max(rect.top - boundaryY, boundaryY - rect.bottom, 0);
        const closest = Math.min(...lines.map(distance));
        const beside = lines.filter((line) => distance(line) <= closest + 0.1);
        const protectedRects = [
          ...copy.querySelectorAll(
            "[data-product-name], .brochure-product-code, .brochure-warranty-line, .brochure-brand-mark",
          ),
        ]
          .flatMap(textRects)
          .filter(
            (rect) =>
              rect.top - gap <= boundaryY + height / 2 &&
              rect.bottom + gap >= boundaryY - height / 2,
          );
        const left = Math.max(
          rowBox.left,
          ...[...beside, ...protectedRects].map((rect) => rect.right + gap),
        );
        const right = Math.min(rowBox.right, boundaryRight);
        const next = {
          left: (left - rowBox.left) / scale,
          top: (boundaryY - height / 2 - rowBox.top) / scale,
          width: Math.max(0, right - left) / scale,
          height: height / scale,
        };
        setPlacement((current) =>
          JSON.stringify(current) === JSON.stringify(next) ? current : next,
        );
      } finally {
        observe();
      }
    };
    const queueUpdate = () => {
      if (!queued && !disposed) {
        queued = true;
        queueMicrotask(update);
      }
    };
    const resize =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(queueUpdate)
        : undefined;
    resize?.observe(row);
    resize?.observe(copy);
    const price = row.querySelector(".brochure-price");
    if (price) resize?.observe(price);
    if (typeof MutationObserver === "function")
      mutations = new MutationObserver(queueUpdate);
    row
      .closest(".brochure-product")
      ?.addEventListener("brochure-photo-clearance", queueUpdate);
    void document.fonts?.ready.then(queueUpdate);
    update();
    return () => {
      disposed = true;
      resize?.disconnect();
      mutations?.disconnect();
      row
        .closest(".brochure-product")
        ?.removeEventListener("brochure-photo-clearance", queueUpdate);
      copy.style.translate = originalTranslate;
    };
  }, [
    rowRef,
    alignName,
    defaults?.visible,
    defaults?.thickness,
    defaults?.gap,
  ]);
  return (
    <span
      ref={marker}
      className="brochure-product-name-divider"
      data-active={
        defaults?.visible !== false && placement && placement.width > 0
          ? "true"
          : undefined
      }
      style={
        defaults?.visible !== false && placement && placement.width > 0
          ? {
              left: placement.left,
              top: placement.top,
              width: placement.width,
              height: placement.height,
            }
          : { display: "none" }
      }
      aria-hidden="true"
    />
  );
}

import { useLayoutEffect, type RefObject } from "react";
import redGeometry from "./redPriceGeometry.json";
import {
  fitArtworkInside,
  fitPhotoAroundArtwork,
  projectNativeArtworkRect,
  unionArtworkRects,
  type ArtworkRect,
  type PhotoFit,
} from "./applePhotoGeometry";
import "../../styles/apple-photo-clearance.css";

export const APPLE_PHOTO_CLEARANCE_EVENT = "brochure-photo-clearance";
export { hasApplePhotos } from "./productTypes";
const CANONICAL_GAP = 3;
const CANONICAL_PAGE_WIDTH = 1080;

interface OriginalCorrection {
  translate: string;
  scale: string;
}
interface PhotoTarget {
  element: HTMLElement;
  image: HTMLImageElement;
  requested: ArtworkRect;
}

function objectPosition(value: string | undefined, space: number) {
  if (value === "left" || value === "top") return 0;
  if (value === "right" || value === "bottom") return space;
  if (value?.endsWith("px")) return Number.parseFloat(value);
  return value?.endsWith("%")
    ? (space * Number.parseFloat(value)) / 100
    : space / 2;
}

// A resized cover can have a positive photo area smaller than two canonical gaps.
// Keep that clipped primary area usable; additional photos can use the whole card.
function positiveInset(rect: ArtworkRect, gap: number): ArtworkRect {
  const x = Math.min(gap, Math.max(0, rect.width / 4));
  const y = Math.min(gap, Math.max(0, rect.height / 4));
  return {
    x: rect.x + x,
    y: rect.y + y,
    width: rect.width - x * 2,
    height: rect.height - y * 2,
  };
}

function shadowLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "(") depth++;
    else if (value[index] === ")") depth--;
    else if (value[index] === "," && depth === 0) {
      layers.push(value.slice(start, index));
      start = index + 1;
    }
  }
  layers.push(value.slice(start));
  return layers;
}

/** Correct only the displayed transforms; requested drag/resize settings remain on their original elements. */
export function ApplePhotoClearance({
  photoAreaRef,
}: {
  photoAreaRef: RefObject<HTMLElement | null>;
}) {
  useLayoutEffect(() => {
    const area = photoAreaRef.current;
    const card = area?.closest<HTMLElement>(".brochure-product");
    if (!area || !card) return;
    const originals = new Map<HTMLElement, OriginalCorrection>();
    let disposed = false;
    let updating = false;
    let queued = false;
    let mutations: MutationObserver | null = null;
    let resize: ResizeObserver | null = null;

    const remember = (element: HTMLElement) => {
      if (!originals.has(element))
        originals.set(element, {
          translate: element.style.translate,
          scale: element.style.scale,
        });
    };
    const restore = (element: HTMLElement) => {
      const original = originals.get(element);
      if (original) {
        element.style.translate = original.translate;
        element.style.scale = original.scale;
      }
    };
    const observeMutations = () =>
      mutations?.observe(card, {
        attributes: true,
        attributeFilter: [
          "style",
          "class",
          "src",
          "data-apple-photo-clearance",
        ],
        childList: true,
        characterData: true,
        subtree: true,
      });

    const update = () => {
      queued = false;
      if (disposed || updating) return;
      updating = true;
      // Disconnect while applying our own corrections, so those writes cannot recursively shrink the artwork.
      mutations?.disconnect();
      try {
        for (const element of originals.keys()) restore(element);
        const cardBox = card.getBoundingClientRect();
        const visualScale = cardBox.width / (card.offsetWidth || cardBox.width);
        if (!cardBox.width || !cardBox.height || !visualScale) return;
        const viewportRect = (rect: DOMRect): ArtworkRect => {
          return {
            x: (rect.left - cardBox.left) / visualScale,
            y: (rect.top - cardBox.top) / visualScale,
            width: rect.width / visualScale,
            height: rect.height / visualScale,
          };
        };
        const box = (element: Element): ArtworkRect =>
          viewportRect(element.getBoundingClientRect());
        const photoRect = (image: HTMLImageElement): ArtworkRect => {
          const rect = box(image);
          if (!image.naturalWidth || !image.naturalHeight) return rect;
          const style = getComputedStyle(image);
          if (!["", "contain", "scale-down"].includes(style.objectFit))
            return rect;
          let scale = Math.min(
            rect.width / image.naturalWidth,
            rect.height / image.naturalHeight,
          );
          if (style.objectFit === "scale-down")
            scale = Math.min(
              scale,
              rect.width / (image.clientWidth || rect.width),
            );
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          const position = (style.objectPosition || "50% 50%")
            .trim()
            .split(/\s+/);
          const drawn = {
            x: rect.x + objectPosition(position[0], rect.width - width),
            y: rect.y + objectPosition(position[1], rect.height - height),
            width,
            height,
          };
          const shadow = style.filter.includes("drop-shadow")
            ? [...style.filter.matchAll(/(-?\d*\.?\d+)px/g)].map((match) =>
                Number(match[1]),
              )
            : [];
          if (shadow.length < 2) return drawn;
          const factor = rect.width / (image.clientWidth || rect.width);
          const dx = (shadow[0] || 0) * factor,
            dy = (shadow[1] || 0) * factor;
          const deviation = (shadow[2] || 0) * factor * 3;
          const left = Math.max(0, deviation - dx),
            top = Math.max(0, deviation - dy);
          return {
            x: drawn.x - left,
            y: drawn.y - top,
            width: drawn.width + left + Math.max(0, deviation + dx),
            height: drawn.height + top + Math.max(0, deviation + dy),
          };
        };
        const targets: PhotoTarget[] = [];
        for (const element of card.querySelectorAll<HTMLElement>(
          '[data-apple-photo-clearance="true"]',
        )) {
          const image = element.querySelector<HTMLImageElement>(
            "img:not(.bundle-screen-artwork):not(.brochure-screen-image)",
          );
          if (!image) continue;
          const requested = photoRect(image);
          if (!requested.width || !requested.height) continue;
          remember(element);
          resize?.observe(element);
          resize?.observe(image);
          targets.push({ element, image, requested });
        }
        if (!targets.length) {
          delete card.dataset.appleClearanceLimited;
          return;
        }
        const page = card.closest(".brochure-page");
        const gap =
          CANONICAL_GAP *
          ((page?.getBoundingClientRect().width ||
            CANONICAL_PAGE_WIDTH * visualScale) /
            visualScale /
            CANONICAL_PAGE_WIDTH);
        const pageWidth =
          (page?.getBoundingClientRect().width ||
            CANONICAL_PAGE_WIDTH * visualScale) / visualScale;
        const cardBounds = positiveInset(
          {
            x: 0,
            y: 0,
            width: cardBox.width / visualScale,
            height: cardBox.height / visualScale,
          },
          gap,
        );
        const areaBounds = box(area);
        const photoBounds = positiveInset(areaBounds, gap);
        const smallPhotoArea =
          areaBounds.width <= gap * 2 || areaBounds.height <= gap * 2;
        const targetBounds = (target: PhotoTarget) =>
          smallPhotoArea && !area.contains(target.element)
            ? cardBounds
            : photoBounds;
        const prices = [
          ...card.querySelectorAll<HTMLElement>(".brochure-price"),
        ];
        const separateSavings = [
          ...card.querySelectorAll<HTMLElement>(
            ".brochure-saving,.brochure-red-reference-saving",
          ),
        ].filter((element) => !element.closest(".brochure-price"));
        const cssLength = (value: string, element: HTMLElement) => {
          const amount = Number.parseFloat(value);
          if (!Number.isFinite(amount)) return 0;
          if (value.endsWith("cqw")) return (amount * pageWidth) / 100;
          if (value.endsWith("rem"))
            return (
              amount *
              (Number.parseFloat(
                getComputedStyle(document.documentElement).fontSize,
              ) || 16)
            );
          if (value.endsWith("em"))
            return (
              amount *
              (Number.parseFloat(getComputedStyle(element).fontSize) || 16)
            );
          return amount;
        };
        const shadowRects = (
          element: HTMLElement,
          rect: ArtworkRect,
        ): ArtworkRect[] => {
          const value = getComputedStyle(element).boxShadow;
          if (!value || value === "none" || !rect.width || !rect.height)
            return [];
          const factor =
            rect.width /
            (element.offsetWidth || element.clientWidth || rect.width);
          return shadowLayers(value).flatMap((layer) => {
            if (/\binset\b/i.test(layer)) return [];
            const lengths = layer
              .replace(/(?:rgba?|hsla?|color)\([^)]*\)|#[\da-f]+/gi, "")
              .trim()
              .split(/\s+/)
              .filter((part) => /^-?(?:\d*\.)?\d+(?:px|cqw|r?em)?$/.test(part))
              .map((part) => cssLength(part, element) * factor);
            if (lengths.length < 2) return [];
            const dx = lengths[0] || 0,
              dy = lengths[1] || 0;
            // CSS box-shadow blur radius is twice its Gaussian standard deviation.
            const extent = Math.max(
              0,
              (lengths[2] || 0) * 1.5 + (lengths[3] || 0),
            );
            return [
              {
                x: rect.x + dx - extent,
                y: rect.y + dy - extent,
                width: rect.width + extent * 2,
                height: rect.height + extent * 2,
              },
            ];
          });
        };
        const visibleArtwork = (element: Element) => {
          if (
            element.closest(
              '[data-export-hide="true"],.cs-region-handles,.cs-region-handle,.cs-region-dimensions',
            )
          )
            return false;
          for (
            let parent: Element | null = element;
            parent && card.contains(parent);
            parent = parent.parentElement
          ) {
            const style = getComputedStyle(parent);
            if (style.display === "none" || style.visibility === "hidden")
              return false;
          }
          return true;
        };
        const nativePartRects = (element: Element): ArtworkRect[] => {
          const rect = box(element);
          const overflowRects: ArtworkRect[] = [];
          const shadow = element.querySelector("filter [stdDeviation][dx][dy]");
          const nativeWidth = Number.parseFloat(
            element.getAttribute("viewBox")?.trim().split(/\s+/)[2] || "0",
          );
          if (
            element.classList.contains("red-reference-price-svg") &&
            [...element.querySelectorAll("path")].some(
              (path) =>
                path.getAttribute("d") === redGeometry.parts.oldBand.path,
            )
          ) {
            const overflow = projectNativeArtworkRect(
              redGeometry.parts.oldBand,
              rect,
              nativeWidth,
            );
            if (overflow) overflowRects.push(overflow);
          }
          if (!shadow || !nativeWidth) return [rect, ...overflowRects];
          const factor = rect.width / nativeWidth;
          const deviation =
            Number.parseFloat(shadow.getAttribute("stdDeviation") || "0") *
            3 *
            factor;
          const dx =
            Number.parseFloat(shadow.getAttribute("dx") || "0") * factor;
          const dy =
            Number.parseFloat(shadow.getAttribute("dy") || "0") * factor;
          const left = Math.max(0, deviation - dx),
            top = Math.max(0, deviation - dy);
          return [
            {
              x: rect.x - left,
              y: rect.y - top,
              width: rect.width + left + Math.max(0, deviation + dx),
              height: rect.height + top + Math.max(0, deviation + dy),
            },
            ...overflowRects,
          ];
        };
        const paintedRects = (element: HTMLElement): ArtworkRect[] => {
          const nativeBody = element.querySelector<SVGSVGElement>(
            ":scope > .reference-price-svg,:scope > .red-reference-price-svg",
          );
          const rects = nativeBody ? nativePartRects(nativeBody) : [];
          for (const part of [
            element,
            ...element.querySelectorAll<HTMLElement>("*"),
          ]) {
            if (!(part instanceof HTMLElement) || !visibleArtwork(part))
              continue;
            const rect = box(part);
            // The native SVG owns its paint bounds, but its HTML wrapper can still have a shadow.
            if (part !== element || !nativeBody) rects.push(rect);
            rects.push(...shadowRects(part, rect));
          }
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
          );
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const parent = node.parentElement;
            if (
              !node.textContent?.trim() ||
              !parent ||
              parent.closest("svg") ||
              !visibleArtwork(parent)
            )
              continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            if (typeof range.getClientRects === "function")
              rects.push(...Array.from(range.getClientRects(), viewportRect));
            else if (typeof range.getBoundingClientRect === "function")
              rects.push(viewportRect(range.getBoundingClientRect()));
          }
          return rects;
        };
        const groupRect = (price: HTMLElement) =>
          unionArtworkRects(paintedRects(price));
        const applyFit = (
          element: HTMLElement,
          fit: PhotoFit,
          read: () => ArtworkRect | null,
        ) => {
          remember(element);
          const original = originals.get(element);
          element.style.scale =
            fit.scale < 0.999999 ? String(fit.scale) : original?.scale || "";
          const scaled = read();
          if (!scaled) return;
          element.style.translate = `${fit.rect.x - scaled.x}px ${fit.rect.y - scaled.y}px`;
        };
        for (const price of prices) {
          const requested = groupRect(price);
          const fit = requested && fitArtworkInside(requested, cardBounds);
          if (fit) applyFit(price, fit, () => groupRect(price));
        }
        for (const saving of separateSavings) {
          const requested = groupRect(saving);
          const bounds = area.contains(saving) ? photoBounds : cardBounds;
          const fit = requested && fitArtworkInside(requested, bounds);
          if (fit) applyFit(saving, fit, () => groupRect(saving));
        }
        const obstacles = () => [
          ...prices.flatMap(paintedRects),
          ...separateSavings.flatMap(paintedRects),
        ];
        let fits = targets.map((target) =>
          fitPhotoAroundArtwork(
            target.requested,
            targetBounds(target),
            obstacles(),
            gap,
          ),
        );
        const limited = fits.some((fit) => !fit);
        if (limited) {
          // A price dragged over the complete photo area cannot leave a photo there. Display it in
          // the lower reserved region instead; the user's original inline/model placement is kept.
          const lower = {
            ...cardBounds,
            y: cardBounds.y + cardBounds.height * 0.55,
            height: cardBounds.height * 0.45,
          };
          for (const price of prices) {
            restore(price);
            const requested = groupRect(price);
            const fit = requested && fitArtworkInside(requested, lower);
            if (fit) applyFit(price, fit, () => groupRect(price));
          }
          for (const saving of separateSavings) {
            restore(saving);
            const bounds = area.contains(saving) ? photoBounds : cardBounds;
            const gutter = {
              ...bounds,
              x: bounds.x + bounds.width * 0.78,
              width: bounds.width * 0.22,
            };
            const requested = groupRect(saving);
            const fit = requested && fitArtworkInside(requested, gutter);
            if (fit) applyFit(saving, fit, () => groupRect(saving));
          }
          fits = targets.map((target) =>
            fitPhotoAroundArtwork(
              target.requested,
              targetBounds(target),
              obstacles(),
              gap,
            ),
          );
        }
        if (fits.some((fit) => !fit)) {
          // Extremely short cover frames can put the lower reservation back inside
          // the photo area. Reserve a right gutter instead, leaving a positive slot
          // for every photo while continuing to honor its clipping bounds.
          const gutter = {
            ...cardBounds,
            x: cardBounds.x + cardBounds.width * 0.65,
            width: cardBounds.width * 0.35,
          };
          for (const price of prices) {
            restore(price);
            const requested = groupRect(price);
            const fit = requested && fitArtworkInside(requested, gutter);
            if (fit) applyFit(price, fit, () => groupRect(price));
          }
          for (const saving of separateSavings) {
            restore(saving);
            const bounds = area.contains(saving)
              ? {
                  ...photoBounds,
                  x: photoBounds.x + photoBounds.width * 0.65,
                  width: photoBounds.width * 0.35,
                }
              : gutter;
            const requested = groupRect(saving);
            const fit = requested && fitArtworkInside(requested, bounds);
            if (fit) applyFit(saving, fit, () => groupRect(saving));
          }
          fits = targets.map((target) =>
            fitPhotoAroundArtwork(
              target.requested,
              targetBounds(target),
              obstacles(),
              gap,
            ),
          );
        }
        targets.forEach((target, index) => {
          const fit = fits[index];
          if (fit) applyFit(target.element, fit, () => photoRect(target.image));
        });
        if (limited) card.dataset.appleClearanceLimited = "true";
        else delete card.dataset.appleClearanceLimited;
        area.dispatchEvent(
          new CustomEvent(APPLE_PHOTO_CLEARANCE_EVENT, { bubbles: true }),
        );
      } finally {
        updating = false;
        observeMutations();
      }
    };
    const queueUpdate = () => {
      if (!queued && !disposed) {
        queued = true;
        queueMicrotask(update);
      }
    };
    if (typeof ResizeObserver === "function") {
      resize = new ResizeObserver(queueUpdate);
      resize.observe(card);
      resize.observe(area);
    }
    if (typeof MutationObserver === "function")
      mutations = new MutationObserver(queueUpdate);
    card.addEventListener("load", queueUpdate, true);
    card.addEventListener("error", queueUpdate, true);
    document.fonts?.ready.then(queueUpdate);
    document.fonts?.addEventListener("loadingdone", queueUpdate);
    window.addEventListener("beforeprint", update);
    window.addEventListener("afterprint", queueUpdate);
    update();
    return () => {
      disposed = true;
      mutations?.disconnect();
      resize?.disconnect();
      card.removeEventListener("load", queueUpdate, true);
      card.removeEventListener("error", queueUpdate, true);
      document.fonts?.removeEventListener("loadingdone", queueUpdate);
      window.removeEventListener("beforeprint", update);
      window.removeEventListener("afterprint", queueUpdate);
      for (const element of originals.keys()) restore(element);
      delete card.dataset.appleClearanceLimited;
      area.dispatchEvent(
        new CustomEvent(APPLE_PHOTO_CLEARANCE_EVENT, { bubbles: true }),
      );
    };
  }, [photoAreaRef]);
  return null;
}

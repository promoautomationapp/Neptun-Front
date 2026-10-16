import { useLayoutEffect, useRef } from "react";
import { APPLE_PHOTO_CLEARANCE_EVENT } from "../brochure/ApplePhotoClearance";
import {
  fitArtworkInside,
  fitPhotoAroundArtwork,
  insetArtworkRect,
  projectNativeArtworkRect,
  unionArtworkRects,
  type ArtworkRect,
  type PhotoFit,
} from "../brochure/applePhotoGeometry";
import { requestedLayoutChanged } from "../brochure/layoutObservation";
import redGeometry from "../brochure/redPriceGeometry.json";

type StyledElement = HTMLElement | SVGElement;
const PHOTO_SELECTOR =
  '[data-social-apple-photo="true"],[data-apple-photo-clearance="true"]';
const ARTWORK_SELECTOR = [
  ".social-price-stack",
  ".social-savings-block",
  ".social-product-copy",
  ".social-specs",
  ".social-top-copy",
  ".social-canvas-asset",
  ".social-brand-footer",
  ".social-screen-size-label",
  ".brochure-product-name-divider[data-active=true]",
  `.product-artwork-item:not([data-apple-photo-clearance="true"])`,
].join(",");

/** Enforce Apple's photo clearance across independently positioned social layers.
 * Corrections live in CSS translate/scale; saved drag/resize transforms stay intact.
 */
export function SocialApplePhotoClearance() {
  const anchor = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const canvas = anchor.current?.closest<HTMLElement>(".social-canvas");
    const view = canvas?.ownerDocument.defaultView;
    if (!canvas || !view) return;
    const originals = new Map<
      StyledElement,
      { translate: string; scale: string }
    >();
    let disposed = false;
    let queued = false;
    let resize: ResizeObserver | undefined;
    let mutations: MutationObserver | undefined;
    let lastCorrection = "";
    const notify = () => {
      const correction = JSON.stringify(
        [...originals.keys()].map((element) => [
          element.style.translate,
          element.style.scale,
        ]),
      );
      if (correction !== lastCorrection) {
        lastCorrection = correction;
        canvas.dispatchEvent(new CustomEvent(APPLE_PHOTO_CLEARANCE_EVENT));
      }
    };
    const remember = (element: StyledElement) => {
      if (!originals.has(element))
        originals.set(element, {
          translate: element.style.translate,
          scale: element.style.scale,
        });
    };
    const restore = (element: StyledElement) => {
      const original = originals.get(element);
      if (original) {
        element.style.translate = original.translate;
        element.style.scale = original.scale;
      }
    };
    const visible = (element: Element) => {
      if (element.closest('[data-export-hide="true"]')) return false;
      for (
        let parent: Element | null = element;
        parent && canvas.contains(parent);
        parent = parent.parentElement
      ) {
        const style = view.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden")
          return false;
      }
      return true;
    };
    const observe = () =>
      mutations?.observe(canvas, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: [
          "class",
          "style",
          "src",
          "data-social-apple-photo",
          "data-apple-photo-clearance",
          "data-active",
        ],
      });
    const update = () => {
      queued = false;
      if (disposed) return;
      mutations?.disconnect();
      try {
        for (const element of originals.keys()) restore(element);
        const bounds = canvas.getBoundingClientRect();
        const visualScale = bounds.width / (canvas.offsetWidth || bounds.width);
        if (!bounds.width || !bounds.height || !visualScale) return;
        const box = (element: Element): ArtworkRect => {
          const rect = element.getBoundingClientRect();
          return {
            x: (rect.left - bounds.left) / visualScale,
            y: (rect.top - bounds.top) / visualScale,
            width: rect.width / visualScale,
            height: rect.height / visualScale,
          };
        };
        const gap = (3 * bounds.width) / visualScale / 1080;
        const canvasBounds = insetArtworkRect(
          {
            x: 0,
            y: 0,
            width: bounds.width / visualScale,
            height: bounds.height / visualScale,
          },
          gap,
        );
        const photoBox = (image: HTMLImageElement): ArtworkRect => {
          const rect = box(image);
          const style = view.getComputedStyle(image);
          if (
            !image.naturalWidth ||
            !image.naturalHeight ||
            !["", "contain", "scale-down"].includes(style.objectFit)
          )
            return rect;
          const ratio = Math.min(
            rect.width / image.naturalWidth,
            rect.height / image.naturalHeight,
          );
          const width = image.naturalWidth * ratio,
            height = image.naturalHeight * ratio;
          const position = (style.objectPosition || "50% 50%").split(/\s+/);
          const offset = (value: string | undefined, space: number) =>
            value === "left" || value === "top"
              ? 0
              : value === "right" || value === "bottom"
                ? space
                : value?.endsWith("%")
                  ? (space * Number.parseFloat(value)) / 100
                  : value?.endsWith("px")
                    ? Number.parseFloat(value)
                    : space / 2;
          const drawn = {
            x: rect.x + offset(position[0], rect.width - width),
            y: rect.y + offset(position[1], rect.height - height),
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
            dy = (shadow[1] || 0) * factor,
            extent = (shadow[2] || 0) * factor * 3;
          const left = Math.max(0, extent - dx),
            top = Math.max(0, extent - dy);
          return {
            x: drawn.x - left,
            y: drawn.y - top,
            width: width + left + Math.max(0, extent + dx),
            height: height + top + Math.max(0, extent + dy),
          };
        };
        const targets = [
          ...canvas.querySelectorAll<StyledElement>(PHOTO_SELECTOR),
        ].flatMap((element) => {
          const area = element.closest<HTMLElement>(".social-product");
          const image =
            element instanceof HTMLImageElement
              ? element
              : element.querySelector<HTMLImageElement>(
                  "img:not(.bundle-screen-artwork):not(.social-product-screen-image)",
                );
          if (!area || !image || !visible(element) || !visible(image))
            return [];
          const requested = photoBox(image);
          if (!requested.width || !requested.height) return [];
          remember(element);
          resize?.observe(area);
          resize?.observe(image);
          return [
            {
              element,
              image,
              requested,
              bounds: insetArtworkRect(box(area), gap),
            },
          ];
        });
        if (!targets.length) {
          delete canvas.dataset.socialAppleClearanceLimited;
          notify();
          return;
        }
        const painted = (element: StyledElement): ArtworkRect[] => {
          const parts: ArtworkRect[] = [];
          for (const part of [element, ...element.querySelectorAll("*")]) {
            if (!visible(part)) continue;
            if (part instanceof HTMLElement || part instanceof SVGSVGElement)
              parts.push(box(part));
            if (
              part instanceof SVGSVGElement &&
              part.classList.contains("red-reference-price-svg") &&
              [...part.querySelectorAll("path")].some(
                (path) =>
                  path.getAttribute("d") === redGeometry.parts.oldBand.path,
              )
            ) {
              const oldBand = projectNativeArtworkRect(
                redGeometry.parts.oldBand,
                box(part),
                Number.parseFloat(
                  part.getAttribute("viewBox")?.split(/\s+/)[2] || "0",
                ),
              );
              if (oldBand) parts.push(oldBand);
            }
            if (part instanceof SVGSVGElement) {
              const shadow = part.querySelector(
                "filter [stdDeviation][dx][dy]",
              );
              const nativeWidth = Number.parseFloat(
                part.getAttribute("viewBox")?.split(/\s+/)[2] || "0",
              );
              if (shadow && nativeWidth > 0) {
                const rect = box(part);
                const factor = rect.width / nativeWidth;
                const extent =
                  Number.parseFloat(
                    shadow.getAttribute("stdDeviation") || "0",
                  ) *
                  factor *
                  3;
                const dx =
                  Number.parseFloat(shadow.getAttribute("dx") || "0") * factor;
                const dy =
                  Number.parseFloat(shadow.getAttribute("dy") || "0") * factor;
                const left = Math.max(0, extent - dx),
                  top = Math.max(0, extent - dy);
                parts.push({
                  x: rect.x - left,
                  y: rect.y - top,
                  width: rect.width + left + Math.max(0, extent + dx),
                  height: rect.height + top + Math.max(0, extent + dy),
                });
              }
            }
          }
          return parts;
        };
        const artwork = [
          ...canvas.querySelectorAll<StyledElement>(ARTWORK_SELECTOR),
        ].filter(
          (element) => visible(element) && !element.closest(PHOTO_SELECTOR),
        );
        const apply = (
          element: StyledElement,
          fit: PhotoFit,
          read: () => ArtworkRect | null,
        ) => {
          remember(element);
          const original = originals.get(element);
          element.style.scale =
            fit.scale < 0.999999 ? String(fit.scale) : original?.scale || "";
          const scaled = read();
          if (scaled)
            element.style.translate = `${fit.rect.x - scaled.x}px ${fit.rect.y - scaled.y}px`;
        };
        const obstacles = () => artwork.flatMap(painted);
        const fits = () =>
          targets.map((target) =>
            fitPhotoAroundArtwork(
              target.requested,
              target.bounds,
              obstacles(),
              gap,
            ),
          );
        let fitted = fits();
        const limited = fitted.some((fit) => !fit);
        if (limited) {
          // Keep the requested overlay placements in the model, as the brochure
          // does, while displaying a reserved lower region for a blocked photo.
          const lower = {
            ...canvasBounds,
            y: canvasBounds.y + canvasBounds.height * 0.75,
            height: canvasBounds.height * 0.25,
          };
          for (const element of artwork.filter((element) =>
            element.matches(".social-price-stack,.social-savings-block"),
          )) {
            const requested = unionArtworkRects(painted(element));
            const fit = requested && fitArtworkInside(requested, lower);
            if (fit)
              apply(element, fit, () => unionArtworkRects(painted(element)));
          }
          fitted = fits();
          // A manually moved copy/logo may occupy the complete product frame.
          // Find a clear upper-canvas slot before changing any fixed artwork.
          const upper = { ...canvasBounds, height: canvasBounds.height * 0.75 };
          fitted = fitted.map(
            (fit, index) =>
              fit ||
              fitPhotoAroundArtwork(
                targets[index]!.requested,
                upper,
                obstacles(),
                gap,
              ),
          );
        }
        targets.forEach((target, index) => {
          const fit = fitted[index];
          if (fit) apply(target.element, fit, () => photoBox(target.image));
          else {
            // A completely covered canvas has no positive clear photo slot.
            // Keep the requested placement available for the next edit, while
            // avoiding a displayed overlap until the obstruction is moved.
            remember(target.element);
            target.element.style.scale = "0";
          }
        });
        if (limited) canvas.dataset.socialAppleClearanceLimited = "true";
        else delete canvas.dataset.socialAppleClearanceLimited;
        notify();
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
    if (typeof ResizeObserver === "function") {
      resize = new ResizeObserver(queueUpdate);
      resize.observe(canvas);
    }
    if (typeof MutationObserver === "function")
      mutations = new MutationObserver((records) => {
        if (requestedLayoutChanged(records)) queueUpdate();
      });
    canvas.addEventListener("load", queueUpdate, true);
    canvas.addEventListener("error", queueUpdate, true);
    void canvas.ownerDocument.fonts?.ready.then(queueUpdate);
    canvas.ownerDocument.fonts?.addEventListener("loadingdone", queueUpdate);
    view.addEventListener("beforeprint", update);
    update();
    return () => {
      disposed = true;
      mutations?.disconnect();
      resize?.disconnect();
      canvas.removeEventListener("load", queueUpdate, true);
      canvas.removeEventListener("error", queueUpdate, true);
      canvas.ownerDocument.fonts?.removeEventListener(
        "loadingdone",
        queueUpdate,
      );
      view.removeEventListener("beforeprint", update);
      for (const element of originals.keys()) restore(element);
      delete canvas.dataset.socialAppleClearanceLimited;
    };
  }, []);
  return <span ref={anchor} hidden data-export-hide="true" />;
}

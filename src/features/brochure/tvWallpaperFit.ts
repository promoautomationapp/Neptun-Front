import type { Box, Product } from "../../domain/models";
import { resolveAsset } from "../../api/client";
import { requestAi } from "../ai/ai.api";
import {
  detectedTelevisionScreenBox,
  normalizeScreenPhotoSource,
  savedScreenBoxForPhoto,
  screenPhotoSource,
} from "./screenGeometry";

export interface TvWallpaperFit {
  code: string;
  box: Box;
  detectedFor: string;
}
export interface TvWallpaperFitPlan {
  fits: TvWallpaperFit[];
  unfittedCodes: string[];
}
interface FitOptions {
  signal?: AbortSignal;
  allowAi?: boolean;
  loadImage?: (
    source: string,
    signal?: AbortSignal,
  ) => Promise<HTMLImageElement>;
  selectedFit?: TvWallpaperFit;
}
const fitCache = new Map<string, Box>();

export function validScreenBox(box: Box | null | undefined): box is Box {
  return Boolean(
    box &&
    [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.width >= 0.03 &&
    box.height >= 0.03 &&
    box.x + box.width <= 1 &&
    box.y + box.height <= 1,
  );
}

export function isDefaultScreenFallback(box: Box | null | undefined) {
  return Boolean(
    box &&
    Math.abs(box.x - 0.04) < 0.000001 &&
    Math.abs(box.y - 0.08) < 0.000001 &&
    Math.abs(box.width - 0.92) < 0.000001 &&
    Math.abs(box.height - 0.75) < 0.000001,
  );
}

export function screenGeometryImageUrl(source: string) {
  try {
    const url = new URL(source, document.baseURI);
    if (
      url.protocol === "https:" &&
      /(?:^|\.)neptun-ks\.com$/i.test(url.hostname)
    )
      return resolveAsset(
        `/api/export-image?url=${encodeURIComponent(source)}`,
      );
  } catch {
    // Local asset URLs continue through the regular authenticated asset path.
  }
  return resolveAsset(source);
}

function loadScreenPhoto(
  source: string,
  signal?: AbortSignal,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      if (error) {
        image.src = "";
        reject(error);
      } else resolve(image);
    };
    const abort = () =>
      finish(signal?.reason || new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(
      () => finish(new Error("The product photo could not be loaded.")),
      8000,
    );
    image.onload = () => finish();
    image.onerror = () =>
      finish(new Error("The product photo could not be loaded."));
    image.crossOrigin = "use-credentials";
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    image.src = screenGeometryImageUrl(source);
  });
}

function remember(source: string, box: Box) {
  fitCache.delete(source);
  fitCache.set(source, { ...box });
  while (fitCache.size > 128) fitCache.delete(fitCache.keys().next().value!);
}

// A fit belongs to one photo. Sharing a wallpaper never shares another TV's
// coordinates, including when the catalog photos have different white margins.
export async function fitTvWallpaperTargets(
  products: Product[],
  {
    signal,
    allowAi = false,
    loadImage = loadScreenPhoto,
    selectedFit,
  }: FitOptions = {},
): Promise<TvWallpaperFitPlan> {
  const plan: TvWallpaperFitPlan = { fits: [], unfittedCodes: [] };
  const pending = new Map<string, Promise<Box | null>>();
  async function measure(source: string) {
    const key = normalizeScreenPhotoSource(source);
    const cached = fitCache.get(key);
    if (cached) return { ...cached };
    if (!pending.has(key))
      pending.set(
        key,
        (async () => {
          let measured: Box | null = null;
          try {
            const image = await loadImage(source, signal);
            signal?.throwIfAborted();
            measured = detectedTelevisionScreenBox({}, image);
          } catch (error) {
            if (signal?.aborted) throw error;
          }
          if (!validScreenBox(measured) && allowAi) {
            signal?.throwIfAborted();
            const result = await requestAi(
              "ai-detect-screen",
              { image: source },
              signal,
            );
            signal?.throwIfAborted();
            if (result.found)
              measured = {
                x: result.x,
                y: result.y,
                width: result.width,
                height: result.height,
              };
          }
          if (!validScreenBox(measured)) return null;
          remember(key, measured);
          return { ...measured };
        })(),
      );
    return pending.get(key)!;
  }
  let next = 0;
  async function worker() {
    for (;;) {
      signal?.throwIfAborted();
      const product = products[next++];
      if (!product) return;
      const source = screenPhotoSource(product);
      let box: Box | null = savedScreenBoxForPhoto(product);
      if (isDefaultScreenFallback(box)) box = null;
      if (
        selectedFit?.code === String(product.code) &&
        normalizeScreenPhotoSource(selectedFit.detectedFor) ===
          normalizeScreenPhotoSource(source) &&
        validScreenBox(selectedFit.box)
      )
        box = selectedFit.box;
      if (!validScreenBox(box)) {
        try {
          box = source ? await measure(source) : null;
        } catch (error) {
          if (signal?.aborted) throw error;
          box = null;
        }
      }
      if (!source || !validScreenBox(box))
        plan.unfittedCodes.push(String(product.code));
      else
        plan.fits.push({
          code: String(product.code),
          box: { ...box },
          detectedFor: source,
        });
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(2, products.length) }, worker),
  );
  return plan;
}

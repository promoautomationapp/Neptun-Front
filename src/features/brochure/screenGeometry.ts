import type { Box, Bounds, Product, ScreenArtwork } from "../../domain/models";

type Pixels = ArrayLike<number>;
type ProductPhoto = Pick<
  Partial<Product>,
  "image" | "localImage" | "imageUrl" | "screenArtwork"
>;
interface SampledGeometry {
  source: string;
  bounds: Bounds | null;
  screen: Box | null;
}
const imageGeometryCache = new WeakMap<HTMLImageElement, SampledGeometry>();

function validPixels(pixels: Pixels, width: number, height: number) {
  return (
    Number.isInteger(width) &&
    width > 0 &&
    Number.isInteger(height) &&
    height > 0 &&
    pixels.length >= width * height * 4
  );
}

// Resolve relative URLs the same way as the rendered photo. The export proxy
// serves the same image and must not discard a manual fit during export.
export function normalizeScreenPhotoSource(source: string | undefined) {
  if (!source) return "";
  try {
    const url = new URL(
      source,
      typeof document === "undefined" ? "http://localhost/" : document.baseURI,
    );
    if (url.pathname === "/api/export-image") {
      const original = url.searchParams.get("url");
      if (original) return new URL(original, url.origin).href;
    }
    return url.href;
  } catch {
    return source;
  }
}

export function screenPhotoSource(
  product: ProductPhoto,
  image?: HTMLImageElement | null,
) {
  return (
    image?.currentSrc ||
    image?.src ||
    product.image ||
    product.localImage ||
    product.imageUrl ||
    ""
  );
}

// Explicit photo replacement invalidates even a legacy fit with no source
// metadata. An unchanged photo keeps the complete saved object intact.
export function screenArtworkForPhotoChange(
  artwork: ScreenArtwork | undefined,
  previousSource: string | undefined,
  nextSource: string | undefined,
) {
  if (
    !artwork ||
    normalizeScreenPhotoSource(previousSource) ===
      normalizeScreenPhotoSource(nextSource)
  )
    return artwork;
  const next = { ...artwork };
  delete next.box;
  delete next.detectedFor;
  return next;
}

export function savedScreenBoxForPhoto(
  product: ProductPhoto = {},
  image?: HTMLImageElement | null,
): Box | null {
  const artwork = product.screenArtwork;
  if (!artwork?.box) return null;
  const source = screenPhotoSource(product, image);
  if (
    artwork.detectedFor &&
    source &&
    normalizeScreenPhotoSource(artwork.detectedFor) !==
      normalizeScreenPhotoSource(source)
  )
    return null;
  // Older documents have no detectedFor. Keep those deliberate placements
  // until the user explicitly replaces the corresponding product photo.
  return { ...artwork.box };
}

// Transparent cutouts can have margins. These bounds remain useful for every
// product image, independent of whether a display can be recognized.
export function visibleImageBoundsFromPixels(
  pixels: Pixels,
  width: number,
  height: number,
): Bounds | null {
  if (!validPixels(pixels, width, height)) return null;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1,
    transparent = false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3]!;
      if (alpha < 32) transparent = true;
      if (alpha < 80) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  return transparent &&
    maxX - minX > width * 0.12 &&
    maxY - minY > height * 0.12
    ? {
        left: minX / width,
        top: minY / height,
        right: (maxX + 1) / width,
        bottom: (maxY + 1) / height,
      }
    : null;
}

// A front-facing TV forms a wide, aligned rectangle above its narrower feet.
// Only transparent or nearly white catalog backgrounds provide enough evidence
// for this inexpensive detector; other photographs retain the normal fallback.
export function televisionScreenBoxFromPixels(
  pixels: Pixels,
  width: number,
  height: number,
): Box | null {
  if (!validPixels(pixels, width, height)) return null;
  const transparent =
    visibleImageBoundsFromPixels(pixels, width, height) !== null;
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const whiteCorners = corners.filter(([x, y]) => {
    const offset = (y * width + x) * 4;
    return (
      pixels[offset + 3]! > 200 &&
      Math.min(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!) > 232
    );
  }).length;
  if (!transparent && whiteCorners < 3) return null;
  const rows: Array<{ left: number; right: number; span: number }> = [];
  let largestSpan = 0;
  for (let y = 0; y < height; y++) {
    let left = width,
      right = -1,
      count = 0;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (
        pixels[offset + 3]! < 80 ||
        (!transparent &&
          Math.min(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!) >=
            228)
      )
        continue;
      left = Math.min(left, x);
      right = x;
      count++;
    }
    const span = count >= 2 ? right - left + 1 : 0;
    largestSpan = Math.max(largestSpan, span);
    rows.push({ left, right, span });
  }
  if (largestSpan < width * 0.28) return null;
  let start = -1,
    initialLeft = 0,
    initialRight = 0;
  const runs: Array<{ start: number; end: number }> = [];
  function finish(end: number) {
    if (start >= 0) runs.push({ start, end });
    start = -1;
  }
  rows.forEach((row, y) => {
    const wide = row.span >= largestSpan * 0.84;
    const aligned =
      start < 0 ||
      (Math.abs(row.left - initialLeft) <= largestSpan * 0.06 &&
        Math.abs(row.right - initialRight) <= largestSpan * 0.06);
    if (!wide || !aligned) finish(y);
    if (wide && start < 0) {
      start = y;
      initialLeft = row.left;
      initialRight = row.right;
    }
  });
  finish(height);
  const best = runs.reduce<{ start: number; end: number } | null>(
    (longest, run) =>
      !longest || run.end - run.start > longest.end - longest.start
        ? run
        : longest,
    null,
  );
  if (!best || best.end - best.start < height * 0.18) return null;
  const median = (values: number[]) =>
    values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  const panelRows = rows.slice(best.start, best.end);
  const left = median(panelRows.map((row) => row.left));
  const right = median(panelRows.map((row) => row.right)) + 1;
  const panelWidth = right - left,
    panelHeight = best.end - best.start;
  const ratio = panelWidth / panelHeight;
  if (ratio < 1.15 || ratio > 3.4) return null;
  const insetX = Math.max(1, panelWidth * 0.0125),
    insetY = Math.max(1, panelHeight * 0.018);
  return {
    x: (left + insetX) / width,
    y: (best.start + insetY) / height,
    width: (panelWidth - insetX * 2) / width,
    height: (panelHeight - insetY * 2) / height,
  };
}

function sampledGeometry(
  image?: HTMLImageElement | null,
): SampledGeometry | null {
  if (
    !image?.naturalWidth ||
    !image.naturalHeight ||
    typeof document === "undefined"
  )
    return null;
  const source = `${image.currentSrc || image.src || ""}:${image.naturalWidth}:${image.naturalHeight}`;
  const cached = imageGeometryCache.get(image);
  if (cached?.source === source) return cached;
  const result: SampledGeometry = { source, bounds: null, screen: null };
  try {
    const scale = Math.min(
      1,
      160 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      result.bounds = visibleImageBoundsFromPixels(
        pixels,
        canvas.width,
        canvas.height,
      );
      result.screen = televisionScreenBoxFromPixels(
        pixels,
        canvas.width,
        canvas.height,
      );
    }
  } catch {
    /* Cross-origin and unrecognized photographs keep contained-image bounds. */
  }
  imageGeometryCache.set(image, result);
  return result;
}

export function visibleImageBounds(image?: HTMLImageElement | null) {
  const bounds = sampledGeometry(image)?.bounds;
  return bounds ? { ...bounds } : null;
}

export function televisionScreenBox(
  product: ProductPhoto = {},
  image?: HTMLImageElement | null,
): Box {
  const saved = savedScreenBoxForPhoto(product, image);
  if (saved) return saved;
  const geometry = sampledGeometry(image);
  if (geometry?.screen) return { ...geometry.screen };
  const bounds = geometry?.bounds || { left: 0, top: 0, right: 1, bottom: 1 };
  const width = bounds.right - bounds.left,
    height = bounds.bottom - bounds.top;
  return {
    x: bounds.left + width * 0.04,
    y: bounds.top + height * 0.08,
    width: width * 0.92,
    height: height * 0.75,
  };
}

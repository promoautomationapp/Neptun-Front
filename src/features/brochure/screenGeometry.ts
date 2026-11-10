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
  screenSampled: boolean;
}
const imageGeometryCache = new WeakMap<HTMLImageElement, SampledGeometry>();
// Page navigation replaces image elements. Keep only the small detected boxes,
// never canvas/pixel buffers, so returning to an image does not rescan it.
const sourceGeometryCache = new Map<string, SampledGeometry>();
const MAX_SOURCE_GEOMETRIES = 256;
const MAX_SOURCE_KEY_LENGTH = 4096;

export function validScreenGeometryBox(
  box: Box | null | undefined,
): box is Box {
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
  if (!validScreenGeometryBox(artwork?.box)) return null;
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
  const cornerColors = corners.map(([x, y]) => {
    const offset = (y * width + x) * 4;
    return [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!];
  });
  const background = [0, 1, 2].map(
    (channel) =>
      [...cornerColors]
        .map((color) => color[channel]!)
        .sort((a, b) => a - b)[2]!,
  );
  const plainCorners = cornerColors.filter(
    (color) =>
      Math.min(...color) >= 170 &&
      color.every(
        (value, channel) => Math.abs(value - background[channel]!) <= 18,
      ),
  ).length;
  if (!transparent && plainCorners < 3) return null;
  const backgroundPixel = (offset: number) =>
    pixels[offset + 3]! < 80 ||
    (!transparent &&
      background.every(
        (value, channel) => Math.abs(pixels[offset + channel]! - value) <= 24,
      ));
  const rows: Array<{ left: number; right: number; span: number }> = [];
  let largestSpan = 0;
  for (let y = 0; y < height; y++) {
    let left = width,
      right = -1,
      count = 0;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (backgroundPixel(offset)) continue;
      left = Math.min(left, x);
      right = x;
      count++;
    }
    const outerSpan = count >= 2 ? right - left + 1 : 0;
    const span = outerSpan && count / outerSpan >= 0.3 ? outerSpan : 0;
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
  // The silhouette includes the bezel. Find the first transition from its
  // dark, even frame into the display, independently along all four edges.
  // This preserves thick lower bezels and excludes the stand/feet below.
  const line = (vertical: boolean, coordinate: number) => {
    const start = vertical ? best.start : left;
    const length = vertical ? panelHeight : panelWidth;
    const values: number[][] = [];
    for (let n = Math.ceil(length * 0.16); n < length * 0.84; n++) {
      const x = vertical ? coordinate : start + n;
      const y = vertical ? start + n : coordinate;
      const offset = (y * width + x) * 4;
      values.push([pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!]);
    }
    const means = [0, 1, 2].map(
      (channel) =>
        values.reduce((sum, value) => sum + value[channel]!, 0) /
        Math.max(1, values.length),
    );
    return {
      means,
      light: means.reduce((sum, value) => sum + value, 0) / 3,
      chroma:
        values.reduce(
          (sum, value) => sum + Math.max(...value) - Math.min(...value),
          0,
        ) / Math.max(1, values.length),
      spread:
        values.reduce(
          (sum, value) =>
            sum +
            value.reduce(
              (total, item, channel) =>
                total + Math.abs(item - means[channel]!),
              0,
            ) /
              3,
          0,
        ) / Math.max(1, values.length),
    };
  };
  const edge = (
    vertical: boolean,
    origin: number,
    direction: number,
    length: number,
  ) => {
    let previous = line(vertical, origin);
    for (
      let depth = 1;
      depth <= Math.max(2, Math.ceil(length * 0.16));
      depth++
    ) {
      const current = line(vertical, origin + direction * depth);
      const difference =
        current.means.reduce(
          (sum, value, channel) =>
            sum + Math.abs(value - previous.means[channel]!),
          0,
        ) / 3;
      if (
        previous.light < 120 &&
        previous.spread < 36 &&
        ((difference >= 4 &&
          current.chroma >= 5 &&
          current.chroma > previous.chroma + 3) ||
          (difference >= 50 && current.light > 150 && previous.light < 80) ||
          (difference >= 7 &&
            current.spread > 18 &&
            current.spread > previous.spread + 10))
      )
        return depth;
      previous = current;
    }
    return 0;
  };
  const edges = [
    edge(true, left, 1, panelWidth),
    edge(true, right - 1, -1, panelWidth),
    edge(false, best.start, 1, panelHeight),
    edge(false, best.end - 1, -1, panelHeight),
  ];
  const insetLeft = edges[0] || Math.max(1, Math.round(panelWidth * 0.003));
  const insetRight = edges[1] || Math.max(1, Math.round(panelWidth * 0.003));
  const insetTop = edges[2] || Math.max(1, Math.round(panelHeight * 0.003));
  const insetBottom = edges[3] || Math.max(1, Math.round(panelHeight * 0.003));
  const innerWidth = panelWidth - insetLeft - insetRight;
  const innerHeight = panelHeight - insetTop - insetBottom;
  return {
    x: (left + insetLeft) / width,
    y: (best.start + insetTop) / height,
    width: innerWidth / width,
    height: innerHeight / height,
  };
}

function sampledGeometry(
  image?: HTMLImageElement | null,
  detectScreen = false,
): SampledGeometry | null {
  if (
    !image?.naturalWidth ||
    !image.naturalHeight ||
    typeof document === "undefined"
  )
    return null;
  const source = `${image.currentSrc || image.src || ""}:${image.naturalWidth}:${image.naturalHeight}`;
  const cached = imageGeometryCache.get(image);
  if (cached?.source === source && (!detectScreen || cached.screenSampled))
    return cached;
  const shared = sourceGeometryCache.get(source);
  if (shared && image.complete && (!detectScreen || shared.screenSampled)) {
    sourceGeometryCache.delete(source);
    sourceGeometryCache.set(source, shared);
    imageGeometryCache.set(image, shared);
    return shared;
  }
  const previous = cached?.source === source ? cached : shared;
  const result: SampledGeometry = previous || {
    source,
    bounds: null,
    screen: null,
    screenSampled: false,
  };
  let sampled = false;
  try {
    const scale = Math.min(
      1,
      640 / Math.max(image.naturalWidth, image.naturalHeight),
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
      sampled = true;
      result.bounds = visibleImageBoundsFromPixels(
        pixels,
        canvas.width,
        canvas.height,
      );
      if (detectScreen)
        result.screen = televisionScreenBoxFromPixels(
          pixels,
          canvas.width,
          canvas.height,
        );
    }
  } catch {
    /* Cross-origin and unrecognized photographs keep contained-image bounds. */
  }
  // Header dimensions may be available before the picture has decoded. A
  // partial/failed sample must not survive the later load event for that URL.
  if (image.complete) {
    if (detectScreen) result.screenSampled = true;
    imageGeometryCache.set(image, result);
    // Long inline uploads stay weakly cached on their own image, preventing
    // this session cache from retaining large data URLs after a draft closes.
    if (
      sampled &&
      source.length <= MAX_SOURCE_KEY_LENGTH &&
      (image.currentSrc || image.src)
    ) {
      sourceGeometryCache.set(source, result);
      if (sourceGeometryCache.size > MAX_SOURCE_GEOMETRIES)
        sourceGeometryCache.delete(sourceGeometryCache.keys().next().value!);
    }
  }
  return result;
}

export function visibleImageBounds(image?: HTMLImageElement | null) {
  const bounds = sampledGeometry(image)?.bounds;
  return bounds ? { ...bounds } : null;
}

export function detectedTelevisionScreenBox(
  product: ProductPhoto = {},
  image?: HTMLImageElement | null,
): Box | null {
  const screen = sampledGeometry(image, true)?.screen;
  if (screen) return { ...screen };
  const saved = savedScreenBoxForPhoto(product, image);
  return saved &&
    !(
      Math.abs(saved.x - 0.04) < 0.000001 &&
      Math.abs(saved.y - 0.08) < 0.000001 &&
      Math.abs(saved.width - 0.92) < 0.000001 &&
      Math.abs(saved.height - 0.75) < 0.000001
    )
    ? saved
    : null;
}

export function televisionScreenBox(
  product: ProductPhoto = {},
  image?: HTMLImageElement | null,
): Box {
  const geometry = sampledGeometry(image, true);
  if (geometry?.screen) return { ...geometry.screen };
  const saved = savedScreenBoxForPhoto(product, image);
  if (saved) return saved;
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

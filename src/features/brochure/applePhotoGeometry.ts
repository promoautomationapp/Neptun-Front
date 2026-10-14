export interface ArtworkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoFit {
  rect: ArtworkRect;
  scale: number;
}

const EPSILON = 0.000001;
const right = (rect: ArtworkRect) => rect.x + rect.width;
const bottom = (rect: ArtworkRect) => rect.y + rect.height;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

function valid(rect: ArtworkRect) {
  return (
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function rectsOverlap(first: ArtworkRect, second: ArtworkRect) {
  return (
    first.x < right(second) - EPSILON &&
    right(first) > second.x + EPSILON &&
    first.y < bottom(second) - EPSILON &&
    bottom(first) > second.y + EPSILON
  );
}

export function unionArtworkRects(rects: ArtworkRect[]): ArtworkRect | null {
  const usable = rects.filter(valid);
  if (!usable.length) return null;
  const x = Math.min(...usable.map((rect) => rect.x));
  const y = Math.min(...usable.map((rect) => rect.y));
  return {
    x,
    y,
    width: Math.max(...usable.map(right)) - x,
    height: Math.max(...usable.map(bottom)) - y,
  };
}

/** SVG overflow is painted outside its viewBox, including the red regular-price band. */
export function projectNativeArtworkRect(
  native: ArtworkRect,
  viewport: ArtworkRect,
  viewBoxWidth: number,
): ArtworkRect | null {
  if (
    !valid(native) ||
    !valid(viewport) ||
    !Number.isFinite(viewBoxWidth) ||
    viewBoxWidth <= 0
  )
    return null;
  const scale = viewport.width / viewBoxWidth;
  return {
    x: viewport.x + native.x * scale,
    y: viewport.y + native.y * scale,
    width: native.width * scale,
    height: native.height * scale,
  };
}

export function insetArtworkRect(
  rect: ArtworkRect,
  inset: number,
): ArtworkRect {
  const amount = Math.max(0, Number.isFinite(inset) ? inset : 0);
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    width: rect.width - amount * 2,
    height: rect.height - amount * 2,
  };
}

export function fitArtworkInside(
  requested: ArtworkRect,
  bounds: ArtworkRect,
): PhotoFit | null {
  if (!valid(requested) || !valid(bounds)) return null;
  const scale = Math.min(
    1,
    bounds.width / requested.width,
    bounds.height / requested.height,
  );
  const width = requested.width * scale;
  const height = requested.height * scale;
  return {
    scale,
    rect: {
      x: clamp(
        requested.x + (requested.width - width) / 2,
        bounds.x,
        right(bounds) - width,
      ),
      y: clamp(
        requested.y + (requested.height - height) / 2,
        bounds.y,
        bottom(bounds) - height,
      ),
      width,
      height,
    },
  };
}

/** Keep a photo's aspect ratio, then retain the largest size and nearest requested position. */
export function fitPhotoAroundArtwork(
  requested: ArtworkRect,
  bounds: ArtworkRect,
  artwork: ArtworkRect[],
  gap = 3,
): PhotoFit | null {
  if (!valid(requested) || !valid(bounds)) return null;
  const padding = Math.max(0, Number.isFinite(gap) ? gap : 0);
  const obstacles = artwork
    .filter(valid)
    .map((rect) => ({
      x: rect.x - padding,
      y: rect.y - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    }))
    .filter((rect) => rectsOverlap(rect, bounds));
  const whole = fitArtworkInside(requested, bounds);
  if (whole && !obstacles.some((rect) => rectsOverlap(whole.rect, rect)))
    return whole;

  // Every maximal empty rectangle has horizontal edges on a boundary or an obstacle.
  // For each horizontal interval, merge blocked vertical intervals and inspect its gaps.
  const edges = [
    ...new Set([
      bounds.x,
      right(bounds),
      ...obstacles.flatMap((rect) => [
        clamp(rect.x, bounds.x, right(bounds)),
        clamp(right(rect), bounds.x, right(bounds)),
      ]),
    ]),
  ].sort((a, b) => a - b);
  let best: PhotoFit | null = null;
  let bestDistance = Infinity;
  for (let leftIndex = 0; leftIndex < edges.length - 1; leftIndex++) {
    const x = edges[leftIndex];
    if (x == null) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < edges.length;
      rightIndex++
    ) {
      const end = edges[rightIndex];
      if (end == null || end - x <= EPSILON) continue;
      const blocked = obstacles
        .filter((rect) => rect.x < end - EPSILON && right(rect) > x + EPSILON)
        .map(
          (rect) =>
            [
              Math.max(bounds.y, rect.y),
              Math.min(bottom(bounds), bottom(rect)),
            ] as const,
        )
        .sort((a, b) => a[0] - b[0]);
      let y = bounds.y;
      const inspect = (endY: number) => {
        if (endY - y <= EPSILON) return;
        const candidate = fitArtworkInside(requested, {
          x,
          y,
          width: end - x,
          height: endY - y,
        });
        if (!candidate) return;
        const distance = Math.hypot(
          candidate.rect.x +
            candidate.rect.width / 2 -
            requested.x -
            requested.width / 2,
          candidate.rect.y +
            candidate.rect.height / 2 -
            requested.y -
            requested.height / 2,
        );
        if (
          !best ||
          candidate.scale > best.scale + EPSILON ||
          (Math.abs(candidate.scale - best.scale) <= EPSILON &&
            distance < bestDistance)
        ) {
          best = candidate;
          bestDistance = distance;
        }
      };
      for (const [start, endY] of blocked) {
        inspect(start);
        y = Math.max(y, endY);
      }
      inspect(bottom(bounds));
    }
  }
  return best;
}

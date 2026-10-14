export interface ImageFitPlacement { x: number; y: number; scale: number; }
const positive = (value: number) => Number.isFinite(value) && value > 0;

// Fit the visible product to its existing contain rectangle. Transparent canvas
// margins belong to the image, not the design: positions and saved scales stay
// relative to the complete visible product, regardless of the cutout provider.
export function productImageFit({
  naturalWidth,
  naturalHeight,
  imageBoxWidth,
  imageBoxHeight,
  wrapWidth,
  wrapHeight,
  bounds,
  base = { x: 50, y: 50, scale: 1 },
}: {naturalWidth: number; naturalHeight: number; imageBoxWidth: number; imageBoxHeight: number; wrapWidth: number; wrapHeight: number; bounds?: {left: number; top: number; right: number; bottom: number} | null; base?: ImageFitPlacement}) {
  const unchanged = { ...base };
  if (!bounds || ![naturalWidth, naturalHeight, imageBoxWidth, imageBoxHeight, wrapWidth, wrapHeight].every(positive) ||
    !Number.isFinite(base?.x) || !Number.isFinite(base?.y) || !positive(base?.scale)) return unchanged;
  const { left, top, right, bottom } = bounds;
  if (![left, top, right, bottom].every(Number.isFinite) || left < 0 || top < 0 || right > 1 || bottom > 1 ||
    right <= left || bottom <= top) return unchanged;

  const contain = Math.min(imageBoxWidth / naturalWidth, imageBoxHeight / naturalHeight);
  const visibleWidth = naturalWidth * (right - left);
  const visibleHeight = naturalHeight * (bottom - top);
  if (![contain, visibleWidth, visibleHeight].every(positive)) return unchanged;
  const visibleContain = Math.min(imageBoxWidth / visibleWidth, imageBoxHeight / visibleHeight);
  const factor = visibleContain / contain;
  if (![visibleContain, factor].every(positive)) return unchanged;
  const scale = base.scale * factor;
  const x = base.x + (.5 - (left + right) / 2) * naturalWidth * contain * scale / wrapWidth * 100;
  const y = base.y + (.5 - (top + bottom) / 2) * naturalHeight * contain * scale / wrapHeight * 100;
  return [x, y, scale].every(Number.isFinite) ? { ...base, x, y, scale } : unchanged;
}

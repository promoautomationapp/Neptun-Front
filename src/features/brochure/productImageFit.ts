import { otherScreenAnnotationBaseBox } from "./screenAnnotationGeometry";

export interface ImageFitPlacement {
  x: number;
  y: number;
  scale: number;
}
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
  preservePlacement = false,
  padding = 0,
  externalAnnotation = false,
  allowOverflow = false,
}: {
  naturalWidth: number;
  naturalHeight: number;
  imageBoxWidth: number;
  imageBoxHeight: number;
  wrapWidth: number;
  wrapHeight: number;
  bounds?: { left: number; top: number; right: number; bottom: number } | null;
  base?: ImageFitPlacement;
  preservePlacement?: boolean;
  padding?: number;
  externalAnnotation?: boolean;
  allowOverflow?: boolean;
}) {
  const unchanged = { ...base };
  if (
    ![
      naturalWidth,
      naturalHeight,
      imageBoxWidth,
      imageBoxHeight,
      wrapWidth,
      wrapHeight,
    ].every(positive) ||
    !Number.isFinite(base?.x) ||
    !Number.isFinite(base?.y) ||
    !positive(base?.scale)
  )
    return unchanged;
  // Automatic fitting protects the default layout. A deliberate photo edit is
  // free to extend beyond its offer's photo slot (even across the whole page).
  if (allowOverflow) return unchanged;
  const { left, top, right, bottom } = bounds || {
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
  };
  if (
    ![left, top, right, bottom].every(Number.isFinite) ||
    left < 0 ||
    top < 0 ||
    right > 1 ||
    bottom > 1 ||
    right <= left ||
    bottom <= top
  )
    return unchanged;

  const contain = Math.min(
    imageBoxWidth / naturalWidth,
    imageBoxHeight / naturalHeight,
  );
  const visibleWidth = naturalWidth * (right - left);
  const visibleHeight = naturalHeight * (bottom - top);
  if (![contain, visibleWidth, visibleHeight].every(positive)) return unchanged;
  const visibleContain = Math.min(
    imageBoxWidth / visibleWidth,
    imageBoxHeight / visibleHeight,
  );
  const factor = preservePlacement ? 1 : visibleContain / contain;
  if (![visibleContain, factor].every(positive)) return unchanged;
  const inset = Math.max(0, Math.min(0.1, padding));
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));
  const centerX = clamp(base.x / 100, inset, 1 - inset);
  const centerY = clamp(base.y / 100, inset, 1 - inset);
  // A contain box alone can still be cut off when its center is shifted for
  // left-side details. Fit to the room around that center, not just CSS size.
  const nativeWidth = visibleWidth * contain;
  const nativeHeight = visibleHeight * contain;
  const annotation = externalAnnotation
    ? otherScreenAnnotationBaseBox({
        left: 0,
        top: 0,
        width: nativeWidth,
        height: nativeHeight,
      })
    : null;
  const extraRight = annotation
    ? Math.max(0, annotation.left + annotation.width - nativeWidth)
    : 0;
  const extraTop = annotation ? Math.max(0, -annotation.top) : 0;
  const maxScale = preservePlacement
    ? Math.min(
        (wrapWidth * (1 - inset * 2)) / (nativeWidth + extraRight),
        (wrapHeight * (1 - inset * 2)) / (nativeHeight + extraTop),
      )
    : Math.min(
        ((centerX - inset) * wrapWidth) / (nativeWidth / 2),
        ((1 - inset - centerX) * wrapWidth) / (nativeWidth / 2 + extraRight),
        ((centerY - inset) * wrapHeight) / (nativeHeight / 2 + extraTop),
        ((1 - inset - centerY) * wrapHeight) / (nativeHeight / 2),
      );
  const scale = Math.min(
    base.scale * factor,
    maxScale > 0
      ? maxScale
      : Math.min(
          wrapWidth / (nativeWidth + extraRight),
          wrapHeight / (nativeHeight + extraTop),
        ),
  );
  const offsetX = ((left + right) / 2 - 0.5) * naturalWidth * contain * scale;
  const offsetY = ((top + bottom) / 2 - 0.5) * naturalHeight * contain * scale;
  const halfWidth = (visibleWidth * contain * scale) / 2;
  const halfHeight = (visibleHeight * contain * scale) / 2;
  const fittedCenterX = clamp(
    centerX * wrapWidth + (preservePlacement ? offsetX : 0),
    inset * wrapWidth + halfWidth,
    (1 - inset) * wrapWidth - halfWidth - extraRight * scale,
  );
  const fittedCenterY = clamp(
    centerY * wrapHeight + (preservePlacement ? offsetY : 0),
    inset * wrapHeight + halfHeight + extraTop * scale,
    (1 - inset) * wrapHeight - halfHeight,
  );
  const x = ((fittedCenterX - offsetX) / wrapWidth) * 100;
  const y = ((fittedCenterY - offsetY) / wrapHeight) * 100;
  return [x, y, scale].every(Number.isFinite)
    ? { ...base, x, y, scale }
    : unchanged;
}

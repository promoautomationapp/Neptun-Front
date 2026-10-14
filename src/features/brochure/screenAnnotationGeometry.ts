import type { CSSProperties } from "react";
import type { Placement } from "../../domain/models";
import type { Product } from "../../domain/models";
import { isAppleProduct, isMobilePhone } from "./productTypes";

export type ScreenAnnotationType = "television" | "phone" | "other";
export interface ScreenAnnotationPlacement extends Placement {
  hidden?: boolean;
  textPosition?: "balanced" | "original";
  horizontalLength?: number;
  verticalLength?: number;
}
export interface AnnotationBox {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface ResolvedScreenAnnotationPlacement extends ScreenAnnotationPlacement {
  x: number;
  y: number;
  scale: number;
}

export const TV_ANNOTATION_SCREEN_WIDTH = 0.33;
export const TV_ANNOTATION_DEFAULT_SCALE = 0.9;
export const TV_ANNOTATION_INSET_PX = 2;
export const SCREEN_ANNOTATION_CANONICAL_WIDTH = 1080;
export const PHONE_ANNOTATION_IMAGE_WIDTH = 0.25;
const canonicalInset =
  (TV_ANNOTATION_INSET_PX / SCREEN_ANNOTATION_CANONICAL_WIDTH) * 100;

// A saved coordinate or scale is a deliberate manual edit. Apply the new
// default only to fields the user has not already adjusted.
export function resolveScreenAnnotationPlacement(
  type: ScreenAnnotationType,
  saved?: ScreenAnnotationPlacement,
): ResolvedScreenAnnotationPlacement {
  const manual = saved && (Number.isFinite(saved.x) || Number.isFinite(saved.y) || Number.isFinite(saved.scale) && Number(saved.scale) > 0);
  saved ||= {};
  const television = type === "television" || type === "phone";
  return {
    ...saved,
    ...(type === "television" ? {textPosition: saved.textPosition || (manual ? "original" : "balanced")} : {}),
    x: Number.isFinite(saved.x) ? saved.x! : television ? -canonicalInset : 0,
    y: Number.isFinite(saved.y) ? saved.y! : television ? canonicalInset : 0,
    scale:
      Number.isFinite(saved.scale) && saved.scale! > 0
        ? saved.scale!
        : television
          ? TV_ANNOTATION_DEFAULT_SCALE
          : 1,
  };
}

export function screenAnnotationPlacementStyle(
  type: ScreenAnnotationType,
  saved: ScreenAnnotationPlacement = {},
): CSSProperties {
  const { x, y, scale } = resolveScreenAnnotationPlacement(type, saved);
  return {
    transform: `translate(${x}cqw,${y}cqw) scale(${scale})`,
    transformOrigin: "top right",
  };
}

// Callers measure the native screen in their own (possibly preview-scaled)
// coordinates. The shared annotation applies its proportional adjustment once.
export function televisionAnnotationBaseBox(
  screen: AnnotationBox,
): AnnotationBox {
  const side = screen.width * TV_ANNOTATION_SCREEN_WIDTH;
  return {
    left: screen.left + screen.width - side,
    top: screen.top,
    width: side,
    height: side,
  };
}

export function usesPhoneCornerAnnotation(product: Partial<Product>): boolean {
  return isMobilePhone(product) && !isAppleProduct(product);
}

// Phones share the folded corner artwork, proportioned to their portrait
// photo rather than a wide television panel. Callers normalize any preview
// scaling before passing the visible photo rectangle.
export function phoneAnnotationBaseBox(photo: AnnotationBox): AnnotationBox {
  const side = Math.min(
    photo.width * PHONE_ANNOTATION_IMAGE_WIDTH,
    photo.height,
  );
  return {
    left: photo.left + photo.width - side,
    top: photo.top,
    width: side,
    height: side,
  };
}

// Equivalent to the CSS translate/scale around the upper-right corner. Keeping
// this geometry explicit guards against a shrink moving the sticker right/up.
export function renderedScreenAnnotationBox(
  base: AnnotationBox,
  pageWidth: number,
  type: ScreenAnnotationType,
  saved: ScreenAnnotationPlacement = {},
): AnnotationBox {
  const { x, y, scale } = resolveScreenAnnotationPlacement(type, saved);
  return {
    left: base.left + base.width * (1 - scale) + (x / 100) * pageWidth,
    top: base.top + (y / 100) * pageWidth,
    width: base.width * scale,
    height: base.height * scale,
  };
}

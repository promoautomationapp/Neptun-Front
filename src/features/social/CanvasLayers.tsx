import type { Placement, Product } from "../../domain/models";
import type { CSSProperties, ReactNode } from "react";
export interface CanvasAssetPlacement {
  x: number;
  y: number;
  width: number;
}
export interface CanvasAssetProps {
  name: string;
  source?: string;
  children?: ReactNode;
  position?: Placement;
  presetStyle?: CSSProperties;
  width: number;
  height?: number;
  color?: string;
  opacity?: number;
  zIndex?: number;
  minWidth?: number;
  maxWidth?: number;
  editable?: boolean;
  artwork?: boolean;
  onChange?: (placement: CanvasAssetPlacement) => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}
interface AssetGesture extends CanvasAssetPlacement {
  kind: "move" | "resize";
  canvas: DOMRect;
  startX: number;
  startY: number;
}
export interface EditableOfferBlockProps {
  name: string;
  className: string;
  placement?: Placement;
  editable?: boolean;
  onChange?: (placement: Placement) => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  style?: CSSProperties;
  children?: ReactNode;
}
interface OfferGesture {
  kind: "move" | "resize";
  startX: number;
  startY: number;
  canvas: DOMRect;
  rect: DOMRect;
  x: number;
  y: number;
  scale: number;
}
export interface SocialProductVisualProps {
  product: Product;
  image?: string;
  showImage?: boolean;
  showInches?: boolean;
  adjustImage?: boolean;
  onPlaceImage?: (placement: Placement) => void;
  onChangeProduct?: (
    field: keyof Product,
    value: Product[keyof Product],
  ) => void;
  details?: ReactNode;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}
interface ProductVisualGesture {
  kind: "move" | "resize";
  startX: number;
  startY: number;
  baseWidth: number;
  baseHeight: number;
  x: number;
  y: number;
  scale: number;
}
import { hasApplePhotos } from "../brochure/productTypes";
import { APPLE_PHOTO_CLEARANCE_EVENT } from "../brochure/ApplePhotoClearance";
import { isBundleOffer } from "../brochure/productBundles";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  defaultProductImageScale,
  otherScreenInches,
  tvScreenInches,
} from "../brochure/tvSpecs";
import { productImageFit } from "../brochure/productImageFit";
import { tvInchesEmbedded } from "../brochure/imageReview";
import {
  televisionScreenBox,
  visibleImageBounds,
} from "../brochure/screenGeometry";
import { EditableScreenAnnotation } from "../brochure/EditableScreenAnnotation";
import { otherScreenAnnotationBaseBox } from "../brochure/screenAnnotationGeometry";
import { ProductArtworkLayer } from "../brochure/ProductArtworkLayer";
import { materializeProductNameAlignment } from "../brochure/ProductNameDivider";
import { t } from "../brochure/i18n";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function CanvasAsset({
  name,
  source,
  children,
  position,
  presetStyle,
  width,
  height,
  color,
  opacity = 1,
  zIndex,
  minWidth = 4,
  maxWidth = 70,
  editable,
  artwork = false,
  onChange,
  onRemove,
  onEdit,
  onGestureStart,
  onGestureEnd,
}: CanvasAssetProps) {
  const editLabel = color ? t("Edit") : t("Manage image");
  const gesture = useRef<AssetGesture | null>(null);
  const assetRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(false);
  useEffect(() => {
    if (!selected) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !assetRef.current?.contains(event.target)
      )
        setSelected(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [selected]);
  const style = position
    ? {
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${width}%`,
        transform: "translate(-50%, -50%)",
      }
    : { ...presetStyle, width: `${width}%` };
  function start(
    event: React.PointerEvent<HTMLElement>,
    kind: AssetGesture["kind"],
  ) {
    if (!editable) return;
    const canvasElement = event.currentTarget.closest(".social-canvas");
    const assetElement = event.currentTarget.closest(".social-canvas-asset");
    if (!canvasElement || !assetElement) return;
    const canvas = canvasElement.getBoundingClientRect();
    const rect = assetElement.getBoundingClientRect();
    if (!canvas.width || !canvas.height) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.current = {
      kind,
      canvas,
      startX: event.clientX,
      startY: event.clientY,
      x:
        position?.x ??
        ((rect.left + rect.width / 2 - canvas.left) / canvas.width) * 100,
      y:
        position?.y ??
        ((rect.top + rect.height / 2 - canvas.top) / canvas.height) * 100,
      width,
    };
    onGestureStart?.();
  }
  function move(event: React.PointerEvent<HTMLElement>) {
    const action = gesture.current;
    if (!action) return;
    const dx = ((event.clientX - action.startX) / action.canvas.width) * 100;
    const dy = ((event.clientY - action.startY) / action.canvas.height) * 100;
    onChange?.(
      action.kind === "resize"
        ? {
            x: action.x,
            y: action.y,
            width: clamp(action.width + dx * 2, minWidth, maxWidth),
          }
        : {
            x: clamp(action.x + dx, 3, 97),
            y: clamp(action.y + dy, 3, 97),
            width: action.width,
          },
    );
  }
  function end() {
    gesture.current = null;
    onGestureEnd?.();
  }
  return (
    <div
      ref={assetRef}
      className={`social-canvas-asset ${artwork ? "social-artwork-asset" : ""} ${editable ? "editable" : ""} ${selected && editable ? "selected" : ""}`}
      style={{
        ...style,
        height: height === undefined ? undefined : `${height}%`,
        zIndex,
      }}
      aria-label={name}
      onPointerDown={
        editable
          ? (event) => {
              setSelected(true);
              start(event, "move");
            }
          : undefined
      }
      onClick={editable ? () => setSelected(true) : undefined}
      onPointerMove={editable ? move : undefined}
      onPointerUp={editable ? end : undefined}
      onPointerCancel={editable ? end : undefined}
      onDoubleClick={
        editable && onEdit
          ? (event) => {
              event.stopPropagation();
              onEdit();
            }
          : undefined
      }
    >
      {color ? (
        <div
          className="social-color-layer"
          style={{ backgroundColor: color, opacity: clamp(opacity, 0, 1) }}
        />
      ) : source ? (
        <img
          src={source}
          alt={name}
          draggable={false}
          style={{ opacity: clamp(opacity, 0, 1) }}
        />
      ) : (
        children
      )}
      {editable && (
        <div className="social-asset-tools" data-export-hide="true">
          {onEdit && (
            <button
              type="button"
              className="social-asset-edit"
              aria-label={`${editLabel}: ${name}`}
              title={`${editLabel}: ${name}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onEdit}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Z" />
              </svg>
              <span>{editLabel}</span>
            </button>
          )}
          <button
            type="button"
            className="social-asset-resize"
            title={`${t("Resize")} ${name}`}
            aria-label={`${t("Resize")} ${name}`}
            onPointerDown={(event) => start(event, "resize")}
            onPointerMove={(event) => {
              event.stopPropagation();
              move(event);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              end();
            }}
          >
            ↘
          </button>
          {onRemove && (
            <button
              type="button"
              className="social-asset-remove"
              title={`${t("Remove")} ${name}`}
              aria-label={`${t("Remove")} ${name}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onRemove}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function EditableOfferBlock({
  name,
  className,
  placement,
  editable,
  onChange,
  onEdit,
  onRemove,
  onGestureStart,
  onGestureEnd,
  style,
  children,
}: EditableOfferBlockProps) {
  const gesture = useRef<OfferGesture | null>(null);
  const value = placement || { x: 0, y: 0, scale: 1 };
  function start(
    event: React.PointerEvent<HTMLElement>,
    kind: OfferGesture["kind"],
  ) {
    if (!editable) return;
    const canvasElement = event.currentTarget.closest(".social-canvas");
    const offerElement = event.currentTarget.closest(
      ".social-editable-offer-block",
    );
    if (!canvasElement || !offerElement) return;
    const canvas = canvasElement.getBoundingClientRect();
    const rect = offerElement.getBoundingClientRect();
    if (!canvas.width || !canvas.height || !rect.width || !rect.height) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const correction =
      offerElement instanceof HTMLElement &&
      offerElement.classList.contains("social-product-copy")
        ? materializeProductNameAlignment(offerElement, canvas.width, 1)
        : { x: 0, y: 0 };
    const x = (value.x || 0) + correction.x;
    const y = (value.y || 0) + correction.y;
    if (correction.x || correction.y)
      onChange?.({ x, y, scale: value.scale || 1 });
    gesture.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      canvas,
      rect,
      x,
      y,
      scale: value.scale || 1,
    };
    onGestureStart?.();
  }
  function move(event: { clientX: number; clientY: number }) {
    const action = gesture.current;
    if (!action) return;
    const dxPixels = event.clientX - action.startX;
    const dyPixels = event.clientY - action.startY;
    if (action.kind === "resize") {
      const centerX = action.rect.left + action.rect.width / 2;
      const centerY = action.rect.top + action.rect.height / 2;
      const baseWidth = action.rect.width / action.scale;
      const baseHeight = action.rect.height / action.scale;
      const maxVisibleScale = Math.min(
        1.8,
        (2 *
          Math.min(
            centerX - action.canvas.left,
            action.canvas.right - centerX,
          )) /
          baseWidth,
        (2 *
          Math.min(
            centerY - action.canvas.top,
            action.canvas.bottom - centerY,
          )) /
          baseHeight,
      );
      onChange?.({
        x: action.x,
        y: action.y,
        scale:
          Math.round(
            clamp(
              action.scale + ((dxPixels / action.canvas.width) * 100) / 18,
              0.55,
              Math.max(0.55, maxVisibleScale),
            ) * 100,
          ) / 100,
      });
      return;
    }
    const dx =
      (clamp(
        dxPixels,
        action.canvas.left - action.rect.left,
        action.canvas.right - action.rect.right,
      ) /
        action.canvas.width) *
      100;
    const dy =
      (clamp(
        dyPixels,
        action.canvas.top - action.rect.top,
        action.canvas.bottom - action.rect.bottom,
      ) /
        action.canvas.width) *
      100;
    onChange?.({ x: action.x + dx, y: action.y + dy, scale: action.scale });
  }
  function end() {
    if (gesture.current) {
      gesture.current = null;
      onGestureEnd?.();
    }
  }
  return (
    <div
      className={`${className} ${editable ? "social-editable-offer-block" : ""}`}
      style={{
        ...style,
        transform: `translate(${value.x || 0}cqw, ${value.y || 0}cqw) scale(${value.scale || 1})`,
        transformOrigin: "center",
      }}
      title={editable ? `Double-click to edit ${name}` : undefined}
      onDoubleClick={
        editable
          ? (event) => {
              event.stopPropagation();
              onEdit?.();
            }
          : undefined
      }
    >
      {children}
      {editable && (
        <div className="social-offer-block-tools" data-export-hide="true">
          {onEdit && onRemove && (
            <button
              type="button"
              aria-label={`${t("Change")} ${name}`}
              title={`${t("Change")} ${name}`}
              onClick={onEdit}
            >
              ✎
            </button>
          )}
          <button
            type="button"
            title={`${t("Move")} ${name}`}
            aria-label={`${t("Move")} ${name}`}
            onPointerDown={(event) => start(event, "move")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            ✥
          </button>
          <button
            type="button"
            title={`${t("Resize")} ${name}`}
            aria-label={`${t("Resize")} ${name}`}
            onPointerDown={(event) => start(event, "resize")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            ↘
          </button>
          {onRemove && (
            <button
              type="button"
              className="social-offer-remove"
              aria-label={`${t("Remove")} ${name}`}
              title={`${t("Remove")} ${name}`}
              onClick={onRemove}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SocialProductVisual({
  product,
  image,
  showImage = true,
  showInches,
  adjustImage = false,
  onPlaceImage,
  onChangeProduct,
  details,
  onGestureStart,
  onGestureEnd,
}: SocialProductVisualProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const gesture = useRef<ProductVisualGesture | null>(null);
  const [imageReady, setImageReady] = useState(0);
  const [overlay, setOverlay] = useState<CSSProperties | null>(null);
  const [marker, setMarker] = useState<CSSProperties | null>(null);
  const [adjustHandle, setAdjustHandle] = useState<CSSProperties | null>(null);
  const [detailsPosition, setDetailsPosition] = useState<CSSProperties | null>(
    null,
  );
  const tvInches = tvScreenInches(product);
  const otherInches = otherScreenInches(product);
  const defaultScale = defaultProductImageScale(product);
  const [fittedPhoto, setFittedPhoto] = useState<{
    image?: string;
    defaultScale: number;
    placement: Placement;
  } | null>(null);
  const placement =
    product.postImagePlacement ||
    (fittedPhoto?.image === image && fittedPhoto?.defaultScale === defaultScale
      ? fittedPhoto.placement
      : { x: 0, y: 0, scale: defaultScale });
  useLayoutEffect(() => {
    const photo = imageRef.current;
    if (!photo || !tvInches || product.postImagePlacement) return;
    const update = () => {
      if (!photo.complete || !photo.naturalWidth || !photo.naturalHeight)
        return;
      const style = getComputedStyle(photo);
      const width = parseFloat(style.width);
      const height = parseFloat(style.height);
      const fit = productImageFit({
        naturalWidth: photo.naturalWidth,
        naturalHeight: photo.naturalHeight,
        imageBoxWidth: width,
        imageBoxHeight: height,
        wrapWidth: width,
        wrapHeight: height,
        bounds: visibleImageBounds(photo),
        base: { x: 50, y: 50, scale: defaultScale },
      });
      const next = { x: fit.x - 50, y: fit.y - 50, scale: fit.scale };
      setFittedPhoto((current) =>
        current !== null &&
        current.image === image &&
        current.defaultScale === defaultScale &&
        JSON.stringify(current.placement) === JSON.stringify(next)
          ? current
          : { image, defaultScale, placement: next },
      );
    };
    update();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(photo);
    return () => observer?.disconnect();
  }, [image, imageReady, tvInches, defaultScale, product.postImagePlacement]);
  function start(
    event: React.PointerEvent<HTMLElement>,
    kind: ProductVisualGesture["kind"],
  ) {
    if (!adjustImage || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const scale = placement.scale || 1;
    gesture.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      baseWidth: rect.width / scale,
      baseHeight: rect.height / scale,
      x: placement.x || 0,
      y: placement.y || 0,
      scale,
    };
    onGestureStart?.();
  }
  function move(event: React.PointerEvent<HTMLElement>) {
    const action = gesture.current;
    if (!action) return;
    const dx = event.clientX - action.startX;
    const dy = event.clientY - action.startY;
    onPlaceImage?.(
      action.kind === "resize"
        ? {
            x: action.x,
            y: action.y,
            scale:
              Math.round(
                clamp(action.scale + dx / action.baseWidth, 0.45, 2.4) * 100,
              ) / 100,
          }
        : {
            x: clamp(action.x + (dx / action.baseWidth) * 100, -100, 100),
            y: clamp(action.y + (dy / action.baseHeight) * 100, -100, 100),
            scale: action.scale,
          },
    );
  }
  function end() {
    if (gesture.current) {
      gesture.current = null;
      onGestureEnd?.();
    }
  }
  useLayoutEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    const update = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const parentElement = img.closest(".social-product");
      const canvasElement = img.closest(".social-canvas");
      if (!parentElement || !canvasElement) return;
      const parent = parentElement.getBoundingClientRect();
      const rect = img.getBoundingClientRect();
      const canvas = canvasElement.getBoundingClientRect();
      if (!parent.width || !parent.height) return;
      const scale = Math.min(
        rect.width / img.naturalWidth,
        rect.height / img.naturalHeight,
      );
      const contentWidth = img.naturalWidth * scale;
      const contentHeight = img.naturalHeight * scale;
      const left = rect.left - parent.left + (rect.width - contentWidth) / 2;
      const top = rect.top - parent.top + (rect.height - contentHeight) / 2;
      if (details) {
        const visible = visibleImageBounds(img);
        const visibleLeft = left + (visible?.left || 0) * contentWidth;
        const visibleTop = top + (visible?.top || 0) * contentHeight;
        const visibleBottom = top + (visible?.bottom || 1) * contentHeight;
        const gap = contentWidth * 0.025;
        const available = parent.left + visibleLeft - canvas.left - gap;
        const detailWidth = Math.min(
          parent.width * 0.28,
          Math.max(parent.width * 0.1, available - canvas.width * 0.02),
        );
        setDetailsPosition({
          left: `${((visibleLeft - gap) / parent.width) * 100}%`,
          top: `${((visibleTop + visibleBottom) / 2 / parent.height) * 100}%`,
          width: `${(detailWidth / parent.width) * 100}%`,
        });
      } else setDetailsPosition(null);
      setAdjustHandle({
        left: `${((left + contentWidth) / parent.width) * 100}%`,
        top: `${((top + contentHeight) / parent.height) * 100}%`,
      });
      const box = product.screenArtwork?.image
        ? televisionScreenBox(product, img)
        : null;
      setOverlay(
        box && product.screenArtwork?.image
          ? {
              left: `${((left + box.x * contentWidth) / parent.width) * 100}%`,
              top: `${((top + box.y * contentHeight) / parent.height) * 100}%`,
              width: `${((box.width * contentWidth) / parent.width) * 100}%`,
              height: `${((box.height * contentHeight) / parent.height) * 100}%`,
            }
          : null,
      );
      if (tvInches) {
        const screen = televisionScreenBox(product, img);
        const tagWidth = screen.width * contentWidth * 0.33;
        setMarker({
          left: `${((left + (screen.x + screen.width) * contentWidth - tagWidth) / parent.width) * 100}%`,
          top: `${((top + screen.y * contentHeight) / parent.height) * 100}%`,
          width: `${(tagWidth / parent.width) * 100}%`,
        });
      } else if (otherInches) {
        const visible = visibleImageBounds(img);
        const guide = otherScreenAnnotationBaseBox({
          left: left + (visible?.left || 0) * contentWidth,
          top: top + (visible?.top || 0) * contentHeight,
          width: contentWidth * (visible ? visible.right - visible.left : 1),
          height: contentHeight * (visible ? visible.bottom - visible.top : 1),
        });
        setMarker({
          left: `${(guide.left / parent.width) * 100}%`,
          top: `${(guide.top / parent.height) * 100}%`,
          width: `${(guide.width / parent.width) * 100}%`,
          height: `${(guide.height / parent.height) * 100}%`,
        });
      } else setMarker(null);
    };
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(img);
    const productElement = img.closest(".social-product");
    if (productElement) observer?.observe(productElement);
    const canvasElement = img.closest(".social-canvas");
    canvasElement?.addEventListener(APPLE_PHOTO_CLEARANCE_EVENT, update);
    if (img.complete) update();
    return () => {
      observer?.disconnect();
      canvasElement?.removeEventListener(APPLE_PHOTO_CLEARANCE_EVENT, update);
    };
  }, [
    image,
    product.screenArtwork,
    product.postImagePlacement,
    fittedPhoto,
    product.detailPlacement,
    Boolean(details),
    tvInches,
    otherInches,
    imageReady,
  ]);
  return (
    <>
      {image && !isBundleOffer(product) && (
        <img
          className={`social-product-main-image ${adjustImage ? "social-adjusting-image" : ""}`}
          ref={imageRef}
          data-social-apple-photo={hasApplePhotos(product) ? "true" : undefined}
          src={image}
          alt={product.name}
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={() => setImageReady((count) => count + 1)}
          style={{
            visibility: showImage ? undefined : "hidden",
            transform: `translate(${placement.x || 0}%, ${placement.y || 0}%) scale(${placement.scale || 1})`,
          }}
          onPointerDown={
            adjustImage && showImage
              ? (event) => start(event, "move")
              : undefined
          }
          onPointerMove={
            adjustImage
              ? (event) => {
                  event.stopPropagation();
                  move(event);
                }
              : undefined
          }
          onPointerUp={
            adjustImage
              ? (event) => {
                  event.stopPropagation();
                  end();
                }
              : undefined
          }
          onPointerCancel={adjustImage ? end : undefined}
        />
      )}
      {adjustImage && showImage && adjustHandle && (
        <button
          type="button"
          className="social-photo-adjust-handle"
          data-export-hide="true"
          aria-label="Resize photo within product area"
          title="Resize photo within product area"
          style={adjustHandle}
          onPointerDown={(event) => start(event, "resize")}
          onPointerMove={(event) => {
            event.stopPropagation();
            move(event);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            end();
          }}
          onPointerCancel={end}
        >
          ↘
        </button>
      )}
      {showImage && overlay && (
        <img
          className="social-product-screen-image"
          src={product.screenArtwork?.image}
          alt=""
          aria-hidden="true"
          style={{
            ...overlay,
            objectFit: product.screenArtwork?.fit || "cover",
            background: "#000",
          }}
        />
      )}
      {showImage &&
        showInches &&
        marker &&
        (tvInches || otherInches) &&
        (!tvInches ||
          product.screenArtwork?.image ||
          !tvInchesEmbedded(product)) && (
          <EditableScreenAnnotation
            product={product}
            onChange={onChangeProduct}
            inches={tvInches || otherInches}
            type={tvInches ? "television" : "other"}
            className="social-screen-size-label"
            style={marker}
          />
        )}
      {details && (
        <div
          className="social-image-side-details"
          style={{
            position: "absolute",
            zIndex: 4,
            ...(detailsPosition || { left: "20%", top: "50%", width: "28%" }),
            transform: "translate(-100%, -50%)",
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {details}
        </div>
      )}
      {(showImage || !isBundleOffer(product)) && (
        <ProductArtworkLayer
          product={product}
          imageRef={imageRef}
          onChange={onChangeProduct}
          editable={Boolean(onChangeProduct)}
        />
      )}
    </>
  );
}

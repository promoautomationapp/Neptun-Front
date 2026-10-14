import type { Artwork, Box, Campaign, Product } from "../../domain/models";
import React, { useLayoutEffect, useRef, useState } from "react";
import { effectiveProductArtworks } from "./productArtwork";
import {
  normalizeScreenPhotoSource,
  screenPhotoSource,
  televisionScreenBox,
  visibleImageBounds,
} from "./screenGeometry";
import { isTelevision, otherScreenInches, tvScreenInches } from "./tvSpecs";
import { tvInchesEmbedded } from "./imageReview";
import { EditableScreenAnnotation } from "./EditableScreenAnnotation";
import {
  phoneAnnotationBaseBox,
  televisionAnnotationBaseBox,
  usesPhoneCornerAnnotation,
  type ScreenAnnotationPlacement,
  type ScreenAnnotationType,
} from "./screenAnnotationGeometry";
import { bundleMemberByCode, updateBundleMember } from "./bundleMemberUpdates";
import { t } from "./i18n";
import { isApplePhotoArtwork } from "./productTypes";
import "../../styles/product-artwork-layer.css";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));
const number = (value: unknown, fallback: number) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

function positionOffset(value: string | undefined, available: number) {
  if (value === "left" || value === "top") return 0;
  if (value === "right" || value === "bottom") return available;
  if (value?.endsWith("%"))
    return (available * number(parseFloat(value), 50)) / 100;
  return available / 2;
}

// Returned percentages use the overlay's coordinates, including CSS preview scale.
export function productArtworkImageBox(
  image: HTMLImageElement | null | undefined,
  layer: HTMLElement | null | undefined,
): Box | null {
  if (!image?.naturalWidth || !image?.naturalHeight || !layer) return null;
  const parent = layer.getBoundingClientRect();
  const rect = image.getBoundingClientRect();
  if (!parent.width || !parent.height || !rect.width || !rect.height)
    return null;
  const style =
    typeof getComputedStyle === "function" ? getComputedStyle(image) : null;
  const contained =
    !style ||
    !style.objectFit ||
    ["contain", "scale-down"].includes(style.objectFit);
  let width = contained
    ? Math.min(
        rect.width,
        (rect.height * image.naturalWidth) / image.naturalHeight,
      )
    : rect.width;
  let height = contained
    ? Math.min(
        rect.height,
        (rect.width * image.naturalHeight) / image.naturalWidth,
      )
    : rect.height;
  if (style?.objectFit === "scale-down") {
    const scale = rect.width / (image.clientWidth || rect.width);
    const shrink = Math.min(
      1,
      (image.naturalWidth * scale) / width,
      (image.naturalHeight * scale) / height,
    );
    width *= shrink;
    height *= shrink;
  }
  const position = (style?.objectPosition || "50% 50%").trim().split(/\s+/);
  const left =
    rect.left - parent.left + positionOffset(position[0], rect.width - width);
  const top =
    rect.top -
    parent.top +
    positionOffset(position[1] || "50%", rect.height - height);
  return {
    x: (left / parent.width) * 100,
    y: (top / parent.height) * 100,
    width: (width / parent.width) * 100,
    height: (height / parent.height) * 100,
  };
}

export function productArtworkPhotoBox(
  image: HTMLImageElement | null | undefined,
  layer: HTMLElement | null | undefined,
): Box | null {
  const box = productArtworkImageBox(image, layer);
  if (!box) return null;
  const visible = visibleImageBounds(image);
  if (visible) {
    return {
      x: box.x + visible.left * box.width,
      y: box.y + visible.top * box.height,
      width: box.width * (visible.right - visible.left),
      height: box.height * (visible.bottom - visible.top),
    };
  }
  return box;
}

export function bundleArtworkMember(product: Product, artwork: Artwork) {
  if (artwork.type !== "bundle-product" || artwork.memberCode == null)
    return null;
  return bundleMemberByCode(product, artwork.memberCode);
}

// Screen boxes use the complete source image, not its cropped visible bounds.
// Percentages relative to the member container stay attached while it moves.
export function bundleScreenArtworkPlacement(
  member: Product | null,
  image: HTMLImageElement | null,
  container: HTMLElement | null | undefined,
): Box | null {
  if (!member || !isTelevision(member) || !member.screenArtwork?.image)
    return null;
  const photo = productArtworkImageBox(image, container);
  if (!photo) return null;
  const screen = televisionScreenBox(member, image);
  if (
    ![screen.x, screen.y, screen.width, screen.height].every(Number.isFinite) ||
    screen.width <= 0 ||
    screen.height <= 0
  )
    return null;
  return {
    x: photo.x + screen.x * photo.width,
    y: photo.y + screen.y * photo.height,
    width: screen.width * photo.width,
    height: screen.height * photo.height,
  };
}

export interface BundleScreenAnnotation {
  inches: number;
  type: ScreenAnnotationType;
  style: React.CSSProperties;
}

export function bundleScreenAnnotationPlacement(
  member: Product | null,
  image: HTMLImageElement | null,
  container: HTMLElement | null | undefined,
): BundleScreenAnnotation | null {
  if (!member || !image || !container) return null;
  const television = tvScreenInches(member);
  const inches = television || otherScreenInches(member);
  const embeddedInRenderedPhoto =
    tvInchesEmbedded(member) &&
    normalizeScreenPhotoSource(screenPhotoSource(member, image)) ===
      normalizeScreenPhotoSource(
        member.image || member.localImage || member.imageUrl,
      );
  if (
    !inches ||
    (television && embeddedInRenderedPhoto && !member.screenArtwork?.image)
  )
    return null;
  const photo = productArtworkImageBox(image, container);
  if (!photo) return null;
  const rect = container.getBoundingClientRect();
  const visualScale = rect.width / (container.offsetWidth || rect.width) || 1;
  const width = rect.width / visualScale;
  const height = rect.height / visualScale;
  const photoBox = {
    left: (photo.x * width) / 100,
    top: (photo.y * height) / 100,
    width: (photo.width * width) / 100,
    height: (photo.height * height) / 100,
  };
  if (television) {
    const screen = televisionScreenBox(member, image);
    return {
      inches,
      type: "television",
      style: { ...televisionAnnotationBaseBox({
        left: photoBox.left + screen.x * photoBox.width,
        top: photoBox.top + screen.y * photoBox.height,
        width: screen.width * photoBox.width,
        height: screen.height * photoBox.height,
      }) },
    };
  }
  const visible = visibleImageBounds(image);
  const visiblePhoto = {
    left: photoBox.left + (visible?.left || 0) * photoBox.width,
    top: photoBox.top + (visible?.top || 0) * photoBox.height,
    width: photoBox.width * (visible ? visible.right - visible.left : 1),
    height: photoBox.height * (visible ? visible.bottom - visible.top : 1),
  };
  if (usesPhoneCornerAnnotation(member))
    return {
      inches,
      type: "phone",
      style: { ...phoneAnnotationBaseBox(visiblePhoto) },
    };
  const pageWidth =
    container.closest(".brochure-page,.social-canvas")?.getBoundingClientRect()
      .width || rect.width;
  return {
    inches,
    type: "other",
    style: {
      top: Math.max(1, visiblePhoto.top - (pageWidth / visualScale) * 0.044),
      right: Math.max(1, width - visiblePhoto.left - visiblePhoto.width),
    },
  };
}

interface ArtworkPhotoProps {
  artwork: Artwork;
  member: Product | null;
  label: string;
  onPointerDown?: React.PointerEventHandler<HTMLImageElement>;
  onMemberChange?: (
    field: "screenAnnotationPlacement",
    value: ScreenAnnotationPlacement,
  ) => void;
}

function ArtworkPhoto({
  artwork,
  member,
  label,
  onPointerDown,
  onMemberChange,
}: ArtworkPhotoProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [screen, setScreen] = useState<Box | null>(null);
  const [annotation, setAnnotation] = useState<BundleScreenAnnotation | null>(
    null,
  );
  useLayoutEffect(() => {
    if (!member) {
      setScreen(null);
      setAnnotation(null);
      return;
    }
    const image = imageRef.current;
    const container = image?.parentElement;
    const card = container?.closest(".brochure-product");
    const update = () => {
      const next = bundleScreenArtworkPlacement(member, image, container);
      setScreen((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
      const nextAnnotation = bundleScreenAnnotationPlacement(
        member,
        image,
        container,
      );
      setAnnotation((current) =>
        JSON.stringify(current) === JSON.stringify(nextAnnotation)
          ? current
          : nextAnnotation,
      );
    };
    update();
    card?.addEventListener("brochure-photo-clearance", update);
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    if (container) observer?.observe(container);
    if (image) {
      observer?.observe(image);
      image.addEventListener("load", update);
      image.addEventListener("error", update);
    }
    const mutations =
      typeof MutationObserver === "function"
        ? new MutationObserver(update)
        : null;
    if (image)
      mutations?.observe(image, {
        attributes: true,
        attributeFilter: ["style", "class", "src"],
      });
    if (container)
      mutations?.observe(container, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      image?.removeEventListener("load", update);
      image?.removeEventListener("error", update);
      card?.removeEventListener("brochure-photo-clearance", update);
    };
  }, [member, artwork.image]);
  return (
    <>
      <img
        ref={imageRef}
        src={artwork.image}
        alt={label}
        draggable={false}
        referrerPolicy="no-referrer"
        onPointerDown={onPointerDown}
      />
      {screen && member?.screenArtwork?.image && (
        <img
          className="bundle-screen-artwork"
          src={member.screenArtwork.image}
          alt=""
          aria-hidden="true"
          draggable={false}
          referrerPolicy="no-referrer"
          style={{
            left: `${screen.x}%`,
            top: `${screen.y}%`,
            width: `${screen.width}%`,
            height: `${screen.height}%`,
          }}
        />
      )}
      {annotation && member && (
        <EditableScreenAnnotation
          product={member}
          inches={annotation.inches}
          type={annotation.type}
          className="bundle-inch-label"
          style={annotation.style}
          onChange={onMemberChange}
        />
      )}
    </>
  );
}

interface ArtworkPosition {
  x: number;
  y: number;
  width: number;
  height?: number;
}

export function productArtworkPlacement(
  artwork: Artwork,
  photoBox: Box | null,
  photoArea: Box | null,
): ArtworkPosition | null {
  const values: ArtworkPosition = {
    x: number(artwork.x, 50),
    y: number(artwork.y, 50),
    width: Math.max(0.1, number(artwork.width, 20)),
  };
  if (artwork.height != null)
    values.height = Math.max(0.1, number(artwork.height, 50));
  if (!["image", "photo-area"].includes(artwork.relativeTo || ""))
    return values;
  const box = artwork.relativeTo === "photo-area" ? photoArea : photoBox;
  if (!box) return null;
  return {
    x: box.x + (box.width * values.x) / 100,
    y: box.y + (box.height * values.y) / 100,
    width: (box.width * values.width) / 100,
    ...(values.height != null
      ? { height: (box.height * values.height) / 100 }
      : {}),
  };
}

function artworkIndex(items: Artwork[], artwork: Artwork, fallback: number) {
  return artwork.id == null
    ? fallback
    : items.findIndex((item) => item.id === artwork.id);
}

interface ProductArtworkLayerProps {
  product: Product;
  imageRef?: React.RefObject<HTMLImageElement | null>;
  photoAreaRef?: React.RefObject<HTMLDivElement | null>;
  onChange?: (field: keyof Product, value: Product[keyof Product]) => void;
  editable?: boolean;
  campaign?: Partial<Campaign>;
}
interface ArtworkGesture {
  artwork: Artwork;
  index: number;
  key: string | number;
  kind: "move" | "resize";
  parent: DOMRect;
  original: ArtworkPosition;
  pointerId: number;
  x: number;
  y: number;
  aspect: number;
  next: Artwork | null;
}
export function ProductArtworkLayer({
  product,
  imageRef,
  photoAreaRef,
  onChange,
  editable = true,
  campaign = {},
}: ProductArtworkLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<ArtworkGesture | null>(null);
  const artworks = effectiveProductArtworks(product, campaign);
  const latest = useRef(artworks);
  latest.current = artworks;
  const [photoBox, setPhotoBox] = useState<Box | null>(null);
  const [photoArea, setPhotoArea] = useState<Box | null>(null);
  const [draft, setDraft] = useState<{
    key: string | number;
    value: Artwork;
  } | null>(null);
  const [selected, setSelected] = useState<string | number | null>(null);
  const canEdit = editable && typeof onChange === "function";

  useLayoutEffect(() => {
    const image = imageRef?.current;
    const layer = layerRef.current;
    const area = photoAreaRef?.current || layer?.parentElement;
    const update = () => {
      const next = productArtworkPhotoBox(image, layer);
      setPhotoBox((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
      const parent = layer?.getBoundingClientRect();
      const rect = area?.getBoundingClientRect();
      const bounds =
        parent?.width && parent.height && rect
          ? {
              x: ((rect.left - parent.left) / parent.width) * 100,
              y: ((rect.top - parent.top) / parent.height) * 100,
              width: (rect.width / parent.width) * 100,
              height: (rect.height / parent.height) * 100,
            }
          : null;
      setPhotoArea((current) =>
        JSON.stringify(current) === JSON.stringify(bounds) ? current : bounds,
      );
    };
    update();
    area?.addEventListener("brochure-photo-clearance", update);
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    if (layer) observer?.observe(layer);
    if (area) observer?.observe(area);
    if (image) {
      observer?.observe(image);
      image.addEventListener("load", update);
      image.addEventListener("error", update);
    }
    // Moving/scaling the photo changes its transform without changing its layout size.
    const mutations =
      typeof MutationObserver === "function"
        ? new MutationObserver(update)
        : null;
    if (image)
      mutations?.observe(image, {
        attributes: true,
        attributeFilter: ["style", "class", "src"],
      });
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      image?.removeEventListener("load", update);
      image?.removeEventListener("error", update);
      area?.removeEventListener("brochure-photo-clearance", update);
    };
  }, [
    imageRef,
    photoAreaRef,
    product.image,
    product.brochureImagePlacement,
    product.postImagePlacement,
    product.brochureCardSize,
  ]);

  function start(
    event: React.PointerEvent<HTMLElement>,
    artwork: Artwork,
    index: number,
    kind: ArtworkGesture["kind"],
  ) {
    if (!canEdit || event.button !== 0) return;
    const original = productArtworkPlacement(artwork, photoBox, photoArea);
    const parent = layerRef.current?.getBoundingClientRect();
    const item = event.currentTarget
      .closest(".product-artwork-item")
      ?.getBoundingClientRect();
    if (!original || !parent?.width || !parent.height || !item?.width) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const key = artwork.id ?? index;
    setSelected(key);
    layerRef.current?.closest(".cs-page-preview")?.classList.add("dragging-guides");
    gesture.current = {
      artwork,
      index,
      key,
      kind,
      parent,
      original,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      aspect: item.height / item.width,
      next: null,
    };
  }

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const action = gesture.current;
    if (!action || event.pointerId !== action.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - action.x,
      dy = event.clientY - action.y;
    if (!action.next && Math.hypot(dx, dy) < 2) return;
    const { original, parent, aspect } = action;
    let next: ArtworkPosition;
    if (action.kind === "move") {
      const height = (original.width * parent.width * aspect) / parent.height;
      next = {
        ...original,
        x: clamp(
          original.x + (dx / parent.width) * 100,
          0,
          Math.max(0, 100 - original.width),
        ),
        y: clamp(
          original.y + (dy / parent.height) * 100,
          0,
          Math.max(0, 100 - height),
        ),
      };
    } else {
      const delta = (dx + aspect * dy) / (1 + aspect * aspect);
      const maximum = Math.max(
        0.1,
        Math.min(
          100 - original.x,
          ((100 - original.y) * parent.height) /
            parent.width /
            Math.max(aspect, 0.001),
        ),
      );
      const width = clamp(
        original.width + (delta / parent.width) * 100,
        Math.min(1, maximum),
        maximum,
      );
      next = {
        ...original,
        width,
        ...(original.height != null
          ? { height: (original.height * width) / original.width }
          : {}),
      };
    }
    action.next = { ...action.artwork, ...next, relativeTo: "product" };
    setDraft({ key: action.key, value: action.next });
  }

  function end(event: React.PointerEvent<HTMLDivElement>, cancelled = false) {
    const action = gesture.current;
    if (!action || event.pointerId !== action.pointerId) return;
    event.stopPropagation();
    gesture.current = null;
    layerRef.current?.closest(".cs-page-preview")?.classList.remove("dragging-guides");
    setDraft(null);
    if (!cancelled && action.next) {
      const next = action.next;
      const index = artworkIndex(latest.current, action.artwork, action.index);
      if (index >= 0)
        onChange?.(
          "productArtworks",
          latest.current.map((item, i) =>
            i === index
              ? {
                  ...item,
                  x: next.x,
                  y: next.y,
                  width: next.width,
                  ...(next.height != null ? { height: next.height } : {}),
                  relativeTo: "product",
                }
              : item,
          ),
        );
    }
  }

  function remove(
    event: React.MouseEvent<HTMLButtonElement>,
    artwork: Artwork,
    fallback: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const index = artworkIndex(latest.current, artwork, fallback);
    if (index < 0 || !canEdit) return;
    gesture.current = null;
    setDraft(null);
    setSelected(null);
    onChange?.(
      "productArtworks",
      latest.current.filter((_, i) => i !== index),
    );
  }

  return (
    <div
      ref={layerRef}
      className={`product-artwork-layer${canEdit ? " editable" : ""}`}
    >
      {artworks.map((artwork, index) => {
        const key = artwork.id ?? index;
        const position = productArtworkPlacement(
          draft?.key === key ? draft.value : artwork,
          photoBox,
          photoArea,
        );
        if (!artwork.image || !position) return null;
        const label = artwork.label || t("Additional image");
        const member = bundleArtworkMember(product, artwork);
        return (
          <div
            key={key}
            className={`product-artwork-item${artwork.type === "bundle-product" ? " bundle-product-image" : ""}${selected === key ? " selected" : ""}`}
            data-monochrome-badge={
              artwork.type === "wifi" &&
              artwork.image?.includes("/product-badges/wifi.svg")
                ? "true"
                : undefined
            }
            data-apple-photo-clearance={
              isApplePhotoArtwork(product, artwork.type, member)
                ? "true"
                : undefined
            }
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              width: `${position.width}%`,
              zIndex: artwork.zIndex ?? 14,
              ...(position.height != null
                ? { height: `${position.height}%` }
                : {}),
            }}
            onPointerMove={canEdit ? move : undefined}
            onPointerUp={canEdit ? end : undefined}
            onPointerCancel={canEdit ? (event) => end(event, true) : undefined}
            onLostPointerCapture={
              canEdit ? (event) => end(event, true) : undefined
            }
          >
            <ArtworkPhoto
              artwork={artwork}
              member={member}
              label={label}
              onMemberChange={
                canEdit && member
                  ? (field, value) =>
                      onChange?.(
                        "bundleProducts",
                        updateBundleMember(product, member.code, {
                          [field]: value,
                        }),
                      )
                  : undefined
              }
              onPointerDown={
                canEdit
                  ? (event) => start(event, artwork, index, "move")
                  : undefined
              }
            />
            {canEdit && (
              <div className="product-artwork-chrome" data-export-hide="true">
                <button
                  type="button"
                  className="product-artwork-resize"
                  aria-label={`${t("Resize artwork")}: ${label}`}
                  title={t("Drag to resize artwork")}
                  onPointerDown={(event) =>
                    start(event, artwork, index, "resize")
                  }
                >
                  ↘
                </button>
                <button
                  type="button"
                  className="product-artwork-remove"
                  aria-label={`${t("Remove artwork")}: ${label}`}
                  title={t("Remove artwork")}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => remove(event, artwork, index)}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

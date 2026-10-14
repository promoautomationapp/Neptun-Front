import React, { useEffect, useRef, useState } from "react";
import type { Artwork, Campaign } from "../../domain/models";
import "../../styles/page-layers.css";
import { t } from "./i18n";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export interface PageArtworkLayer extends Artwork {
  color?: string;
  fade?: string;
  shadow?: boolean;
  shadowColor?: string;
  fontSize?: number;
  text?: string;
  name?: string;
}
export interface PageArtworkProps {
  campaign: Pick<Campaign, "pageArtworks">;
  pageKey: string | number;
  onChange?: (id: string, artwork: PageArtworkLayer) => void;
  onRemove?: (id: string) => void;
}
interface ArtworkGesture {
  kind: "move" | "resize";
  x: number;
  y: number;
  page: DOMRect;
  original: PageArtworkLayer;
  next: PageArtworkLayer;
}

export function PageArtwork({
  campaign,
  pageKey,
  onChange,
  onRemove,
}: PageArtworkProps) {
  const artworks = campaign.pageArtworks?.[pageKey] || [];
  return (
    <div
      className={`brochure-floating-artworks ${onChange ? "editable" : ""}`}
      aria-label={t("Page artwork")}
    >
      {artworks.map((artwork) => (
        <ArtworkItem
          key={artwork.id}
          artwork={artwork}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function ArtworkItem({
  artwork,
  onChange,
  onRemove,
}: {
  artwork: PageArtworkLayer;
  onChange?: PageArtworkProps["onChange"];
  onRemove?: PageArtworkProps["onRemove"];
}) {
  const [position, setPosition] = useState(artwork);
  const gesture = useRef<ArtworkGesture | null>(null);
  useEffect(() => setPosition(artwork), [artwork]);
  function start(
    event:
      | React.PointerEvent<HTMLDivElement>
      | React.PointerEvent<HTMLButtonElement>,
    kind: "move" | "resize",
  ) {
    if (!onChange) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pageElement = event.currentTarget.closest(".brochure-page");
    if (!pageElement) return;
    const page = pageElement.getBoundingClientRect();
    event.currentTarget.closest(".cs-page-preview")?.classList.add("dragging-guides");
    gesture.current = {
      kind,
      x: event.clientX,
      y: event.clientY,
      page,
      original: position,
      next: position,
    };
  }
  function move(event: { clientX: number; clientY: number }) {
    const action = gesture.current;
    if (!action) return;
    const dx = ((event.clientX - action.x) / action.page.width) * 100;
    const dy = ((event.clientY - action.y) / action.page.height) * 100;
    action.next =
      action.kind === "move"
        ? {
            ...action.original,
            x: clamp(action.original.x + dx, 0, 95),
            y: clamp(action.original.y + dy, 0, 95),
          }
        : {
            ...action.original,
            width: clamp(action.original.width + dx, 3, 100),
            ...(artwork.type === "overlay" || action.original.height != null
              ? { height: clamp((action.original.height || 35) + dy, 2, 100) }
              : {}),
          };
    setPosition(action.next);
  }
  function end() {
    if (!gesture.current) return;
    const next = gesture.current.next;
    gesture.current = null;
    document.querySelectorAll(".cs-page-preview.dragging-guides").forEach((preview) => preview.classList.remove("dragging-guides"));
    onChange?.(artwork.id, next);
  }
  function cancel(event?: React.PointerEvent) {
    event?.stopPropagation();
    if (gesture.current) setPosition(gesture.current.original);
    gesture.current = null;
    document.querySelectorAll(".cs-page-preview.dragging-guides").forEach((preview) => preview.classList.remove("dragging-guides"));
  }
  const color = position.color || "#1c4075";
  const fill =
    position.fade === "top"
      ? `linear-gradient(to bottom, ${color}, transparent)`
      : position.fade === "bottom"
        ? `linear-gradient(to top, ${color}, transparent)`
        : position.fade === "edges"
          ? `radial-gradient(ellipse, transparent 25%, ${color} 100%)`
          : color;
  return (
    <div
      className="brochure-floating-artwork"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${position.width}%`,
        ...(artwork.type === "overlay" || position.height != null
          ? { height: `${position.height || 35}%` }
          : {}),
        zIndex: position.zIndex ?? 2,
        opacity: position.opacity ?? 1,
        transform: `rotate(${position.rotation || 0}deg)`,
        ...(position.shadow
          ? {
              filter: `drop-shadow(0 1cqw 1.5cqw ${position.shadowColor || "#1c4075"})`,
            }
          : {}),
      }}
      onPointerDown={onChange ? (event) => start(event, "move") : undefined}
      onPointerMove={onChange ? move : undefined}
      onPointerUp={onChange ? end : undefined}
      onPointerCancel={onChange ? cancel : undefined}
      onLostPointerCapture={onChange ? cancel : undefined}
    >
      {artwork.type === "text" ? (
        <p
          className="page-layer-text"
          style={{ color, fontSize: `${position.fontSize || 4}cqw` }}
        >
          {position.text}
        </p>
      ) : artwork.type === "overlay" ? (
        <div className="page-layer-overlay" style={{ background: fill }} />
      ) : (
        <img
          src={artwork.image}
          style={
            position.height != null
              ? {
                  width: "100%",
                  height: "100%",
                  objectFit: position.imageFit || "cover",
                }
              : undefined
          }
          alt={artwork.name || "Page artwork"}
          draggable={false}
        />
      )}
      {onChange && (
        <div data-export-hide="true">
          <button
            type="button"
            className="artwork-resize"
            aria-label={t("Resize artwork")}
            title={t("Drag to resize artwork")}
            onPointerDown={(event) => start(event, "resize")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={cancel}
            onLostPointerCapture={cancel}
          >
            ↘
          </button>
          <button
            type="button"
            className="artwork-remove"
            aria-label={t("Remove artwork")}
            title={t("Remove artwork")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove?.(artwork.id);
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

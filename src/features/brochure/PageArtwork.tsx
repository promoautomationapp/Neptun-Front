import {
  CornerHandles,
  resizeFromCorner,
  type ResizeCorner,
} from "./resizeCorners";
import { readImage } from "./utils";
import React, { useEffect, useRef, useState } from "react";
import type { Artwork, Campaign } from "../../domain/models";
import "../../styles/page-layers.css";
import { t } from "./i18n";
import { EditorIcon } from "./EditorIcon";

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
  corner?: ResizeCorner;
  renderedHeight: number;
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
  const [selectedId, setSelectedId] = useState("");
  const layers = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clear = (event: PointerEvent) => {
      if (!layers.current?.contains(event.target as Node)) setSelectedId("");
    };
    document.addEventListener("pointerdown", clear);
    return () => document.removeEventListener("pointerdown", clear);
  }, []);
  return (
    <div
      ref={layers}
      className={`brochure-floating-artworks ${onChange ? "editable" : ""}`}
      aria-label={t("Page artwork")}
    >
      {artworks.map((artwork) => (
        <ArtworkItem
          key={artwork.id}
          artwork={artwork}
          onChange={onChange}
          onRemove={onRemove}
          selected={selectedId === artwork.id}
          onSelect={() => setSelectedId(artwork.id)}
        />
      ))}
    </div>
  );
}

function ArtworkItem({
  artwork,
  onChange,
  onRemove,
  selected,
  onSelect,
}: {
  artwork: PageArtworkLayer;
  onChange?: PageArtworkProps["onChange"];
  onRemove?: PageArtworkProps["onRemove"];
  selected: boolean;
  onSelect: () => void;
}) {
  const [position, setPosition] = useState(artwork);
  const currentPosition = useRef(artwork);
  const upload = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const isText = artwork.type === "text";
  const isImage = !isText && artwork.type !== "overlay";
  const [error, setError] = useState("");
  async function replace(file?: File) {
    if (!file || !onChange) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      setError(t("Choose an image under 12 MB."));
      return;
    }
    try {
      onChange(artwork.id, { ...position, image: await readImage(file) });
      setError("");
    } catch {
      setError(t("Could not read this image."));
    }
  }
  const gesture = useRef<ArtworkGesture | null>(null);
  useEffect(() => {
    currentPosition.current = artwork;
    setPosition(artwork);
  }, [artwork]);
  function change(changes: Partial<PageArtworkLayer>) {
    const next = { ...currentPosition.current, ...changes };
    currentPosition.current = next;
    setPosition(next);
    onChange?.(artwork.id, next);
  }
  function saveText(element: HTMLElement) {
    const next = element.textContent || "";
    if (next !== (currentPosition.current.text || "")) change({ text: next });
  }
  function start(
    event:
      | React.PointerEvent<HTMLDivElement>
      | React.PointerEvent<HTMLButtonElement>,
    kind: "move" | "resize",
  ) {
    if (!onChange) return;
    onSelect();
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pageElement = event.currentTarget.closest(".brochure-page");
    if (!pageElement) return;
    const page = pageElement.getBoundingClientRect();
    event.currentTarget
      .closest(".cs-page-preview")
      ?.classList.add("dragging-guides");
    gesture.current = {
      kind,
      corner: (event.currentTarget.dataset.resizeCorner ||
        "bottom-right") as ResizeCorner,
      renderedHeight:
        ((event.currentTarget
          .closest(".brochure-floating-artwork")
          ?.getBoundingClientRect().height || page.height * 0.35) /
          page.height) *
        100,
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
        : (() => {
            const next = resizeFromCorner(
              {
                x: action.original.x,
                y: action.original.y,
                width: action.original.width,
                height: action.original.height ?? action.renderedHeight,
              },
              dx,
              dy,
              action.corner,
              {
                minWidth: 3,
                minHeight: 2,
                maxWidth: 100,
                maxHeight: 100,
                lockAspect:
                  isText ||
                  (action.original.height == null &&
                    artwork.type !== "overlay"),
              },
            );
            return {
              ...action.original,
              x: next.x,
              y: next.y,
              width: next.width,
              ...(isText
                ? {
                    fontSize: clamp(
                      ((action.original.fontSize || 4) * next.width) /
                        action.original.width,
                      0.5,
                      30,
                    ),
                  }
                : {}),
              ...(action.original.height != null || artwork.type === "overlay"
                ? { height: next.height }
                : {}),
            };
          })();
    setPosition(action.next);
  }
  function end() {
    if (!gesture.current) return;
    const { next, original } = gesture.current;
    gesture.current = null;
    document
      .querySelectorAll(".cs-page-preview.dragging-guides")
      .forEach((preview) => preview.classList.remove("dragging-guides"));
    if (next !== original) onChange?.(artwork.id, next);
    currentPosition.current = next;
  }
  function cancel(event?: React.PointerEvent) {
    event?.stopPropagation();
    if (gesture.current) {
      currentPosition.current = gesture.current.original;
      setPosition(gesture.current.original);
    }
    gesture.current = null;
    document
      .querySelectorAll(".cs-page-preview.dragging-guides")
      .forEach((preview) => preview.classList.remove("dragging-guides"));
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
      className={`brochure-floating-artwork${isText ? " page-text-artwork" : ""}${selected ? " is-selected" : ""}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${position.width}%`,
        ...(artwork.type === "overlay" || position.height != null
          ? { height: `${position.height || 35}%` }
          : {}),
        zIndex:
          onChange && selected
            ? Math.max(position.zIndex ?? 2, 20)
            : (position.zIndex ?? 2),
        opacity: position.opacity ?? 1,
        transform: `rotate(${position.rotation || 0}deg)`,
        ...(position.shadow
          ? {
              filter: `drop-shadow(0 1cqw 1.5cqw ${position.shadowColor || "#1c4075"})`,
            }
          : {}),
      }}
      onDoubleClick={
        onChange && isImage
          ? (event) => {
              event.stopPropagation();
              upload.current?.click();
            }
          : undefined
      }
      onDragOver={
        onChange && isImage
          ? (event) => {
              if ([...event.dataTransfer.types].includes("Files")) {
                event.preventDefault();
                event.stopPropagation();
              }
            }
          : undefined
      }
      onDrop={
        onChange && isImage
          ? (event) => {
              const file = event.dataTransfer.files[0];
              if (file) {
                event.preventDefault();
                event.stopPropagation();
                void replace(file);
              }
            }
          : undefined
      }
      onPointerDown={
        onChange
          ? (event) => {
              onSelect();
              if (!isText) start(event, "move");
            }
          : undefined
      }
      onPointerMove={onChange ? move : undefined}
      onPointerUp={onChange ? end : undefined}
      onPointerCancel={onChange ? cancel : undefined}
      onLostPointerCapture={onChange ? cancel : undefined}
    >
      {artwork.type === "text" ? (
        <p
          className="page-layer-text"
          ref={text}
          data-text-layer={artwork.id}
          style={{ color, fontSize: `${position.fontSize || 4}cqw` }}
          contentEditable={onChange ? true : undefined}
          suppressContentEditableWarning
          role={onChange ? "textbox" : undefined}
          aria-label={onChange ? t("Edit page text") : undefined}
          tabIndex={onChange ? 0 : undefined}
          onFocus={onChange ? onSelect : undefined}
          onPointerDown={
            onChange
              ? (event) => {
                  event.stopPropagation();
                  onSelect();
                }
              : undefined
          }
          onClick={onChange ? (event) => event.stopPropagation() : undefined}
          onDoubleClick={
            onChange ? (event) => event.stopPropagation() : undefined
          }
          onBlur={
            onChange ? (event) => saveText(event.currentTarget) : undefined
          }
          onKeyDown={
            onChange
              ? (event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveText(event.currentTarget);
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    event.currentTarget.textContent = position.text || "";
                    event.currentTarget.blur();
                  }
                }
              : undefined
          }
          onPaste={
            onChange
              ? (event) => {
                  event.preventDefault();
                  const content = event.clipboardData
                    .getData("text/plain")
                    .replace(/\r?\n/g, " ");
                  const selection = window.getSelection();
                  const range = selection?.rangeCount
                    ? selection.getRangeAt(0)
                    : null;
                  if (
                    range &&
                    event.currentTarget.contains(range.commonAncestorContainer)
                  ) {
                    range.deleteContents();
                    const inserted = document.createTextNode(content);
                    range.insertNode(inserted);
                    range.setStartAfter(inserted);
                    range.collapse(true);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                  } else event.currentTarget.textContent += content;
                }
              : undefined
          }
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
          <CornerHandles
            label={t("Page artwork")}
            className="artwork-resize"
            onStart={(event) => start(event, "resize")}
          />
          {isImage && (
            <input
              ref={upload}
              hidden
              type="file"
              accept="image/*"
              aria-label={t("Replace page image")}
              onChange={(event) => {
                void replace(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          )}
          {error && <small role="alert">{error}</small>}
          {isText ? (
            <>
              <button
                type="button"
                className="page-text-move"
                aria-label={t("Move text")}
                title={t("Move text")}
                onPointerDown={(event) => start(event, "move")}
              >
                <EditorIcon name="move" />
                <span>{t("Move text")}</span>
              </button>
              {selected && (
                <div
                  className="page-text-toolbar"
                  role="toolbar"
                  aria-label={t("Text formatting")}
                  style={{
                    ...(position.y > 75
                      ? { top: "auto", bottom: "calc(100% + 36px)" }
                      : {}),
                    ...(position.x > 60 ? { left: "auto", right: 0 } : {}),
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <label>
                    <span>{t("Text size")}</span>
                    <input
                      type="number"
                      min=".5"
                      max="30"
                      step=".25"
                      aria-label={t("Text size")}
                      value={position.fontSize || 4}
                      onChange={(event) =>
                        change({
                          fontSize: clamp(
                            Number(event.target.value) || 0.5,
                            0.5,
                            30,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="page-text-color">
                    <span>{t("Text color")}</span>
                    <input
                      type="color"
                      aria-label={t("Text color")}
                      value={color}
                      onChange={(event) =>
                        change({ color: event.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={t("Delete text")}
                    title={t("Delete text")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove?.(artwork.id);
                    }}
                  >
                    <EditorIcon name="trash" />
                  </button>
                </div>
              )}
            </>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}

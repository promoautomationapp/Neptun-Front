import React, { useRef, useState } from "react";
import type { Artwork } from "../../domain/models";
import {
  CornerHandles,
  resizeFromCorner,
  type ResizeCorner,
} from "../brochure/resizeCorners";
import { t } from "../brochure/i18n";

export function SocialCanvasText({
  artwork,
  onChange,
  onRemove,
}: {
  artwork: Artwork;
  onChange?: (patch: Partial<Artwork>) => void;
  onRemove?: () => void;
}) {
  const [selected, setSelected] = useState(false);
  const [editing, setEditing] = useState(false);
  const text = useRef<HTMLDivElement>(null);
  const initialText = useRef("");
  const cancelled = useRef(false);
  const [draft, setDraft] = useState<Partial<Artwork> | null>(null);
  const gesture = useRef<{
    startX: number;
    startY: number;
    rect: DOMRect;
    frame: { x: number; y: number; width: number; height: number };
    fontSize: number;
    corner?: ResizeCorner;
  } | null>(null);
  const value = { ...artwork, ...draft };
  function begin(
    event: React.PointerEvent<HTMLButtonElement>,
    corner?: ResizeCorner,
  ) {
    if (!onChange) return;
    if (editing) text.current?.blur();
    const canvas = event.currentTarget.closest<HTMLElement>(".social-canvas");
    const layer = event.currentTarget.closest<HTMLElement>(".social-free-text");
    if (!canvas || !layer) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      rect,
      frame: {
        x: artwork.x,
        y: artwork.y,
        width: artwork.width,
        height: (layer.getBoundingClientRect().height / rect.height) * 100,
      },
      fontSize: artwork.fontSize || 4,
      corner,
    };
    setSelected(true);
  }
  function move(event: React.PointerEvent) {
    const current = gesture.current;
    if (!current) return;
    const dx = ((event.clientX - current.startX) / current.rect.width) * 100;
    const dy = ((event.clientY - current.startY) / current.rect.height) * 100;
    if (current.corner) {
      const frame = resizeFromCorner(current.frame, dx, dy, current.corner, {
        lockAspect: true,
        minWidth: 5,
        maxWidth: 95,
        minHeight: 0.5,
      });
      setDraft({
        x: frame.x,
        y: frame.y,
        width: frame.width,
        fontSize: Math.max(
          0.6,
          Math.min(20, (current.fontSize * frame.width) / current.frame.width),
        ),
      });
    } else
      setDraft({
        x: Math.max(0, Math.min(95, current.frame.x + dx)),
        y: Math.max(0, Math.min(95, current.frame.y + dy)),
      });
  }
  function finish(cancel = false) {
    if (!gesture.current) return;
    gesture.current = null;
    if (!cancel && draft) onChange?.(draft);
    setDraft(null);
  }
  function commit() {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = text.current?.textContent || "";
    if (next !== artwork.text) onChange?.({ text: next.slice(0, 5000) });
  }
  if (artwork.hidden) return null;
  return (
    <div
      className={`social-free-text ${selected && onChange ? "selected" : ""}`}
      style={{
        left: `${value.x}%`,
        top: `${value.y}%`,
        width: `${value.width}%`,
        fontSize: `${value.fontSize || 4}cqw`,
        color: value.color || "#ffffff",
        zIndex: value.zIndex || 30,
      }}
      onPointerMove={move}
      onPointerUp={() => finish()}
      onPointerCancel={() => finish(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setSelected(false);
      }}
    >
      <div
        ref={text}
        style={{ opacity: Math.max(0, Math.min(1, value.opacity ?? 1)) }}
        data-social-text-layer={artwork.id}
        role={onChange ? "textbox" : undefined}
        aria-label={onChange ? t("Text layer") : undefined}
        contentEditable={Boolean(onChange)}
        suppressContentEditableWarning
        spellCheck
        onFocus={() => {
          initialText.current = artwork.text || "";
          cancelled.current = false;
          setSelected(true);
          setEditing(true);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancelled.current = true;
            if (text.current) text.current.textContent = initialText.current;
            text.current?.blur();
          } else if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            text.current?.blur();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const selection = window.getSelection();
          if (!selection?.rangeCount) return;
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const node = document.createTextNode(
            event.clipboardData.getData("text/plain"),
          );
          range.insertNode(node);
          range.setStartAfter(node);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }}
      >
        {artwork.text}
      </div>
      {onChange && (
        <>
          <button
            type="button"
            data-export-hide="true"
            className="social-text-move"
            aria-label={t("Move text")}
            title={t("Drag to move")}
            onPointerDown={(event) => begin(event)}
            onClick={() => setSelected(true)}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" />
            </svg>
          </button>
          {selected && (
            <>
              <CornerHandles label={t("Text")} onStart={begin} />
              <div
                className="social-text-toolbar"
                data-export-hide="true"
                role="toolbar"
                aria-label={t("Text formatting")}
              >
                <label>
                  {t("Size")}
                  <input
                    aria-label={t("Text size")}
                    type="number"
                    min="0.6"
                    max="20"
                    step="0.2"
                    value={artwork.fontSize || 4}
                    onChange={(event) =>
                      onChange({
                        fontSize: Math.max(
                          0.6,
                          Math.min(20, Number(event.target.value) || 4),
                        ),
                      })
                    }
                  />
                </label>
                <input
                  aria-label={t("Text color")}
                  type="color"
                  value={artwork.color || "#ffffff"}
                  onChange={(event) => onChange({ color: event.target.value })}
                />
                <button
                  type="button"
                  aria-label={t("Delete text")}
                  onClick={onRemove}
                >
                  {t("Delete")}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

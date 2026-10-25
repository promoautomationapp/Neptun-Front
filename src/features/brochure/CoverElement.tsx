import {
  CornerHandles,
  resizeFromCorner,
  type ResizeCorner,
} from "./resizeCorners";
import { EditorIcon } from "./EditorIcon";
import { t } from "./i18n";
import React from "react";
import type { Campaign, Placement } from "../../domain/models";
import { coverElementPlacement } from "./coverElements";
import "../../styles/cover-elements.css";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
type CoverGestureAction = "move" | "resize";
type CoverPlacement = Placement & { x: number; y: number; width: number };
interface CoverGesture {
  changed?: boolean;
  action: CoverGestureAction;
  corner?: ResizeCorner;
  page: DOMRect;
  rect: DOMRect;
  startX: number;
  startY: number;
  original: CoverPlacement;
  next: CoverPlacement;
}
export interface CoverElementProps {
  campaign: Pick<
    Campaign,
    "coverElementPlacements" | "showCoverBand" | "showCoverHeadline"
  >;
  kind: string;
  onChange?: (kind: string, placement: CoverPlacement) => void;
  onHide?: (kind: string) => void;
  onReplaceFile?: (file: File) => void;
  onChooseImage?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  defaultPlacement?: CoverPlacement;
}
export function CoverElement({
  campaign,
  kind,
  onChange,
  onHide,
  onReplaceFile,
  onChooseImage,
  children,
  style,
  className = "",
  defaultPlacement,
}: CoverElementProps) {
  const upload = React.useRef<HTMLInputElement>(null);
  const saved = campaign.coverElementPlacements?.[kind];
  const [placement, setPlacement] = React.useState(() =>
    defaultPlacement
      ? { ...defaultPlacement, ...campaign.coverElementPlacements?.[kind] }
      : coverElementPlacement(campaign, kind),
  );
  const gesture = React.useRef<CoverGesture | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(
    () =>
      setPlacement(
        defaultPlacement
          ? { ...defaultPlacement, ...campaign.coverElementPlacements?.[kind] }
          : coverElementPlacement(campaign, kind),
      ),
    [
      saved,
      kind,
      defaultPlacement?.x,
      defaultPlacement?.y,
      defaultPlacement?.width,
      defaultPlacement?.height,
    ],
  );
  function start(
    event: React.PointerEvent<HTMLElement>,
    action: CoverGestureAction,
  ) {
    if (!onChange) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const element = ref.current;
    const pageElement = element?.closest(".brochure-page");
    if (!element || !pageElement) return;
    const page = pageElement.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    gesture.current = {
      action,
      corner: (event.currentTarget.dataset.resizeCorner ||
        "bottom-right") as ResizeCorner,
      page,
      rect,
      startX: event.clientX,
      startY: event.clientY,
      original: placement,
      next: placement,
    };
    element.closest(".cs-page-preview")?.classList.add("dragging-guides");
  }
  function move(event: {
    preventDefault: () => void;
    stopPropagation: () => void;
    clientX: number;
    clientY: number;
  }) {
    const state = gesture.current;
    if (!state) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = ((event.clientX - state.startX) / state.page.width) * 100;
    const dy = ((event.clientY - state.startY) / state.page.height) * 100;
    if (
      state.action === "move" &&
      !state.changed &&
      Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 3
    )
      return;
    state.changed = true;
    state.next =
      state.action === "move"
        ? {
            ...state.original,
            x: clamp(
              state.original.x + dx,
              0,
              100 - (state.rect.width / state.page.width) * 100,
            ),
            y: clamp(
              state.original.y + dy,
              0,
              100 - (state.rect.height / state.page.height) * 100,
            ),
          }
        : (() => {
            const frame = {
              x: state.original.x,
              y: state.original.y,
              width: state.original.width,
              height:
                state.original.height ??
                (state.rect.height / state.page.height) * 100,
            };
            const next = resizeFromCorner(frame, dx, dy, state.corner, {
              minWidth: 5,
              minHeight: 1,
              maxWidth: 100,
              maxHeight: 100,
              lockAspect: state.original.height == null,
            });
            return {
              ...state.original,
              x: next.x,
              y: next.y,
              width: next.width,
              ...(state.original.height != null ? { height: next.height } : {}),
            };
          })();
    setPlacement(state.next);
  }
  function end() {
    if (!gesture.current) return;
    const { next, changed } = gesture.current;
    gesture.current = null;
    ref.current
      ?.closest(".cs-page-preview")
      ?.classList.remove("dragging-guides");
    if (changed) onChange?.(kind, next);
  }
  function cancel(event?: React.PointerEvent) {
    event?.stopPropagation();
    if (gesture.current) setPlacement(gesture.current.original);
    gesture.current = null;
    ref.current
      ?.closest(".cs-page-preview")
      ?.classList.remove("dragging-guides");
  }
  const handlers = (
    action: CoverGestureAction,
  ): React.HTMLAttributes<HTMLElement> => ({
    onPointerDown: (event) => start(event, action),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClick: (event) => event.stopPropagation(),
  });
  const textBaseWidth =
    defaultPlacement?.width ??
    coverElementPlacement(
      {
        showCoverBand: campaign.showCoverBand,
        showCoverHeadline: campaign.showCoverHeadline,
      },
      kind,
    ).width;
  if (placement.hidden) {
    if (!onChange) return null;
    const label =
      kind === "campaign-photo"
        ? t("Cover photograph")
        : kind === "october-hajde"
          ? "hajde!"
          : kind === "october-awards"
            ? t("Awards")
            : kind.replace(/[-_]+/g, " ");
    return (
      <button
        type="button"
        className="cover-element-restore"
        data-export-hide="true"
        aria-label={`${t("Restore")} ${label}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          const restored = { ...placement, hidden: false };
          setPlacement(restored);
          onChange(kind, restored);
        }}
        style={{
          position: "absolute",
          left: `${clamp(placement.x, 1, 80)}%`,
          top: `${clamp(placement.y, 1, 94)}%`,
          zIndex: 45,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          maxWidth: "min(270px, 75cqw)",
          padding: "6px 9px",
          border: "1px dashed var(--np-accent, #267eb9)",
          borderRadius: 6,
          background: "var(--np-surface, #ffffff)",
          color: "var(--np-text, #234967)",
          font: '600 11px/1.3 "DM Sans", Arial, sans-serif',
          cursor: "pointer",
        }}
      >
        <EditorIcon name="image" />
        {t("Restore")} {label}
      </button>
    );
  }
  return (
    <div
      ref={ref}
      className={`cover-editable-element cover-element-${kind} ${onChange ? "editable" : ""} ${className}`}
      style={
        {
          "--cover-text-scale": placement.width / Math.max(0.01, textBaseWidth),
          left: `${placement.x}%`,
          top: `${placement.y}%`,
          width: `${placement.width}%`,
          ...(placement.height != null
            ? { height: `${placement.height}%` }
            : {}),
          ...style,
        } as React.CSSProperties
      }
      onDoubleClick={
        onChooseImage || onReplaceFile
          ? (event) => {
              event.stopPropagation();
              if (onChooseImage) onChooseImage();
              else upload.current?.click();
            }
          : undefined
      }
      onDragOver={
        onReplaceFile
          ? (event) => {
              if ([...event.dataTransfer.types].includes("Files")) {
                event.preventDefault();
                event.stopPropagation();
              }
            }
          : undefined
      }
      onDrop={
        onReplaceFile
          ? (event) => {
              const file = event.dataTransfer.files[0];
              if (file) {
                event.preventDefault();
                event.stopPropagation();
                onReplaceFile(file);
              }
            }
          : undefined
      }
      onPointerDown={
        onChange && kind !== "gradient"
          ? (event) => {
              if (
                (event.target as Element).closest(
                  "button, input, textarea, select, summary, .cs-product-tools, [role='button'], [contenteditable='true']",
                )
              )
                return;
              start(event, "move");
            }
          : undefined
      }
      onPointerMove={onChange ? move : undefined}
      onPointerUp={onChange ? end : undefined}
      onPointerCancel={onChange ? cancel : undefined}
      onLostPointerCapture={onChange ? cancel : undefined}
    >
      {children}
      {onReplaceFile && (
        <input
          ref={upload}
          type="file"
          accept="image/*"
          hidden
          data-export-hide="true"
          aria-label={`${t("Replace image")}: ${kind}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onReplaceFile(file);
            event.target.value = "";
          }}
        />
      )}
      {onChange && (
        <CornerHandles
          label={`${t("Cover")} ${kind}`}
          onStart={(event) => start(event, "resize")}
        />
      )}
      {onChange && (
        <div className="cover-element-tools" data-export-hide="true">
          <button
            type="button"
            aria-label={`Move cover ${kind}`}
            {...handlers("move")}
          >
            <EditorIcon name="move" />
            <span>{t("Move")}</span>
          </button>
          {onHide && (
            <button
              type="button"
              aria-label={`Hide cover ${kind}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onHide(kind);
              }}
            >
              <EditorIcon name="trash" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

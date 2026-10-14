import React, { useEffect, useRef, useState } from "react";
import type { Box, Campaign, Placement } from "../../domain/models";
import { t } from "./i18n";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

type StoreGestureAction = "move" | "resize";
interface StoreGesture {
  action: StoreGestureAction;
  canvas: DOMRect;
  x: number;
  y: number;
  original: Box;
  next: Box;
}
export interface StoresElementProps {
  campaign: Partial<Campaign> & {
    storesElementPlacements?: Record<string, Placement>;
  };
  kind: string;
  scope?: "page" | "store" | "footer";
  onChange?: (kind: string, placement: Box) => void;
  onHide?: (kind: string) => void;
  children?: React.ReactNode;
  defaultPlacement: Box;
  className?: string;
}

export function StoresElement({
  campaign,
  kind,
  scope = "page",
  onChange,
  onHide,
  children,
  defaultPlacement,
  className = "",
}: StoresElementProps) {
  const placementKey =
    scope === "footer"
      ? "storeFooterElementPlacements"
      : scope === "store"
        ? "storePositions"
        : "storesElementPlacements";
  const hiddenKey =
    scope === "footer" ? "storeFooterHiddenElements" : "storesHiddenElements";
  const saved = scope === "store" ? undefined : campaign[placementKey]?.[kind];
  const [placement, setPlacement] = useState(() => ({
    ...defaultPlacement,
    ...saved,
  }));
  const gesture = useRef<StoreGesture | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () => setPlacement({ ...defaultPlacement, ...saved }),
    [
      saved,
      defaultPlacement.x,
      defaultPlacement.y,
      defaultPlacement.width,
      defaultPlacement.height,
    ],
  );
  if (scope !== "store" && campaign[hiddenKey]?.includes(kind)) return null;

  function start(
    event: React.PointerEvent<HTMLElement>,
    action: StoreGestureAction,
  ) {
    if (!onChange || event.button !== 0) return;
    if (
      action === "move" &&
      event.target instanceof Element &&
      event.target.closest("a,input,textarea,[contenteditable=true]")
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const element = ref.current;
    if (!element) return;
    const canvas =
      element.closest(".stores-element-canvas") ||
      element.closest(".brochure-page");
    if (!canvas) return;
    ref.current?.closest(".cs-page-preview")?.classList.add("dragging-guides");
    gesture.current = {
      action,
      canvas: canvas.getBoundingClientRect(),
      x: event.clientX,
      y: event.clientY,
      original: placement,
      next: placement,
    };
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
    const dx = ((event.clientX - state.x) / state.canvas.width) * 100;
    const dy = ((event.clientY - state.y) / state.canvas.height) * 100;
    state.next =
      state.action === "move"
        ? {
            ...state.original,
            x: clamp(state.original.x + dx, 0, 100 - state.original.width),
            y: clamp(state.original.y + dy, 0, 100 - state.original.height),
          }
        : {
            ...state.original,
            width: clamp(state.original.width + dx, 3, 100 - state.original.x),
            height: clamp(
              state.original.height + dy,
              2,
              100 - state.original.y,
            ),
          };
    setPlacement(state.next);
  }
  function end(event: React.PointerEvent<HTMLElement>) {
    const state = gesture.current;
    if (!state) return;
    gesture.current = null;
    ref.current?.closest(".cs-page-preview")?.classList.remove("dragging-guides");
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (state.next !== state.original) onChange?.(kind, state.next);
  }
  function cancel() {
    if (gesture.current) setPlacement(gesture.current.original);
    gesture.current = null;
    ref.current?.closest(".cs-page-preview")?.classList.remove("dragging-guides");
  }
  const handlers = (
    action: StoreGestureAction,
  ): React.HTMLAttributes<HTMLElement> => ({
    onPointerDown: (event) => start(event, action),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
  });
  return (
    <div
      ref={ref}
      className={`stores-editable-element ${onChange ? "editable" : ""} ${className}`}
      data-store-element={kind}
      data-store-scope={scope}
      style={{
        position: "absolute",
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.width}%`,
        height: `${placement.height}%`,
      }}
      {...(onChange ? handlers("move") : {})}
    >
      {children}
      {onChange && (
        <div className="stores-element-tools" data-export-hide="true">
          <button
            type="button"
            aria-label={`${t("Move")}: ${kind}`}
            title={t("Drag to move")}
            {...handlers("move")}
          >
            ✥
          </button>
          <button
            type="button"
            aria-label={`${t("Resize")}: ${kind}`}
            title={t("Drag to resize")}
            {...handlers("resize")}
          >
            ↘
          </button>
          {onHide && (
            <button
              type="button"
              aria-label={`${t("Hide")}: ${kind}`}
              title={t("Hide")}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onHide(kind);
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

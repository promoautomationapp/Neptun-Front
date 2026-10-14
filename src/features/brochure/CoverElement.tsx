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
  page: DOMRect;
  rect: DOMRect;
  startX: number;
  startY: number;
  original: CoverPlacement;
  next: CoverPlacement;
}
export interface CoverElementProps {
  campaign: Pick<Campaign, "coverElementPlacements">;
  kind: string;
  onChange?: (kind: string, placement: CoverPlacement) => void;
  onHide?: (kind: string) => void;
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
  children,
  style,
  className = "",
  defaultPlacement,
}: CoverElementProps) {
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
    if (state.action === "move" && !state.changed && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 3) return;
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
        : {
            ...state.original,
            width: clamp(state.original.width + dx, 5, 100),
            ...(kind === "gradient" || kind.startsWith("product-")
              ? {
                  height: clamp(
                    (state.original.height ??
                      (state.rect.height / state.page.height) * 100) + dy,
                    2,
                    100,
                  ),
                }
              : {}),
          };
    setPlacement(state.next);
  }
  function end() {
    if (!gesture.current) return;
    const { next, changed } = gesture.current;
    gesture.current = null;
    ref.current?.closest(".cs-page-preview")?.classList.remove("dragging-guides");
    if (changed) onChange?.(kind, next);
  }
  function cancel(event?: React.PointerEvent) {
    event?.stopPropagation();
    if (gesture.current) setPlacement(gesture.current.original);
    gesture.current = null;
    ref.current?.closest(".cs-page-preview")?.classList.remove("dragging-guides");
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
  return (
    <div
      ref={ref}
      className={`cover-editable-element cover-element-${kind} ${onChange ? "editable" : ""} ${className}`}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.width}%`,
        ...(placement.height != null ? { height: `${placement.height}%` } : {}),
        ...style,
      }}
      onPointerDown={
        onChange && kind !== "gradient"
          ? (event) => {
              if ((event.target as Element).closest("button, input, textarea, select, [role='button'], [contenteditable='true']")) return;
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
      {onChange && (
        <div className="cover-element-tools" data-export-hide="true">
          <button
            type="button"
            aria-label={`Move cover ${kind}`}
            {...handlers("move")}
          >
            ✥
          </button>
          <button
            type="button"
            aria-label={`Resize cover ${kind}`}
            {...handlers("resize")}
          >
            ↘
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
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

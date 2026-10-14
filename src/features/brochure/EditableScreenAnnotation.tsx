import React from "react";
import { ScreenSizeAnnotation } from "./ScreenSizeAnnotation";
import {
  resolveScreenAnnotationPlacement,
  screenAnnotationPlacementStyle,
} from "./screenAnnotationGeometry";
import type {
  ResolvedScreenAnnotationPlacement,
  ScreenAnnotationPlacement,
  ScreenAnnotationType,
} from "./screenAnnotationGeometry";
import "../../styles/product-layout-controls.css";

interface EditableScreenAnnotationProps {
  product: { screenAnnotationPlacement?: ScreenAnnotationPlacement };
  inches: number | string | null;
  type: ScreenAnnotationType;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (
    field: "screenAnnotationPlacement",
    value: ScreenAnnotationPlacement,
  ) => void;
}
interface AnnotationGesture {
  mode: "move" | "resize";
  x: number;
  y: number;
  width: number;
  initial: ResolvedScreenAnnotationPlacement;
  next?: ResolvedScreenAnnotationPlacement;
}

export function EditableScreenAnnotation({
  product,
  inches,
  type,
  className = "",
  style,
  onChange,
}: EditableScreenAnnotationProps) {
  const saved: ScreenAnnotationPlacement | undefined =
    product.screenAnnotationPlacement;
  const [placement, setPlacement] = React.useState<ScreenAnnotationPlacement>(
    saved || {},
  );
  React.useEffect(() => setPlacement(saved || {}), [saved]);
  const gesture = React.useRef<AnnotationGesture | null>(null);
  if (placement.hidden) return null;
  function begin(
    event: React.PointerEvent<HTMLElement>,
    mode: AnnotationGesture["mode"],
  ) {
    if (!onChange) return;
    const element = event.currentTarget.closest(".screen-size-annotation");
    const page = element
      ?.closest(".brochure-page,.social-canvas")
      ?.getBoundingClientRect();
    if (!page?.width) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.current = {
      mode,
      x: event.clientX,
      y: event.clientY,
      width: page.width,
      initial: resolveScreenAnnotationPlacement(type, placement),
    };
  }
  function move(event: React.PointerEvent<HTMLElement>) {
    const action = gesture.current;
    if (!action) return;
    const dx = ((event.clientX - action.x) / action.width) * 100;
    const dy = ((event.clientY - action.y) / action.width) * 100;
    action.next =
      action.mode === "move"
        ? {
            ...action.initial,
            x: action.initial.x + dx,
            y: action.initial.y + dy,
          }
        : {
            ...action.initial,
            scale: Math.max(
              0.25,
              Math.min(2.5, action.initial.scale + (dx + dy) / 10),
            ),
          };
    setPlacement(action.next);
  }
  function end(event: React.PointerEvent<HTMLElement>, cancelled = false) {
    event.stopPropagation();
    if (!gesture.current) return;
    if (cancelled) setPlacement(saved || {});
    else if (gesture.current.next)
      onChange?.("screenAnnotationPlacement", gesture.current.next);
    gesture.current = null;
  }
  const cancel = (event: React.PointerEvent<HTMLElement>) => end(event, true);
  return (
    <ScreenSizeAnnotation
      inches={inches}
      type={type}
      className={`${className} ${onChange ? "cs-editable-inch" : ""}`}
      style={{ ...style, ...screenAnnotationPlacementStyle(type, placement) }}
      guideLengths={placement}
      onPointerDown={onChange ? (event) => begin(event, "move") : undefined}
      onPointerMove={onChange ? move : undefined}
      onPointerUp={onChange ? end : undefined}
      onPointerCancel={onChange ? cancel : undefined}
      onLostPointerCapture={onChange ? cancel : undefined}
    >
      {onChange && (
        <span className="cs-inch-handles" data-export-hide="true">
          <button
            aria-label="Resize inch label"
            onPointerDown={(event) => begin(event, "resize")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={cancel}
            onLostPointerCapture={cancel}
          >
            ↘
          </button>
          <button
            aria-label="Delete inch label"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onChange("screenAnnotationPlacement", {
                ...placement,
                hidden: true,
              });
            }}
          >
            ×
          </button>
        </span>
      )}
    </ScreenSizeAnnotation>
  );
}

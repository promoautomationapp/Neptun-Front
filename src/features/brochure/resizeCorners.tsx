import React from "react";
import { t } from "./i18n";

export const RESIZE_CORNERS = [
  "bottom-right",
  "top-left",
  "top-right",
  "bottom-left",
] as const;
export type ResizeCorner = (typeof RESIZE_CORNERS)[number];
export interface ResizeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/** The opposite corner stays fixed; all callers keep their own coordinate units. */
export function resizeFromCorner(
  frame: ResizeFrame,
  dx: number,
  dy: number,
  corner: ResizeCorner = "bottom-right",
  options: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    lockAspect?: boolean;
  } = {},
): ResizeFrame {
  const left = corner.endsWith("left"),
    top = corner.startsWith("top");
  const xChange = left ? -dx : dx,
    yChange = top ? -dy : dy;
  let width: number, height: number;
  if (options.lockAspect) {
    const relativeX = xChange / frame.width,
      relativeY = yChange / frame.height;
    const factor = clamp(
      1 + (Math.abs(relativeX) > Math.abs(relativeY) ? relativeX : relativeY),
      Math.max(
        (options.minWidth ?? 0.01) / frame.width,
        (options.minHeight ?? 0.01) / frame.height,
      ),
      Math.min(
        (options.maxWidth ?? Infinity) / frame.width,
        (options.maxHeight ?? Infinity) / frame.height,
      ),
    );
    width = frame.width * factor;
    height = frame.height * factor;
  } else {
    width = clamp(
      frame.width + xChange,
      options.minWidth ?? 0.01,
      options.maxWidth ?? Infinity,
    );
    height = clamp(
      frame.height + yChange,
      options.minHeight ?? 0.01,
      options.maxHeight ?? Infinity,
    );
  }
  return {
    x: left ? frame.x + frame.width - width : frame.x,
    y: top ? frame.y + frame.height - height : frame.y,
    width,
    height,
  };
}

export function CornerHandles({
  label,
  onStart,
  positions,
  className = "",
  onKeyDown,
}: {
  label: string;
  onStart: (
    event: React.PointerEvent<HTMLButtonElement>,
    corner: ResizeCorner,
  ) => void;
  positions?: Partial<Record<ResizeCorner, React.CSSProperties>>;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
}) {
  return (
    <>
      {RESIZE_CORNERS.map((corner) => (
        <button
          key={corner}
          type="button"
          data-export-hide="true"
          data-resize-corner={corner}
          className={`resize-corner resize-${corner} ${className}`}
          style={positions?.[corner]}
          aria-label={`${t("Resize")} ${label} · ${t(corner)}`}
          title={`${t("Drag to resize")} · ${t(corner)}`}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => onStart(event, corner)}
          onClick={(event) => event.stopPropagation()}
        />
      ))}
    </>
  );
}

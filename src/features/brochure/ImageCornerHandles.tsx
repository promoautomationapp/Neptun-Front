import React, { useLayoutEffect, useState } from "react";
import { CornerHandles, type ResizeCorner } from "./resizeCorners";

export function ImageCornerHandles({
  imageRef,
  areaRef,
  revision,
  label,
  onStart,
}: {
  imageRef: React.RefObject<HTMLImageElement | null>;
  areaRef: React.RefObject<HTMLDivElement | null>;
  revision: unknown;
  label: string;
  onStart: (
    event: React.PointerEvent<HTMLButtonElement>,
    corner: ResizeCorner,
  ) => void;
}) {
  const [positions, setPositions] = useState<
    Partial<Record<ResizeCorner, React.CSSProperties>>
  >({});
  useLayoutEffect(() => {
    const image = imageRef.current,
      area = areaRef.current;
    if (!image || !area) return;
    const update = () => {
      const frame = image.getBoundingClientRect(),
        parent = area.getBoundingClientRect();
      if (!parent.width || !parent.height) return;
      const point = (x: number, y: number) => ({
        left: `${((x - parent.left) / parent.width) * 100}%`,
        top: `${((y - parent.top) / parent.height) * 100}%`,
      });
      const next = {
        "top-left": point(frame.left, frame.top),
        "top-right": point(frame.right, frame.top),
        "bottom-left": point(frame.left, frame.bottom),
        "bottom-right": point(frame.right, frame.bottom),
      };
      setPositions((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
    };
    update();
    image.addEventListener("load", update);
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(area);
    observer?.observe(image);
    return () => {
      observer?.disconnect();
      image.removeEventListener("load", update);
    };
  }, [imageRef, areaRef, revision]);
  return (
    <CornerHandles
      label={label}
      positions={positions}
      onStart={onStart}
      className="cs-image-corner"
    />
  );
}

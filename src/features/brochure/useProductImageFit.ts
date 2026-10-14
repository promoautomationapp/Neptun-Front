import React, {type RefObject} from "react";
import type {Placement} from "../../domain/models";
import { visibleImageBounds } from "./screenGeometry";
import { productImageFit, type ImageFitPlacement } from "./productImageFit";

// Fit the visible product in the existing photo slot. This changes only the
// display transform; the full-resolution image and saved layout stay intact.
export function useProductImageFit({ imageRef, wrapRef, source, ready, base, placement }: {imageRef: RefObject<HTMLImageElement | null>; wrapRef: RefObject<HTMLDivElement | null>; source?: string; ready: number; base: ImageFitPlacement; placement?: Placement | null}) {
  const [fitted, setFitted] = React.useState<{source?: string; value: ImageFitPlacement} | null>(null);
  React.useLayoutEffect(() => {
    if (placement) return;
    const image = imageRef.current;
    const wrap = wrapRef.current;
    if (!image || !wrap) return;
    const update = () => {
      if (!image.complete || !image.naturalWidth || !image.naturalHeight) return;
      const imageStyle = getComputedStyle(image);
      const wrapStyle = getComputedStyle(wrap);
      const value = productImageFit({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        // A small edge clearance retains soft alpha edges and fine details.
        imageBoxWidth: parseFloat(imageStyle.width) * .98,
        imageBoxHeight: parseFloat(imageStyle.height) * .98,
        wrapWidth: parseFloat(wrapStyle.width),
        wrapHeight: parseFloat(wrapStyle.height),
        bounds: visibleImageBounds(image),
        base,
      });
      setFitted(previous => previous && previous.source === source &&
        (["x", "y", "scale"] as const).every(key => Math.abs(previous.value[key] - value[key]) < 0.00001)
        ? previous : { source, value });
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : undefined;
    observer?.observe(wrap);
    observer?.observe(image);
    update();
    return () => observer?.disconnect();
  }, [source, ready, placement, base.x, base.y, base.scale, imageRef, wrapRef]);
  return React.useMemo(() => placement || (fitted && fitted.source === source ? fitted.value : { ...base }),
    [placement, fitted, source, base.x, base.y, base.scale]);
}

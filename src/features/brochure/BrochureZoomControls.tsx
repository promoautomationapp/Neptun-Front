import React, { useLayoutEffect, useRef, useState } from "react";
import { t } from "./i18n";
import "../../styles/brochure-zoom.css";

const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const clampZoom = (value: number) =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value)));

export function BrochureZoomControls() {
  const controls = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const scroll = useRef<{ left: number; top: number } | null>(null);
  const preview = () =>
    controls.current?.closest<HTMLElement>(".cs-page-preview");
  const viewport = () =>
    preview()?.querySelector<HTMLElement>(".cs-preview-viewport");

  useLayoutEffect(() => {
    const pagePreview =
      controls.current?.closest<HTMLElement>(".cs-page-preview");
    pagePreview?.style.setProperty(
      "--brochure-preview-zoom",
      String(zoom / 100),
    );
    const canvasViewport = pagePreview?.querySelector<HTMLElement>(
      ".cs-preview-viewport",
    );
    if (canvasViewport && scroll.current) {
      canvasViewport.scrollLeft = scroll.current.left;
      canvasViewport.scrollTop = scroll.current.top;
      scroll.current = null;
    }
  }, [zoom]);

  function changeZoom(value: number) {
    const canvasViewport = viewport();
    if (canvasViewport)
      scroll.current = {
        left: canvasViewport.scrollLeft,
        top: canvasViewport.scrollTop,
      };
    setZoom(clampZoom(value));
  }
  function fitPage() {
    const canvasViewport = viewport();
    const paper =
      canvasViewport?.querySelector<HTMLElement>(".cs-preview-paper");
    if (!canvasViewport || !paper) return;
    const bounds = paper.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const availableHeight = Math.min(
      Math.max(320, window.innerHeight - 150),
      window.innerHeight -
        Math.max(0, canvasViewport.getBoundingClientRect().top) -
        24,
    );
    const factor = Math.min(
      canvasViewport.clientWidth / bounds.width,
      Math.max(1, availableHeight - 4) / bounds.height,
    );
    changeZoom(zoom * factor);
  }

  return (
    <div
      ref={controls}
      className="cs-brochure-zoom"
      role="group"
      aria-label={t("Brochure zoom")}
    >
      <button
        type="button"
        aria-label={t("Zoom out")}
        title={t("Zoom out")}
        disabled={zoom <= MIN_ZOOM}
        onClick={() => changeZoom(zoom - 25)}
      >
        <span aria-hidden="true">−</span>
      </button>
      <output aria-live="polite">{zoom}%</output>
      <button
        type="button"
        aria-label={t("Zoom in")}
        title={t("Zoom in")}
        disabled={zoom >= MAX_ZOOM}
        onClick={() => changeZoom(zoom + 25)}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button type="button" className="cs-brochure-fit-page" onClick={fitPage}>
        {t("Fit page")}
      </button>
    </div>
  );
}

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { t } from "./i18n";
import "../../styles/brochure-zoom.css";

const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const clampZoom = (value: number) =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value)));

interface ZoomAnchor {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
}
type PinchGesture = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

export function BrochureZoomControls({
  targetRef,
}: {
  targetRef?: React.RefObject<HTMLElement | null>;
}) {
  const controls = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const preciseZoom = useRef(100);
  const scroll = useRef<{ left: number; top: number } | null>(null);
  const anchor = useRef<ZoomAnchor | null>(null);
  const preview = useCallback(
    () =>
      targetRef?.current ||
      controls.current?.closest<HTMLElement>(".cs-page-preview"),
    [targetRef],
  );
  const viewport = useCallback(
    () =>
      preview()?.querySelector<HTMLElement>(
        ".cs-preview-viewport, .cs-preview-dialog-stage",
      ),
    [preview],
  );

  useLayoutEffect(() => {
    const pagePreview = preview();
    pagePreview?.style.setProperty(
      "--brochure-preview-zoom",
      String(zoom / 100),
    );
    const canvasViewport = viewport();
    if (canvasViewport && scroll.current) {
      canvasViewport.scrollLeft = scroll.current.left;
      canvasViewport.scrollTop = scroll.current.top;
      scroll.current = null;
    }
    const point = anchor.current;
    anchor.current = null;
    const paper = canvasViewport?.querySelector<HTMLElement>(
      ".cs-preview-paper, .cs-preview-dialog-paper",
    );
    if (point && paper && canvasViewport) {
      const bounds = paper.getBoundingClientRect();
      const dx = bounds.left + point.pageX * bounds.width - point.x;
      const dy = bounds.top + point.pageY * bounds.height - point.y;
      canvasViewport.scrollLeft += dx;
      if (canvasViewport.scrollHeight > canvasViewport.clientHeight + 1)
        canvasViewport.scrollTop += dy;
      else if (!targetRef && Math.abs(dy) > 0.5) window.scrollBy(0, dy);
    }
  }, [zoom, preview, viewport, targetRef]);

  const changeZoom = useCallback(
    (value: number, point?: { x: number; y: number }) => {
      if (!Number.isFinite(value)) return;
      const canvasViewport = viewport();
      if (canvasViewport)
        scroll.current = {
          left: canvasViewport.scrollLeft,
          top: canvasViewport.scrollTop,
        };
      const paper = canvasViewport?.querySelector<HTMLElement>(
        ".cs-preview-paper, .cs-preview-dialog-paper",
      );
      const bounds = paper?.getBoundingClientRect();
      anchor.current =
        point && bounds?.width && bounds.height
          ? {
              ...point,
              pageX: Math.max(
                0,
                Math.min(1, (point.x - bounds.left) / bounds.width),
              ),
              pageY: Math.max(
                0,
                Math.min(1, (point.y - bounds.top) / bounds.height),
              ),
            }
          : null;
      preciseZoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
      setZoom(clampZoom(value));
    },
    [viewport],
  );

  useEffect(() => {
    const canvasViewport = viewport();
    if (!canvasViewport) return;
    let gesture: { zoom: number; x: number; y: number } | null = null;
    const point = (event: { clientX?: number; clientY?: number }) => {
      const bounds = canvasViewport.getBoundingClientRect();
      return {
        x: event.clientX ?? bounds.left + bounds.width / 2,
        y: event.clientY ?? bounds.top + bounds.height / 2,
      };
    };
    const wheel = (event: WheelEvent) => {
      if (
        !event.ctrlKey ||
        event.defaultPrevented ||
        !Number.isFinite(event.deltaY)
      )
        return;
      event.preventDefault();
      if (gesture) return;
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? Math.max(1, canvasViewport.clientHeight)
            : 1);
      changeZoom(
        preciseZoom.current *
          Math.exp(Math.max(-4, Math.min(4, -delta * 0.01))),
        point(event),
      );
    };
    const start = (event: Event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      gesture = { zoom: preciseZoom.current, ...point(event as PinchGesture) };
    };
    const change = (event: Event) => {
      const scale = (event as PinchGesture).scale;
      if (!gesture || !scale || !Number.isFinite(scale) || scale <= 0) return;
      event.preventDefault();
      changeZoom(gesture.zoom * scale, gesture);
    };
    const end = (event: Event) => {
      if (!gesture) return;
      event.preventDefault();
      gesture = null;
    };
    canvasViewport.addEventListener("wheel", wheel, { passive: false });
    canvasViewport.addEventListener("gesturestart", start, { passive: false });
    canvasViewport.addEventListener("gesturechange", change, {
      passive: false,
    });
    canvasViewport.addEventListener("gestureend", end, { passive: false });
    return () => {
      canvasViewport.removeEventListener("wheel", wheel);
      canvasViewport.removeEventListener("gesturestart", start);
      canvasViewport.removeEventListener("gesturechange", change);
      canvasViewport.removeEventListener("gestureend", end);
    };
  }, [viewport, changeZoom]);

  function fitPage() {
    const canvasViewport = viewport();
    const paper = canvasViewport?.querySelector<HTMLElement>(
      ".cs-preview-paper, .cs-preview-dialog-paper",
    );
    if (!canvasViewport || !paper) return;
    const bounds = paper.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const styles = getComputedStyle(canvasViewport);
    const paddingX = targetRef
      ? (parseFloat(styles.paddingLeft) || 0) +
        (parseFloat(styles.paddingRight) || 0)
      : 0;
    const paddingY = targetRef
      ? (parseFloat(styles.paddingTop) || 0) +
        (parseFloat(styles.paddingBottom) || 0)
      : 0;
    const availableHeight = targetRef
      ? canvasViewport.clientHeight - paddingY
      : Math.min(
          Math.max(320, window.innerHeight - 150),
          window.innerHeight -
            Math.max(0, canvasViewport.getBoundingClientRect().top) -
            24,
        );
    const factor = Math.min(
      (canvasViewport.clientWidth - paddingX) / bounds.width,
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
      <button
        type="button"
        className="cs-brochure-fit-page"
        aria-label={t("Fit page")}
        title={t("Fit page")}
        onClick={fitPage}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M7 2H2v5m11-5h5v5M2 13v5h5m11-5v5h-5" />
        </svg>
        <span className="cs-brochure-fit-label">{t("Fit page")}</span>
      </button>
    </div>
  );
}

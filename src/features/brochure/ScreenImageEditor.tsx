import { LifestyleImageEditor } from "./LifestyleImageEditor";
import type { Box, Product, ScreenArtwork } from "../../domain/models";
import React, { useRef, useState } from "react";
import { Button, Modal } from "./Modals";
import { readImage } from "./utils";
import { t } from "./i18n";
import { isTelevision } from "./tvSpecs";
import {
  savedScreenBoxForPhoto,
  screenPhotoSource,
  televisionScreenBox,
} from "./screenGeometry";

function defaultBox(product: Product) {
  return isTelevision(product)
    ? { x: 0.04, y: 0.08, width: 0.92, height: 0.75 }
    : { x: 0.12, y: 0.12, width: 0.76, height: 0.65 };
}
const clamp = (number: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, number));

interface ScreenImageEditorProps {
  product: Product;
  tvCount?: number;
  onSave: (artwork: ScreenArtwork | null, scope: "one" | "all") => void;
  onClose: () => void;
}
interface ScreenGesture {
  kind: "move" | "resize";
  startX: number;
  startY: number;
  initial: Box;
  initialDetectedFor: string;
  rect: DOMRect;
}
export function ScreenImageEditor({
  product,
  tvCount = 1,
  onSave,
  onClose,
}: ScreenImageEditorProps) {
  const [lifestyleOpen, setLifestyleOpen] = useState(false);
  const [fit, setFit] = useState<"contain" | "cover">(product.screenArtwork?.fit || "contain");
  const [screen, setScreen] = useState(product.screenArtwork?.image || "");
  const [box, setBox] = useState(
    savedScreenBoxForPhoto(product) || defaultBox(product),
  );
  const [detectedFor, setDetectedFor] = useState(
    product.screenArtwork?.detectedFor || "",
  );
  const [scope, setScope] = useState<"one" | "all">("one");
  const [error, setError] = useState("");
  const gesture = useRef<ScreenGesture | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const television = isTelevision(product);
  function startGesture(
    event:
      | React.PointerEvent<HTMLDivElement>
      | React.PointerEvent<HTMLButtonElement>,
    kind: "move" | "resize",
  ) {
    event.preventDefault();
    event.stopPropagation();
    const preview = event.currentTarget.closest(".cs-screen-editor-preview");
    if (!preview) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      initial: box,
      initialDetectedFor: detectedFor,
      rect: preview.getBoundingClientRect(),
    };
  }
  function moveGesture(event: { clientX: number; clientY: number }) {
    const action = gesture.current;
    if (!action || !action.rect.width || !action.rect.height) return;
    const dx = (event.clientX - action.startX) / action.rect.width;
    const dy = (event.clientY - action.startY) / action.rect.height;
    if (action.kind === "move")
      setBox({
        ...action.initial,
        x: clamp(action.initial.x + dx, 0, 1 - action.initial.width),
        y: clamp(action.initial.y + dy, 0, 1 - action.initial.height),
      });
    else
      setBox({
        ...action.initial,
        width: clamp(action.initial.width + dx, 0.03, 1 - action.initial.x),
        height: clamp(action.initial.height + dy, 0.03, 1 - action.initial.y),
      });
    setDetectedFor(screenPhotoSource(product, imageRef.current));
  }
  function endGesture() {
    gesture.current = null;
  }
  function cancelGesture(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    if (gesture.current) {
      setBox(gesture.current.initial);
      setDetectedFor(gesture.current.initialDetectedFor);
    }
    gesture.current = null;
  }
  async function choose(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      setError(t("Choose an image under 12 MB."));
      return;
    }
    try {
      setScreen(await readImage(file));
      setError("");
    } catch {
      setError(t("Could not read this image."));
    }
  }
  function fitScreen(image = imageRef.current) {
    if (!image?.naturalWidth) return;
    setBox(
      television
        ? televisionScreenBox({ ...product, screenArtwork: undefined }, image)
        : defaultBox(product),
    );
    setDetectedFor(screenPhotoSource(product, image));
  }
  function change(field: keyof Box, value: string) {
    setBox((current) => {
      const next = { ...current, [field]: Number(value) / 100 };
      next.width = clamp(next.width, 0.03, 1 - next.x);
      next.height = clamp(next.height, 0.03, 1 - next.y);
      return next;
    });
    setDetectedFor(screenPhotoSource(product, imageRef.current));
  }
  return (
    <Modal
      title={t(television ? "TV wallpaper" : "Image inside the screen")}
      kicker={`${product.brand || "PRODUCT"} · ${product.code}`}
      onClose={onClose}
      wide
    >
      <div className="cs-screen-editor">
      {lifestyleOpen && <LifestyleImageEditor context="tv" source={screen} products={[product]} onApply={(image) => setScreen(image)} onClose={() => setLifestyleOpen(false)} />}
        <p>
          {t(
            television
              ? "Choose a wallpaper for this TV or every TV in the brochure."
              : "Upload a picture for the display. The product photograph and frame stay in place. You can keep the original screen by removing this picture.",
          )}
        </p>
        <div className="cs-screen-editor-grid">
          <div className="cs-screen-editor-preview">
            <img
              ref={imageRef}
              src={product.image}
              alt={product.name}
              onLoad={(event) => {
                if (!savedScreenBoxForPhoto(product, event.currentTarget))
                  fitScreen(event.currentTarget);
              }}
            />
            {screen && (
              <div
                className="cs-screen-editor-overlay"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                }}
                onPointerDown={(event) => startGesture(event, "move")}
                onPointerMove={moveGesture}
                onPointerUp={endGesture}
                onPointerCancel={cancelGesture}
                onLostPointerCapture={cancelGesture}
              >
                <img
                  src={screen}
                  alt={t("Replacement screen image")}
                  draggable={false}
                />
                <button
                  type="button"
                  aria-label={t("Resize screen picture")}
                  onPointerDown={(event) => startGesture(event, "resize")}
                  onPointerMove={moveGesture}
                  onPointerUp={endGesture}
                  onPointerCancel={cancelGesture}
                  onLostPointerCapture={cancelGesture}
                >
                  ↘
                </button>
              </div>
            )}
          </div>
          <div className="cs-screen-editor-controls">
          <label>{t("Image fit")}<select aria-label={t("Screen image fit")} value={fit} onChange={(event) => setFit(event.target.value as "contain" | "cover")}><option value="contain">{t("Show whole image")}</option><option value="cover">{t("Fill screen")}</option></select></label>
          {television && <Button onClick={() => setLifestyleOpen(true)}>{t("Create / refine wallpaper with AI")}</Button>}
            <label className="cs-upload-button">
              ↑ {t("Upload screen picture")}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  choose(file);
                }}
              />
            </label>
            {television && tvCount > 1 && (
              <fieldset className="cs-screen-wallpaper-scope">
                <legend>{t("Apply wallpaper to")}</legend>
                <label>
                  <input
                    type="radio"
                    name="screen-wallpaper-scope"
                    value="one"
                    checked={scope === "one"}
                    onChange={() => setScope("one")}
                  />
                  {t("This TV")}
                </label>
                <label>
                  <input
                    type="radio"
                    name="screen-wallpaper-scope"
                    value="all"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                  />
                  {t("All TVs")} ({tvCount})
                </label>
              </fieldset>
            )}
            <details className="cs-screen-fit-options">
              <summary>{t("Adjust screen fit (optional)")}</summary>
              <div>
                <p>
                  {t(
                    "Drag the picture or its corner to fit the display, or use the sliders. Keep it inside the screen frame.",
                  )}
                </p>
                <Button onClick={() => fitScreen()}>
                  {t("Fit to screen")}
                </Button>
                {(
                  [
                    ["x", t("Left")],
                    ["y", t("Top")],
                    ["width", t("Width")],
                    ["height", t("Height")],
                  ] as Array<[keyof Box, string]>
                ).map(([field, label]) => (
                  <label key={field}>
                    <span>
                      {label} <b>{Math.round(box[field] * 100)}%</b>
                    </span>
                    <input
                      type="range"
                      aria-label={label}
                      min={field === "width" || field === "height" ? "3" : "0"}
                      max={field === "x" || field === "y" ? "95" : "100"}
                      value={Math.round(box[field] * 100)}
                      onChange={(event) => change(field, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </details>
            {error && (
              <p className="cs-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="cs-modal-actions">
          <Button onClick={onClose}>{t("Cancel")}</Button>
          {product.screenArtwork && (
            <Button
              onClick={() => {
                onSave(null, scope);
                onClose();
              }}
            >
              {t("Use original screen")}
            </Button>
          )}
          <Button
            tone="primary"
            disabled={!screen}
            onClick={() => {
              onSave({ image: screen, box, detectedFor, fit }, scope);
              onClose();
            }}
          >
            {t(television ? "Apply wallpaper" : "Save screen image")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

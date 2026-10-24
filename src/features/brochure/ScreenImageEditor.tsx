import {
  CornerHandles,
  resizeFromCorner,
  type ResizeCorner,
} from "./resizeCorners";
import { FileUpload } from "../../components/FileUpload";
import { SearchableSelect } from "../../components/SearchableSelect";
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
  televisions?: Product[];
  onSave: (artwork: ScreenArtwork | null, scope: "one" | "all") => void;
  onClose: () => void;
}
interface ScreenGesture {
  kind: "move" | "resize";
  corner?: ResizeCorner;
  startX: number;
  startY: number;
  initial: Box;
  initialDetectedFor: string;
  rect: DOMRect;
}
export function ScreenImageEditor({
  product,
  tvCount = 1,
  televisions = [],
  onSave,
  onClose,
}: ScreenImageEditorProps) {
  const [lifestyleOpen, setLifestyleOpen] = useState(false);
  const [fit, setFit] = useState<"contain" | "cover">(
    product.screenArtwork?.fit || "contain",
  );
  const [screen, setScreen] = useState(product.screenArtwork?.image || "");
  const [box, setBox] = useState(
    savedScreenBoxForPhoto(product) || defaultBox(product),
  );
  const [detectedFor, setDetectedFor] = useState(
    product.screenArtwork?.detectedFor || "",
  );
  const [scopePrompt, setScopePrompt] = useState<"apply" | "restore" | null>(
    null,
  );
  const [adjusting, setAdjusting] = useState(false);
  const scopeRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const gesture = useRef<ScreenGesture | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const television = isTelevision(product);
  function save(scope: "one" | "all", restoring = scopePrompt === "restore") {
    onSave(restoring ? null : { image: screen, box, detectedFor, fit }, scope);
    onClose();
  }
  function requestSave(restoring = false) {
    if (!television || tvCount <= 1) return save("one", restoring);
    setScopePrompt(restoring ? "restore" : "apply");
    requestAnimationFrame(() => {
      scopeRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
      });
      scopeRef.current?.focus();
    });
  }
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
      corner: (event.currentTarget.dataset.resizeCorner ||
        "bottom-right") as ResizeCorner,
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
      setBox(
        resizeFromCorner(action.initial, dx, dy, action.corner, {
          lockAspect: true,
          minWidth: 0.03,
          minHeight: 0.03,
          maxWidth: action.corner?.endsWith("left")
            ? action.initial.x + action.initial.width
            : 1 - action.initial.x,
          maxHeight: action.corner?.startsWith("top")
            ? action.initial.y + action.initial.height
            : 1 - action.initial.y,
        }),
      );
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
      const amount = Number(value) / 100;
      if (field === "x")
        return { ...current, x: clamp(amount, 0, 1 - current.width) };
      if (field === "y")
        return { ...current, y: clamp(amount, 0, 1 - current.height) };
      return {
        ...current,
        [field]: clamp(
          amount,
          0.03,
          1 - current[field === "width" ? "x" : "y"],
        ),
      };
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
        {lifestyleOpen && (
          <LifestyleImageEditor
            context="tv"
            source={screen}
            products={[product]}
            onApply={(image) => setScreen(image)}
            onClose={() => setLifestyleOpen(false)}
          />
        )}
        <p>
          {t(
            television
              ? "Choose a wallpaper for this TV or every TV in the brochure."
              : "Upload a picture for the display. The product photograph and frame stay in place. You can keep the original screen by removing this picture.",
          )}
        </p>
        <div className="cs-screen-editor-grid">
          <div
            className={`cs-screen-editor-preview ${adjusting ? "adjusting" : ""}`}
            onDragOver={(event) => {
              if ([...event.dataTransfer.types].includes("Files")) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onDrop={(event) => {
              const file = event.dataTransfer.files[0];
              if (file) {
                event.preventDefault();
                event.stopPropagation();
                void choose(file);
              }
            }}
          >
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
                onPointerDown={(event) => {
                  if (adjusting) startGesture(event, "move");
                }}
                onPointerMove={moveGesture}
                onPointerUp={endGesture}
                onPointerCancel={cancelGesture}
                onLostPointerCapture={cancelGesture}
              >
                <img
                  style={{ objectFit: fit, background: "#000" }}
                  src={screen}
                  alt={t("Replacement screen image")}
                  draggable={false}
                />
                <CornerHandles
                  label={t("Screen picture")}
                  onStart={(event) => startGesture(event, "resize")}
                />
              </div>
            )}
          </div>
          <div className="cs-screen-editor-controls">
            <label>
              {t("Image fit")}
              <SearchableSelect
                aria-label={t("Screen image fit")}
                value={fit}
                onChange={(event) =>
                  setFit(event.target.value as "contain" | "cover")
                }
              >
                <option value="contain">{t("Show whole image")}</option>
                <option value="cover">{t("Fill screen")}</option>
              </SearchableSelect>
            </label>
            {television && (
              <Button onClick={() => setLifestyleOpen(true)}>
                {t("Create / refine wallpaper with AI")}
              </Button>
            )}
            <FileUpload
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                return choose(file);
              }}
            >
              {t("Upload screen picture")}
            </FileUpload>
            <p className="cs-screen-fit-help">
              {t("Drop a picture onto the TV preview to change its wallpaper.")}
            </p>
            <p className="cs-screen-fit-help">
              {t(
                "Portrait images stay centered with black space on either side.",
              )}
            </p>
            <Button onClick={() => fitScreen()}>{t("Fit to screen")}</Button>
            <label className="cs-screen-size-control">
              <span>
                {t("Screen size")}{" "}
                <output>{Math.round(box.width * 100)}%</output>
              </span>
              <input
                type="range"
                aria-label={t("Screen size")}
                min="20"
                max="100"
                value={box.width * 100}
                onChange={(event) => {
                  const scale = Number(event.target.value) / 100 / box.width;
                  const safe = Math.min(scale, 1 / box.width, 1 / box.height);
                  const width = box.width * safe,
                    height = box.height * safe;
                  setBox({
                    width,
                    height,
                    x: clamp(box.x + (box.width - width) / 2, 0, 1 - width),
                    y: clamp(box.y + (box.height - height) / 2, 0, 1 - height),
                  });
                  setDetectedFor(screenPhotoSource(product, imageRef.current));
                }}
              />
            </label>
            <details
              className="cs-screen-fit-options"
              onToggle={(event) => setAdjusting(event.currentTarget.open)}
            >
              <summary>{t("Adjust screen fit (optional)")}</summary>
              <div>
                <p>
                  {t(
                    "Drag the picture or its corner to fit the display, or use the sliders. Keep it inside the screen frame.",
                  )}
                </p>

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
        {scopePrompt && (
          <section
            className="cs-tv-scope-prompt"
            ref={scopeRef}
            tabIndex={-1}
            aria-labelledby="tv-scope-title"
          >
            <h3 id="tv-scope-title">
              {t(
                scopePrompt === "restore"
                  ? "Restore the original screens?"
                  : "Add this image to all TVs in the brochure?",
              )}
            </h3>
            <p>{t("Each TV keeps its own screen frame and proportions.")}</p>
            <div className="cs-tv-scope-previews">
              {(televisions.length ? televisions : [product])
                .slice(0, 4)
                .map((tv) => (
                  <TVWallpaperPreview
                    key={tv.code}
                    product={tv}
                    image={scopePrompt === "restore" ? "" : screen}
                    fit={fit}
                    box={
                      String(tv.code) === String(product.code) ? box : undefined
                    }
                  />
                ))}
              {tvCount > 4 && (
                <span className="cs-tv-scope-more">
                  +{tvCount - 4} {t("TVs")}
                </span>
              )}
            </div>
            <div className="cs-tv-scope-actions">
              <Button onClick={() => setScopePrompt(null)}>{t("Back")}</Button>
              <Button onClick={() => save("one")}>{t("Only this TV")}</Button>
              <Button tone="primary" onClick={() => save("all")}>
                {t("All TVs")} ({tvCount})
              </Button>
            </div>
          </section>
        )}
      </div>
      {!scopePrompt && (
        <div className="cs-modal-actions">
          <Button onClick={onClose}>{t("Cancel")}</Button>
          {product.screenArtwork && (
            <Button onClick={() => requestSave(true)}>
              {t("Use original screen")}
            </Button>
          )}
          <Button
            tone="primary"
            disabled={!screen}
            onClick={() => requestSave()}
          >
            {t(television ? "Apply wallpaper" : "Save screen image")}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function TVWallpaperPreview({
  product,
  image,
  fit,
  box: chosenBox,
}: {
  product: Product;
  image: string;
  fit: "contain" | "cover";
  box?: Box;
}) {
  const [box, setBox] = useState(
    savedScreenBoxForPhoto(product) || defaultBox(product),
  );
  const frame = chosenBox || box;
  return (
    <figure className="cs-tv-scope-preview">
      <div>
        <img
          src={product.image}
          alt={product.name}
          onLoad={(event) =>
            setBox(televisionScreenBox(product, event.currentTarget))
          }
        />
        {image && (
          <span
            style={{
              left: `${frame.x * 100}%`,
              top: `${frame.y * 100}%`,
              width: `${frame.width * 100}%`,
              height: `${frame.height * 100}%`,
            }}
          >
            <img src={image} alt="" style={{ objectFit: fit }} />
          </span>
        )}
      </div>
      <figcaption>
        {product.brand} · {product.code}
      </figcaption>
    </figure>
  );
}

import { isTelevision } from "./tvSpecs";
import { requestAi } from "../ai/ai.api";
import { FileUpload } from "../../components/FileUpload";
import { imageOrientation } from "../ai/image-inspection";
import type { Product, Settings } from "../../domain/models";
import { resolveAsset } from "../../api/client";
import { SavedImageChoices } from "./SavedImageChoices";
import { EditorIcon } from "./EditorIcon";
import "../../styles/image-editor-options.css";
import { useCatalogPhotos } from "../products/useCatalogPhotos";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal } from "./Modals";
import { t } from "./i18n";
import { readImage } from "./utils";
import { MissingCatalogNotice, imageSearchState } from "./MissingCatalogNotice";
import {
  buildImagePreparationRequest,
  discardPreparedProductPhoto,
  imageBackgroundSignature,
  imagePreparationMetadata,
} from "./imageReview";

export function ProductImageEditor({
  product,
  settings,
  catalogProduct,
  backgroundContext,
  onSave,
  onClose,
  onFindImage,
  onEditScreen,
  onEditArtwork,
  canResumeSearch = false,
}: {
  product: Product;
  settings?: Settings;
  catalogProduct?: Product;
  backgroundContext?: unknown;
  onSave: (changes: Partial<Product>) => void;
  onClose: () => void;
  onFindImage?: () => void | Promise<void>;
  onEditScreen?: () => void;
  onEditArtwork?: () => void;
  canResumeSearch?: boolean;
}) {
  const catalogPhotos = useCatalogPhotos(catalogProduct);
  const photoProduct = catalogPhotos.product;
  const search = imageSearchState(product);
  const foundSource =
    search?.status === "found"
      ? product.aiOriginalImage || product.image || search.imageUrl || ""
      : "";
  const choices = useMemo(
    () => [
      ...new Set(
        [
          product.aiOriginalImage,
          !product.aiOriginalImage && product.image,
          foundSource,
          ...(product.imageChoices || []),
          photoProduct?.localImage,
          product.localImage,
          photoProduct?.image,
          ...(photoProduct?.images || []),
          photoProduct?.imageUrl,
          product.imageUrl,
        ].filter(
          (image): image is string =>
            typeof image === "string" &&
            Boolean(image) &&
            !/[?&]width=(?:80|100)(?:&|$)/i.test(image),
        ),
      ),
    ],
    [product, photoProduct, foundSource],
  );
  const [source, setSource] = useState(choices[0] || product.image || "");
  const [sourceMode, setSourceMode] = useState<"catalog" | "saved" | "upload">(
    choices.length ? "catalog" : "upload",
  );
  const [kind, setKind] = useState(
    foundSource && !product.aiOriginalImage
      ? "search"
      : product.skipAiCutout
        ? "upload"
        : "catalog",
  );
  const backgroundSignature = imageBackgroundSignature(backgroundContext);
  const [cutout, setCutout] = useState(
    Boolean(
      product.aiOriginalImage &&
      product.aiCutoutValidated === true &&
      (product.aiCutoutValidationVersion ?? 0) >= 1 &&
      source === product.aiOriginalImage,
    ),
  );
  const [instructions, setInstructions] = useState("");
  const savedPrepared =
    product.aiOriginalImage &&
    product.aiCutoutValidated === true &&
    (product.aiCutoutValidationVersion ?? 0) >= 1 &&
    source === product.aiOriginalImage
      ? product.image
      : "";
  const [prepared, setPrepared] = useState(savedPrepared ?? "");
  const [preparedMetadata, setPreparedMetadata] = useState<Partial<Product>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [retryProgress, setRetryProgress] = useState<{
    attempt: number;
    limit: number;
  }>();
  const [error, setError] = useState("");
  const [draggingUpload, setDraggingUpload] = useState(false);
  const selection = useRef("");
  const activePreparation = useRef<AbortController | null>(null);
  const rejectedPreparedImage = useRef("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const lastFound = useRef(foundSource);
  selection.current = JSON.stringify([
    source,
    backgroundSignature,
    instructions,
  ]);
  function cancelPreparation() {
    const active = activePreparation.current;
    activePreparation.current = null;
    selection.current = "";
    active?.abort();
    setBusy(false);
    setRetryProgress(undefined);
  }
  function chooseSource(image: string, nextKind: string) {
    cancelPreparation();
    rejectedPreparedImage.current = "";
    setSource(image);
    setKind(nextKind);
    setCutout(false);
    setInstructions("");
    setError("");
  }
  function close() {
    cancelPreparation();
    onClose();
  }
  useEffect(
    () => () => {
      activePreparation.current?.abort();
      activePreparation.current = null;
      selection.current = "";
    },
    [],
  );
  useEffect(() => {
    if (!source && choices[0]) {
      cancelPreparation();
      setSource(choices[0]);
      setCutout(false);
    }
    if (foundSource && foundSource !== lastFound.current && kind !== "upload") {
      cancelPreparation();
      setSource(foundSource);
      setKind("search");
      setCutout(false);
    }
    lastFound.current = foundSource;
  }, [choices, source, foundSource, kind]);
  useEffect(() => {
    setPrepared(savedPrepared ?? "");
    setPreparedMetadata(
      savedPrepared
        ? Object.fromEntries(
            [
              "aiInchesEmbedded",
              "aiAnnotationStyle",
              "aiPreparedScreenInches",
              "aiPreparationRevision",
              "aiBackgroundSignature",
              "aiCutoutValidated",
              "aiCutoutValidationVersion",
            ].map((key) => [key, product[key as keyof Product]]),
          )
        : {},
    );
    setError("");
    setRetryProgress(undefined);
  }, [source, savedPrepared, backgroundSignature]);

  async function selectUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("Choose an image file."));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError(t("Choose an image under 12 MB."));
      return;
    }
    try {
      chooseSource(await readImage(file), "upload");
      setSourceMode("upload");
    } catch {
      setError(t("Could not read this image."));
    }
  }

  async function prepare() {
    if (!source || activePreparation.current) return;
    const regenerate = Boolean(prepared || product.aiOriginalImage || error);
    const rejectedImage =
      prepared ||
      rejectedPreparedImage.current ||
      (product.aiOriginalImage ? product.image : "");
    if (regenerate) {
      setPrepared("");
      setPreparedMetadata({});
      setCutout(false);
      if (product.aiOriginalImage && product.image !== source)
        onSave({ ...discardPreparedProductPhoto(product), image: source });
    }
    const controller = new AbortController();
    activePreparation.current = controller;
    setError("");
    setBusy(true);
    setRetryProgress(undefined);
    const selected = JSON.stringify([
      source,
      backgroundSignature,
      instructions,
    ]);
    selection.current = selected;
    try {
      const onRetry = (attempt: number, limit: number) => {
        if (
          activePreparation.current === controller &&
          !controller.signal.aborted &&
          selection.current === selected
        )
          setRetryProgress({ attempt, limit });
      };
      const orientation = await imageOrientation(source, onRetry);
      if (
        controller.signal.aborted ||
        activePreparation.current !== controller ||
        selection.current !== selected
      )
        return;
      const result = await requestAi(
        "ai-remove-background",
        buildImagePreparationRequest(product, {
          image: source,
          backgroundContext,
          orientation,
          retry: regenerate,
          regenerate,
          rejectedImage,
          instructions,
        }),
        controller.signal,
        { onRetry },
      );
      if (
        controller.signal.aborted ||
        activePreparation.current !== controller ||
        selection.current !== selected
      )
        return;
      let metadata: Partial<Product>;
      try {
        metadata = imagePreparationMetadata(result);
      } catch (cause) {
        rejectedPreparedImage.current = result.image;
        throw cause;
      }
      rejectedPreparedImage.current = "";
      setPrepared(result.image);
      setPreparedMetadata(metadata);
      setCutout(true);
    } catch (cause) {
      if (
        !controller.signal.aborted &&
        activePreparation.current === controller &&
        selection.current === selected
      )
        setError(
          (cause instanceof Error ? t(cause.message) : "") ||
            t("AI could not prepare this image."),
        );
    } finally {
      if (activePreparation.current === controller) {
        activePreparation.current = null;
        setBusy(false);
      }
    }
  }

  function apply(original = false) {
    const usePrepared = !original && cutout && Boolean(prepared);
    const applicable = usePrepared ? prepared : source;
    if (!applicable) return;
    cancelPreparation();
    onSave({
      ...(usePrepared
        ? preparedMetadata
        : discardPreparedProductPhoto({
            ...product,
            image: source,
            aiOriginalImage: "",
          })),
      image: applicable,
      ...(product.showImage === false ? { showImage: true } : {}),
      aiOriginalImage: usePrepared ? source : "",
      skipAiCutout: !usePrepared,
    });
    onClose();
  }

  return (
    <Modal
      wide
      title={t("Change product image")}
      kicker={`${product.brand || "PRODUCT"} · ${product.code}`}
      onClose={close}
    >
      <div
        className={`cs-image-editor ${draggingUpload ? "dragging-upload" : ""}`}
        onDragOver={(event) => {
          if ([...event.dataTransfer.types].includes("Files")) {
            event.preventDefault();
            setDraggingUpload(true);
          }
        }}
        onDragLeave={(event) => {
          if (!(
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ))
            setDraggingUpload(false);
        }}
        onDrop={(event) => {
          const file = [...event.dataTransfer.files][0];
          if (file) {
            event.preventDefault();
            setDraggingUpload(false);
            selectUpload(file);
          }
        }}
      >
        <MissingCatalogNotice
          product={product}
          onFindImage={onFindImage}
          canResumeSearch={canResumeSearch}
          onUploadImage={() => {
            setSourceMode("upload");
            uploadInput.current?.click();
          }}
        />
        <p>
          {t(
            "Choose a catalog photo or upload your own. Double-click the image in the brochure anytime to change it again.",
          )}
        </p>
        {isTelevision(product) && onEditScreen && (
          <button
            type="button"
            className="cs-tv-screen-option cs-tv-wallpaper-option"
            aria-label={t("Change TV screen image")}
            onClick={onEditScreen}
          >
            <EditorIcon name="screen" />
            <span>
              <strong>{t("Change the picture inside this TV")}</strong>
              <small>
                {t(
                  "Upload or choose a wallpaper for this TV or all TVs. The frame and inch label stay visible.",
                )}
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        )}
        {onEditArtwork && (
          <button
            type="button"
            className="cs-tv-screen-option cs-add-image-layer-option"
            aria-label={t("Add image layer")}
            onClick={onEditArtwork}
          >
            <EditorIcon name="image" />
            <span>
              <strong>{t("Add image layer")}</strong>
              <small>
                {t(
                  "Place another image over this product. Move and resize it without replacing the product photo.",
                )}
              </small>
            </span>
            <span aria-hidden="true">+</span>
          </button>
        )}
        <div className="cs-image-drop-hint">
          {t("Drop an image here or choose a photo below")}
        </div>
        <div className="cs-image-editor-grid">
          <div>
            <div
              className="cs-image-source-tabs"
              role="group"
              aria-label={t("Product image source")}
            >
              {(
                [
                  ["catalog", "Product photos"],
                  ["saved", "Saved images"],
                  ["upload", "Upload image"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={sourceMode === mode}
                  onClick={() => setSourceMode(mode)}
                >
                  {mode === "catalog" ? (
                    <EditorIcon name="image" />
                  ) : (
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {mode === "saved" ? (
                        <>
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </>
                      ) : (
                        <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
                      )}
                    </svg>
                  )}
                  {t(label)}
                </button>
              ))}
            </div>
            <div hidden={sourceMode !== "catalog"}>
              <strong>{t("Available product photos")}</strong>
              {catalogPhotos.loading && (
                <p role="status">{t("Loading product photos…")}</p>
              )}
              {catalogPhotos.error && (
                <p role="alert">
                  {t("Could not load product photos.")}{" "}
                  <Button onClick={catalogPhotos.retry}>{t("Retry")}</Button>
                </p>
              )}
              <div className="cs-image-choices">
                {choices.map((choice, index) => (
                  <button
                    key={`${choice}-${index}`}
                    type="button"
                    className={source === choice ? "selected" : ""}
                    onClick={() => {
                      chooseSource(
                        choice,
                        choice === foundSource ? "search" : "catalog",
                      );
                    }}
                    aria-label={`${t("Product photo")} ${index + 1}`}
                    aria-pressed={source === choice}
                  >
                    <img
                      src={resolveAsset(choice)}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
                {!choices.length && (
                  <span>
                    {t("No catalog photos available. Upload one below.")}
                  </span>
                )}
              </div>
            </div>
            {sourceMode === "saved" && (
              <section className="cs-editor-saved-images">
                <p>{t("Saved logos and images from your workspace.")}</p>
                <SavedImageChoices
                  settings={settings}
                  selected={source}
                  onSelect={(asset) => {
                    chooseSource(asset.url, "library");
                  }}
                />
              </section>
            )}
            <div className="cs-image-upload" hidden={sourceMode !== "upload"}>
              <span>{t("Upload another image")}</span>
              <FileUpload
                inputRef={uploadInput}
                accept="image/*"
                aria-label={t("Upload another image")}
                onChange={(event) => selectUpload(event.target.files?.[0])}
              >
                {t("Choose image")}
              </FileUpload>
            </div>
            <p className="cs-image-processing-hint">
              {t(
                "Use the selected photo immediately, or remove its background to preview the result first.",
              )}
            </p>
          </div>
          <div className="cs-image-preview-panel">
            <strong>
              {cutout && prepared ? t("Prepared image") : t("Selected image")}
            </strong>
            <div className="cs-image-preview">
              {(cutout && prepared) || source ? (
                <img
                  src={resolveAsset((cutout && prepared) || source)}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{t("Choose a photo")}</span>
              )}
            </div>
            {prepared && (
              <div
                className="cs-image-version-options"
                role="group"
                aria-label={t("Image version")}
              >
                <button
                  type="button"
                  aria-pressed={!cutout}
                  onClick={() => {
                    cancelPreparation();
                    setCutout(false);
                  }}
                >
                  {t("Original photo")}
                </button>
                <button
                  type="button"
                  aria-pressed={cutout}
                  onClick={() => setCutout(true)}
                >
                  {t("Background removed")}
                </button>
              </div>
            )}
            {cutout && (
              <small>
                {t(
                  "Check that every part of the product is visible before using the image.",
                )}
              </small>
            )}
            <label className="cs-image-repair-note">
              <span>{t("Describe what needs fixing")}</span>
              <textarea
                aria-label={t("Describe what needs fixing")}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={t(
                  "For example: remove the white border and keep the entire product, including its stand.",
                )}
                disabled={busy}
              />
              <small>
                {t(
                  "Keep the model, colors, labels and all product parts unchanged.",
                )}
              </small>
            </label>
            {error && (
              <p className="cs-image-error" role="alert">
                {error}
              </p>
            )}
            {busy && (
              <div className="cs-image-progress" role="status">
                <i />
                {retryProgress
                  ? `${t("Retrying photo")} · ${retryProgress.attempt}/${retryProgress.limit}`
                  : t("AI is removing the background…")}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="cs-modal-actions cs-image-editor-actions">
        {product.image && product.showImage !== false && (
          <Button
            onClick={() => {
              cancelPreparation();
              onSave({
                image: product.image!,
                aiOriginalImage: product.aiOriginalImage || "",
                skipAiCutout: Boolean(product.skipAiCutout),
                showImage: false,
              });
              onClose();
            }}
          >
            {t("Remove image")}
          </Button>
        )}
        <Button onClick={prepare} disabled={!source || busy}>
          {busy
            ? t("Preparing image…")
            : error
              ? t("Retry background removal")
              : prepared || product.aiOriginalImage
                ? t("Remove background again")
                : t("Remove background")}
        </Button>
        {(busy || (prepared && cutout)) && (
          <Button onClick={() => apply(true)} disabled={!source}>
            {t("Use original photo")}
          </Button>
        )}
        <Button
          tone="primary"
          disabled={!source || busy}
          onClick={() => apply()}
        >
          {t("Use this image")}
        </Button>
      </div>
    </Modal>
  );
}

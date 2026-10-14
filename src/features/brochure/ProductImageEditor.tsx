import { requestAi } from "../ai/ai.api";
import type { Product } from "../../domain/models";
import { useCatalogPhotos } from "../products/useCatalogPhotos";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal } from "./Modals";
import { t } from "./i18n";
import { readImage } from "./utils";
import {
  MissingCatalogNotice,
  imageSearchState,
  missingCatalogCodes,
} from "./MissingCatalogNotice";
import {
  buildImagePreparationRequest,
  imageBackgroundSignature,
  imagePreparationMetadata,
  IMAGE_PREPARATION_REVISION,
  needsImagePreparation,
} from "./imageReview";

function orientationOf(source: string) {
  return new Promise<"landscape" | "portrait" | "square">((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve(
        image.naturalWidth > image.naturalHeight * 1.2
          ? "landscape"
          : image.naturalHeight > image.naturalWidth * 1.2
            ? "portrait"
            : "square",
      );
    image.onerror = () => resolve("square");
    image.src = source;
  });
}

export function ProductImageEditor({
  product,
  catalogProduct,
  backgroundContext,
  onSave,
  onClose,
  onFindImage,
  canResumeSearch = false,
}: {
  product: Product;
  catalogProduct?: Product;
  backgroundContext?: unknown;
  onSave: (changes: Partial<Product>) => void;
  onClose: () => void;
  onFindImage?: () => void | Promise<void>;
  canResumeSearch?: boolean;
}) {
  const catalogPhotos = useCatalogPhotos(catalogProduct);
  const photoProduct = catalogPhotos.product;
  const search = imageSearchState(product);
  const foundSource =
    search?.status === "found" ? product.image || search.imageUrl || "" : "";
  const unknownProduct = Boolean(
    product.catalogMissing ||
    missingCatalogCodes(product).length ||
    !catalogProduct,
  );
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
  const [kind, setKind] = useState(
    foundSource && !product.aiOriginalImage
      ? "search"
      : product.skipAiCutout
        ? "upload"
        : "catalog",
  );
  const backgroundSignature = imageBackgroundSignature(backgroundContext);
  const savedDeclined =
    !product.aiOriginalImage &&
    product.aiReviewedImageSource === source &&
    product.aiReviewedPreparationRevision === IMAGE_PREPARATION_REVISION &&
    product.aiReviewedBackgroundSignature === backgroundSignature;
  const [cutout, setCutout] = useState(
    !product.skipAiCutout &&
      !savedDeclined &&
      (Boolean(product.aiOriginalImage) || (!unknownProduct && !foundSource)),
  );
  const savedPrepared =
    cutout &&
    source === product.aiOriginalImage &&
    !needsImagePreparation(product, backgroundContext || { kind: "none" })
      ? product.image
      : !cutout && source === product.image
        ? source
        : "";
  const [prepared, setPrepared] = useState(savedPrepared ?? "");
  const [preparedMetadata, setPreparedMetadata] = useState<Partial<Product>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draggingUpload, setDraggingUpload] = useState(false);
  const selection = useRef("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const lastFound = useRef(foundSource);
  selection.current = JSON.stringify([source, cutout, backgroundSignature]);
  useEffect(() => {
    if (!source && choices[0]) {
      setSource(choices[0]);
      setCutout(false);
    }
    if (foundSource && foundSource !== lastFound.current && kind !== "upload") {
      setSource(foundSource);
      setKind("search");
      setCutout(false);
    }
    lastFound.current = foundSource;
  }, [choices, source, foundSource, kind]);
  useEffect(() => {
    setPrepared(savedPrepared ?? "");
    setPreparedMetadata(
      savedPrepared && cutout
        ? Object.fromEntries(
            [
              "aiInchesEmbedded",
              "aiAnnotationStyle",
              "aiPreparedScreenInches",
              "aiPreparationRevision",
              "aiBackgroundSignature",
            ].map((key) => [key, product[key as keyof Product]]),
          )
        : {},
    );
    setError("");
  }, [source, cutout, savedPrepared, backgroundSignature]);

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
      setSource(await readImage(file));
      setKind("upload");
      setCutout(false);
    } catch {
      setError(t("Could not read this image."));
    }
  }

  async function prepare() {
    if (!source || busy) return;
    setError("");
    setBusy(true);
    const selected = selection.current;
    try {
      if (!cutout) {
        setPrepared(source);
        setPreparedMetadata({});
        return;
      }
      const result = await requestAi(
        "ai-remove-background",
        buildImagePreparationRequest(product, {
          image: source,
          backgroundContext,
          orientation: await orientationOf(source),
          retry: Boolean(prepared),
        }),
      );
      if (selection.current !== selected) return;
      setPrepared(result.image);
      setPreparedMetadata(imagePreparationMetadata(result));
    } catch (cause) {
      setError(
        (cause instanceof Error ? cause.message : "") ||
          t("AI could not prepare this image."),
      );
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    const applicable = prepared || (!cutout ? source : "");
    if (!applicable) return;
    onSave({
      image: applicable,
      ...(product.showImage === false ? { showImage: true } : {}),
      aiOriginalImage: cutout ? source : "",
      skipAiCutout: !cutout,
      ...(cutout ? preparedMetadata : {}),
    });
    onClose();
  }

  return (
    <Modal
      wide
      title={t("Change product image")}
      kicker={`${product.brand || "PRODUCT"} · ${product.code}`}
      onClose={() => {
        if (!busy) onClose();
      }}
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
          onUploadImage={() => uploadInput.current?.click()}
        />
        <p>
          {t(
            "Choose a catalog photo or upload your own. Click the image in the brochure anytime to change it again.",
          )}
        </p>
        <div className="cs-image-drop-hint">
          {t("Drop an image here or choose a photo below")}
        </div>
        <div className="cs-image-editor-grid">
          <div>
            <strong>{t("Available product photos")}</strong>
            {catalogPhotos.loading && <p role="status">{t("Loading product photos…")}</p>}
            {catalogPhotos.error && <p role="alert">{t("Could not load product photos.")} <Button onClick={catalogPhotos.retry}>{t("Retry")}</Button></p>}
            <div className="cs-image-choices">
              {choices.map((choice, index) => (
                <button
                  key={`${choice}-${index}`}
                  type="button"
                  className={
                    source === choice && kind === "catalog" ? "selected" : ""
                  }
                  onClick={() => {
                    setSource(choice);
                    setKind(choice === foundSource ? "search" : "catalog");
                    setCutout(!unknownProduct && choice !== foundSource);
                  }}
                  aria-label={`${t("Product photo")} ${index + 1}`}
                  aria-pressed={source === choice && kind === "catalog"}
                >
                  <img src={choice} alt="" referrerPolicy="no-referrer" />
                </button>
              ))}
              {!choices.length && (
                <span>
                  {t("No catalog photos available. Upload one below.")}
                </span>
              )}
            </div>
            <label className="cs-image-upload">
              <span>{t("Upload another image")}</span>
              <span className="cs-image-upload-button">
                ↑ {t("Choose image")}
              </span>
              <input
                ref={uploadInput}
                type="file"
                accept="image/*"
                aria-label={t("Upload another image")}
                onChange={(event) => selectUpload(event.target.files?.[0])}
              />
            </label>
            <label className="cs-image-cutout">
              <input
                type="checkbox"
                checked={cutout}
                onChange={(event) => setCutout(event.target.checked)}
              />
              <span>
                <strong>{t("Remove background with AI")}</strong>
                <small>
                  {kind === "catalog" && !unknownProduct
                    ? t("On by default for catalog photos.")
                    : t(
                        "Optional. Finding or uploading a photo does not prepare it with AI.",
                      )}
                </small>
              </span>
            </label>
          </div>
          <div className="cs-image-preview-panel">
            <strong>
              {prepared ? t("Prepared image") : t("Selected image")}
            </strong>
            <div className="cs-image-preview">
              {prepared || source ? (
                <img
                  src={prepared || source}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{t("Choose a photo")}</span>
              )}
            </div>
            {cutout && (
              <small>
                {t(
                  "Check that every part of the product is visible before using the image.",
                )}
              </small>
            )}
            {error && (
              <p className="cs-image-error" role="alert">
                {error}
              </p>
            )}
            {busy && (
              <div className="cs-image-progress" role="status">
                <i />
                {t("AI is removing the background…")}
              </div>
            )}
            <div className="cs-image-editor-actions">
              {product.image && product.showImage !== false && <Button disabled={busy} onClick={() => { onSave({ image: product.image!, aiOriginalImage: product.aiOriginalImage || "", skipAiCutout: Boolean(product.skipAiCutout), showImage: false }); onClose(); }}>{t("Remove image")}</Button>}
              <Button onClick={prepare} disabled={!source || busy}>
                {busy
                  ? t("Preparing image…")
                  : savedPrepared && prepared === savedPrepared && cutout
                    ? t("Re-cut with AI")
                    : prepared
                      ? t("Prepare again")
                      : t("Prepare image")}
              </Button>
              <Button
                tone="primary"
                disabled={!(prepared || (!cutout && source)) || busy}
                onClick={apply}
              >
                {t("Use this image")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

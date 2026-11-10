import { SearchableSelect } from "../../components/SearchableSelect";
import type { Campaign, Product, Settings } from "../../domain/models";
import { resolveAsset } from "../../api/client";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { toCanvas, getFontEmbedCSS } from "html-to-image";
import type { toCanvas as HtmlToImageToCanvas } from "html-to-image";
import React, { useMemo, useRef, useState } from "react";
import { CoverPage, ProductPage, splitPages, StoresPage } from "./Brochure";
import { Button, Modal } from "./Modals";
import { t } from "./i18n";
import { brochurePageCount, includesStoresPage } from "./storesSelection";
import {
  brochureExportGeometry,
  resolveBrochureFormat,
} from "./brochureFormat";
import { coverProducts } from "./campaignPages";
import { productPdfLinks } from "./pdfProductLinks";

function exportImageUrl(value: string): string;
function exportImageUrl(value: undefined): undefined;
function exportImageUrl(value: string | undefined): string | undefined;
function exportImageUrl(value: string | undefined): string | undefined {
  if (typeof value !== "string" || !value.startsWith("https://")) return value;
  try {
    const url = new URL(value);
    return /(?:^|\.)neptun-ks\.com$/i.test(url.hostname)
      ? resolveAsset(`/api/export-image?url=${encodeURIComponent(value)}`)
      : value;
  } catch {
    return value;
  }
}

function exportProductImages(product: Product, member = false): Product {
  return {
    ...product,
    image: exportImageUrl(
      member
        ? product.image || product.localImage || product.imageUrl
        : product.image,
    ),
    ...(Array.isArray(product.bundleProducts)
      ? {
          bundleProducts: product.bundleProducts.map((child) =>
            exportProductImages(child, true),
          ),
        }
      : {}),
    ...(Array.isArray(product.productArtworks)
      ? {
          productArtworks: product.productArtworks.map((item) => ({
            ...item,
            image: exportImageUrl(item.image),
          })),
        }
      : {}),
    ...(product.screenArtwork
      ? {
          screenArtwork: {
            ...product.screenArtwork,
            image: exportImageUrl(product.screenArtwork.image),
          },
        }
      : {}),
  };
}

export function exportCampaignImages(campaign: Campaign): Campaign {
  return {
    ...campaign,
    coverImage: exportImageUrl(campaign.coverImage),
    coverLogoSource: exportImageUrl(campaign.coverLogoSource),
    ...Object.fromEntries(
      (["cover", "product", "stores"] as const).map((key) => [
        `${key}BackgroundImage`,
        exportImageUrl(campaign[`${key}BackgroundImage`]),
      ]),
    ),
    products: (campaign.products || []).map((product: Product) =>
      exportProductImages(product),
    ),
    pages: Object.fromEntries(
      Object.entries(campaign.pages || {}).map(([key, page]) => [
        key,
        {
          ...page,
          image: exportImageUrl(page.image),
          backgroundImage: exportImageUrl(page.backgroundImage),
        },
      ]),
    ),
    brandAssets: Object.fromEntries(
      Object.entries(campaign.brandAssets || {}).map(([key, value]) => [
        key,
        exportImageUrl(value),
      ]),
    ),
    pageArtworks: Object.fromEntries(
      Object.entries(campaign.pageArtworks || {}).map(([key, items]) => [
        key,
        items.map((item) => ({ ...item, image: exportImageUrl(item.image) })),
      ]),
    ),
  };
}

function fileBase(name?: string) {
  return (
    String(name || "brochure")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "brochure"
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error(t("Could not create the image file."))),
      type,
      quality,
    ),
  );
}

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

const blankExportImage =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Only the temporary export stage is changed; keep the missing photo's space. */
function blankUnavailableImage(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  if (rect.width > 0) image.style.width = `${rect.width}px`;
  if (rect.height > 0) image.style.height = `${rect.height}px`;
  image.style.boxSizing = "border-box";
  image.style.visibility = "hidden";
  image.removeAttribute("srcset");
  image.src = blankExportImage;
}

export async function readyImages(root: HTMLElement) {
  await document.fonts.ready;
  const images = [...root.querySelectorAll("img")];
  const unavailable: HTMLImageElement[] = [];
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            resolve();
          };
          const timer = setTimeout(finish, 10_000);
          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
          if (image.complete) finish();
        });
      }
      if (!image.complete || !image.naturalWidth) {
        unavailable.push(image);
        blankUnavailableImage(image);
        return;
      }
      // The load event establishes readiness. A browser decode rejection must
      // not prevent the other products and prices from being downloaded.
      if (image.decode)
        await image.decode().catch(() => {
          unavailable.push(image);
          blankUnavailableImage(image);
        });
    }),
  );
  await nextFrame();
  return unavailable;
}

export function missingExportPhotos(
  products: readonly Product[],
  page: string,
): string[] {
  return products.flatMap((offer) =>
    (offer.bundleProducts?.length ? offer.bundleProducts : [offer])
      .filter(
        (product) =>
          product.showImage !== false &&
          !(product.image || product.localImage || product.imageUrl),
      )
      .map((product) => `${page} · ${product.name} (${product.code})`),
  );
}

/** html-to-image skips SVG descendants when detecting used font families. */
export async function brochureExportFontCSS(
  root: HTMLElement,
  embed: (node: HTMLElement) => Promise<string> = getFontEmbedCSS,
) {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error(t("Could not prepare brochure pages."));
  const probes = document.createElement("div");
  probes.hidden = true;
  probes.setAttribute("data-export-hide", "true");
  const families = new Set<string>();
  for (const node of [root, ...root.querySelectorAll("*")]) {
    const family = view.getComputedStyle(node).fontFamily;
    if (!family || families.has(family)) continue;
    families.add(family);
    const probe = document.createElement("span");
    probe.style.fontFamily = family;
    probes.append(probe);
  }
  root.append(probes);
  try {
    const css = await embed(root);
    if (
      /url\(\s*["']?\s*["']?\s*\)/i.test(css) ||
      (!css &&
        [...families].some((family) =>
          /TSTAR|SkolaSans|Cera Pro/i.test(family),
        ))
    )
      throw new Error(
        t("Brochure fonts could not be loaded. Please retry the download."),
      );
    return css;
  } finally {
    probes.remove();
  }
}

export function preserveExportTypography(page: HTMLElement) {
  const document = page.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error(t("Could not prepare brochure pages."));
  const attribute = "data-brochure-export-font";
  const nodes = [page, ...page.querySelectorAll("*")];
  const rules: string[] = [];
  const previous: Array<[Element, string | null]> = [];
  const prefix = `font-${Date.now().toString(36)}`;
  nodes.forEach((node, index) => {
    const computed = view.getComputedStyle(node);
    const size = computed.fontSize;
    if (!/^\d+(?:\.\d+)?px$/.test(size)) return;
    previous.push([node, node.getAttribute(attribute)]);
    const id = `${prefix}-${index}`;
    node.setAttribute(attribute, id);
    const typography = document.createElement("span").style;
    for (const property of [
      "font-size",
      "font-family",
      "font-weight",
      "font-style",
      "font-stretch",
      "letter-spacing",
      "line-height",
    ]) {
      const value = computed.getPropertyValue(property);
      if (value) typography.setProperty(property, value, "important");
    }
    rules.push(`[${attribute}="${id}"]{${typography.cssText}}`);
  });
  const style = document.createElement("style");
  // html-to-image rounds computed font sizes down when cloning in some
  // browsers. Pin HTML and SVG typography to the same computed preview values.
  style.textContent = rules.join("\n");
  page.appendChild(style);
  return () => {
    style.remove();
    previous.forEach(([node, value]) =>
      value === null
        ? node.removeAttribute(attribute)
        : node.setAttribute(attribute, value),
    );
  };
}

export async function captureBrochurePage(
  page: HTMLElement,
  geometry: ReturnType<typeof brochureExportGeometry>,
  {
    toCanvas,
    fontEmbedCSS,
    onUnavailableImage,
  }: {
    toCanvas: typeof HtmlToImageToCanvas;
    fontEmbedCSS?: string;
    onUnavailableImage?: (image?: Element) => void;
  },
) {
  const rect = page.getBoundingClientRect();
  const expectedRatio = geometry.previewWidth / geometry.previewHeight;
  if (
    !(rect.width > 0 && rect.height > 0) ||
    Math.abs(rect.width / rect.height / expectedRatio - 1) > 0.001
  )
    throw new Error(
      t(
        "The brochure preview size does not match the selected format. Please retry.",
      ),
    );
  const restoreTypography = preserveExportTypography(page);
  const resources = new AbortController();
  const timeout = setTimeout(() => {
    resources.abort();
    onUnavailableImage?.();
  }, 15_000);
  try {
    const canvas = await toCanvas(page, {
      // Translucent brochure paint is printed on white paper. This also avoids
      // the browser's black JPEG fallback for transparent canvas pixels.
      backgroundColor: "#ffffff",
      width: rect.width,
      height: rect.height,
      canvasWidth: geometry.canvasWidth,
      canvasHeight: geometry.canvasHeight,
      pixelRatio: geometry.pixelRatio,
      skipAutoScale: true,
      includeQueryParams: true,
      fetchRequestInit: { signal: resources.signal },
      // Covers CSS/SVG resources and a photo that fails during embedding after
      // it had loaded in the export stage. The layout stays intact.
      get imagePlaceholder() {
        // html-to-image reads this only when fetching a resource fails,
        // including CSS backgrounds for which there is no image error event.
        onUnavailableImage?.();
        return blankExportImage;
      },
      onImageErrorHandler: (event) => {
        if (event instanceof Event && event.target instanceof Element) {
          (event.target as HTMLElement | SVGElement).style.visibility =
            "hidden";
          onUnavailableImage?.(event.target);
        }
      },
      filter: (node) =>
        !(node instanceof Element) ||
        node.getAttribute("data-export-hide") !== "true",
      ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
    });
    if (canvas.width !== geometry.width || canvas.height !== geometry.height)
      throw new Error(t("The exported page size is incorrect. Please retry."));
    return canvas;
  } finally {
    clearTimeout(timeout);
    resources.abort();
    restoreTypography();
  }
}

export function brochureExportPageNode(stage: HTMLElement, index: number) {
  return (
    stage.querySelector<HTMLElement>(
      `[data-export-page="${index}"] .brochure-output-page`,
    ) ||
    stage.querySelector<HTMLElement>(
      `[data-export-page="${index}"] .brochure-page`,
    )
  );
}

export function BrochureExport({
  campaign,
  settings,
  initialPage = 0,
  onClose,
}: {
  campaign: Campaign;
  settings: Settings;
  initialPage?: number;
  onClose: () => void;
}) {
  const pages = useMemo(() => splitPages(campaign), [campaign]);
  const exportCampaign = useMemo(
    () => exportCampaignImages(campaign),
    [campaign],
  );
  const exportPages = useMemo(
    () => splitPages(exportCampaign),
    [exportCampaign],
  );
  const hasStoresPage = includesStoresPage(campaign);
  const pageCount = brochurePageCount(campaign, pages.length);
  const pageFormat = resolveBrochureFormat(campaign);
  const geometry = brochureExportGeometry(pageFormat);
  const [format, setFormat] = useState("pdf");
  const [scope, setScope] = useState("all");
  const [pageIndex, setPageIndex] = useState(
    Math.max(0, Math.min(pageCount - 1, initialPage)),
  );
  const [renderIndexes, setRenderIndexes] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [pendingFile, setPendingFile] = useState<{
    blob: Blob;
    filename: string;
  } | null>(null);
  const [unavailablePhotos, setUnavailablePhotos] = useState<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const labels = [
    t("Cover"),
    ...pages.map((_, index) => `${t("Page")} ${index + 2}`),
    ...(hasStoresPage ? [t("Stores & details")] : []),
  ];
  const selectedIndexes =
    scope === "all"
      ? Array.from({ length: pageCount }, (_, index) => index)
      : [pageIndex];
  const knownMissing = selectedIndexes.flatMap((index) =>
    missingExportPhotos(
      index === 0 ? coverProducts(campaign) : pages[index - 1]?.products || [],
      labels[index] || `${t("Page")} ${index + 1}`,
    ),
  );
  const warnings = pendingFile ? unavailablePhotos : knownMissing;
  function resetPreparedDownload() {
    setPendingFile(null);
    setUnavailablePhotos([]);
  }

  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    resetPreparedDownload();
    const indexes =
      scope === "all"
        ? Array.from({ length: pageCount }, (_, index) => index)
        : [pageIndex];
    try {
      const unavailable = new Set(knownMissing);
      let file: { blob: Blob; filename: string } | undefined;
      const base = fileBase(campaign.name);
      let pdf: jsPDF | undefined;
      let zip: JSZip | undefined;
      if (format === "pdf") {
        pdf = new jsPDF({
          orientation: geometry.orientation,
          unit: "mm",
          format: [geometry.pdfWidthMm, geometry.pdfHeightMm],
          compress: true,
        });
      } else if (scope === "all") {
        zip = new JSZip();
      }
      for (let position = 0; position < indexes.length; position += 1) {
        const index = indexes[position];
        if (index === undefined)
          throw new Error(t("Could not prepare brochure pages."));
        // Render one page at a time to avoid holding every
        // product image and page canvas in memory for long brochures.
        setRenderIndexes([index]);
        setProgress(
          `${t("Loading brochure images…")} ${position + 1} / ${indexes.length}`,
        );
        await nextFrame();
        await nextFrame();
        const stage = stageRef.current;
        if (!stage) throw new Error(t("Could not prepare brochure pages."));
        const recordUnavailable = (image?: Element) => {
          const name = image?.getAttribute("alt")?.trim() || t("Page artwork");
          const products =
            index === 0
              ? coverProducts(campaign)
              : pages[index - 1]?.products || [];
          const product = products
            .flatMap((offer) =>
              offer.bundleProducts?.length ? offer.bundleProducts : [offer],
            )
            .find((product) => product.name === name);
          unavailable.add(
            `${labels[index]} · ${name}${product ? ` (${product.code})` : ""}`,
          );
        };
        (await readyImages(stage)).forEach(recordUnavailable);
        // A later page may introduce a font used only by SVG inch labels or
        // price artwork. Never reuse an incomplete first-page font subset.
        const fontEmbedCSS = await brochureExportFontCSS(stage);
        const page = brochureExportPageNode(stage, index);
        if (!page) throw new Error(t("Could not prepare brochure pages."));
        setProgress(
          `${t("Rendering page")} ${position + 1} / ${indexes.length}`,
        );
        await nextFrame();
        const canvas = await captureBrochurePage(page, geometry, {
          toCanvas,
          fontEmbedCSS,
          onUnavailableImage: recordUnavailable,
        });
        if (pdf) {
          if (position)
            pdf.addPage(
              [geometry.pdfWidthMm, geometry.pdfHeightMm],
              geometry.orientation,
            );
          pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.96),
            "JPEG",
            0,
            0,
            geometry.pdfWidthMm,
            geometry.pdfHeightMm,
            undefined,
            "NONE",
          );
          const products =
            index === 0
              ? coverProducts(exportCampaign)
              : exportPages[index - 1]?.products || [];
          for (const link of productPdfLinks(
            page,
            products,
            geometry.pdfWidthMm,
            geometry.pdfHeightMm,
          ))
            pdf.link(link.x, link.y, link.width, link.height, { url: link.url });
        } else {
          const extension = format === "png" ? "png" : "jpg";
          const blob = await canvasBlob(
            canvas,
            format === "png" ? "image/png" : "image/jpeg",
            0.96,
          );
          const filename = `${base}-page-${String(index + 1).padStart(2, "0")}.${extension}`;
          if (zip) zip.file(filename, blob);
          else file = { blob, filename };
        }
        canvas.width = 0;
        canvas.height = 0;
      }
      if (pdf)
        file = {
          blob: pdf.output("blob"),
          filename: `${base}${scope === "all" ? "" : `-page-${String(pageIndex + 1).padStart(2, "0")}`}.pdf`,
        };
      if (zip) {
        setProgress(t("Packing pages…"));
        file = {
          blob: await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 3 },
          }),
          filename: `${base}-${format}-pages.zip`,
        };
      }
      if (!file) throw new Error(t("Could not create the image file."));
      if ([...unavailable].some((item) => !knownMissing.includes(item))) {
        setUnavailablePhotos([...unavailable]);
        setPendingFile(file);
        return;
      }
      saveBlob(file.blob, file.filename);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not export the brochure. Please retry."),
      );
    } finally {
      setProgress("");
      setRenderIndexes([]);
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        title={t("Download brochure")}
        kicker={t("HIGH QUALITY EXPORT")}
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <div className="cs-export-modal">
          <p>
            {t(pageFormat.label)} · {pageFormat.width} × {pageFormat.height} px
            {pageFormat.dpi ? ` · ${pageFormat.dpi} DPI` : ""}.{" "}
            {t("Choose a complete brochure or one page.")}
          </p>
          <div
            className="cs-export-options"
            role="group"
            aria-label={t("File format")}
          >
            {(
              [
                ["pdf", "PDF", t("All pages in one document")],
                ["png", "PNG", t("Lossless image quality")],
                ["jpg", "JPG", t("High quality, smaller files")],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                type="button"
                key={value}
                className={format === value ? "active" : ""}
                aria-pressed={format === value}
                disabled={busy}
                onClick={() => {
                  resetPreparedDownload();
                  setFormat(value);
                }}
              >
                <strong>{label}</strong>
                <small>{hint}</small>
              </button>
            ))}
          </div>
          <div
            className="cs-export-scope"
            role="group"
            aria-label={t("Pages to download")}
          >
            <button
              type="button"
              className={scope === "all" ? "active" : ""}
              aria-pressed={scope === "all"}
              disabled={busy}
              onClick={() => {
                resetPreparedDownload();
                setScope("all");
              }}
            >
              {t("All pages")} <small>({pageCount})</small>
            </button>
            <button
              type="button"
              className={scope === "one" ? "active" : ""}
              aria-pressed={scope === "one"}
              disabled={busy}
              onClick={() => {
                resetPreparedDownload();
                setScope("one");
              }}
            >
              {t("One page")}
            </button>
          </div>
          {scope === "one" && (
            <label className="cs-export-page-select">
              <span>{t("Choose page")}</span>
              <SearchableSelect
                value={pageIndex}
                disabled={busy}
                onChange={(event) => {
                  resetPreparedDownload();
                  setPageIndex(Number(event.target.value));
                }}
              >
                {labels.map((label, index) => (
                  <option key={index} value={index}>
                    {String(index + 1).padStart(2, "0")} · {label}
                  </option>
                ))}
              </SearchableSelect>
            </label>
          )}
          <p className="cs-export-note">
            {scope === "all" && format !== "pdf"
              ? t("All image pages download together as a ZIP file.")
              : scope === "all"
                ? t("One PDF contains every brochure page.")
                : t("The selected page downloads as one file.")}
            {format === "pdf" &&
              ` ${t("Products with a saved Neptun link are clickable in the PDF.")}`}
          </p>
          {error && (
            <p className="cs-export-error" role="alert">
              {error}
            </p>
          )}
          {warnings.length > 0 && (
            <div className="cs-export-missing-photos" role="alert">
              <strong>{t("Some photos are missing or unavailable")}</strong>
              <p>
                {t(
                  "The photos listed below are missing or could not be loaded. Their spaces will stay blank; prices and other content will be included. Download anyway or return to the editor to add the photos.",
                )}
              </p>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {busy && (
            <div className="cs-export-progress" role="status">
              <span className="cs-export-spinner" />
              {progress || t("Preparing export…")}
            </div>
          )}
        </div>
        <div className="cs-export-actions">
          <Button disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            tone="primary"
            disabled={busy}
            onClick={() => {
              if (pendingFile) {
                saveBlob(pendingFile.blob, pendingFile.filename);
                onClose();
              } else void download();
            }}
          >
            {busy
              ? t("Preparing export…")
              : `↓ ${t(warnings.length ? "Download anyway" : "Download")} ${format.toUpperCase()}${scope === "all" && format !== "pdf" ? " ZIP" : ""}`}
          </Button>
        </div>
      </Modal>
      {renderIndexes.length > 0 && (
        <div
          className="cs-export-stage"
          ref={stageRef}
          aria-hidden="true"
          style={{
            "--export-page-width": `${geometry.previewWidth}px`,
            "--export-page-height": `${geometry.previewHeight}px`,
            "--brochure-page-aspect": pageFormat.aspectRatio,
          }}
        >
          {renderIndexes.map((index) => (
            <div
              className="cs-export-sheet"
              data-export-page={index}
              key={index}
            >
              {index === 0 ? (
                <CoverPage campaign={exportCampaign} settings={settings} />
              ) : hasStoresPage && index === pageCount - 1 ? (
                <StoresPage campaign={exportCampaign} settings={settings} />
              ) : exportPages[index - 1] ? (
                <ProductPage
                  campaign={exportCampaign}
                  settings={settings}
                  page={exportPages[index - 1]!}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

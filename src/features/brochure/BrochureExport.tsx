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

async function readyImages(root: HTMLElement) {
  await document.fonts.ready;
  const images = [...root.querySelectorAll("img")];
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }
      if (!image.naturalWidth)
        throw new Error(
          t(
            "A brochure image could not be loaded. Check the product photos and retry.",
          ),
        );
      if (image.decode) await image.decode().catch(() => {});
    }),
  );
  await nextFrame();
}

function preserveExportFontSizes(page: HTMLElement) {
  const document = page.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error(t("Could not prepare brochure pages."));
  const attribute = "data-brochure-export-font";
  const nodes = [page, ...page.querySelectorAll("*")];
  const rules: string[] = [];
  const previous: Array<[Element, string | null]> = [];
  const prefix = `font-${Date.now().toString(36)}`;
  nodes.forEach((node, index) => {
    const size = view.getComputedStyle(node).fontSize;
    if (!/^\d+(?:\.\d+)?px$/.test(size)) return;
    previous.push([node, node.getAttribute(attribute)]);
    const id = `${prefix}-${index}`;
    node.setAttribute(attribute, id);
    rules.push(`[${attribute}="${id}"]{font-size:${size}!important;}`);
  });
  const style = document.createElement("style");
  // html-to-image rounds computed font sizes down when cloning in some
  // browsers. An embedded important rule keeps the preview's exact sizes.
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
  }: { toCanvas: typeof HtmlToImageToCanvas; fontEmbedCSS?: string },
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
  const restoreFontSizes = preserveExportFontSizes(page);
  try {
    const canvas = await toCanvas(page, {
      width: rect.width,
      height: rect.height,
      canvasWidth: geometry.canvasWidth,
      canvasHeight: geometry.canvasHeight,
      pixelRatio: geometry.pixelRatio,
      skipAutoScale: true,
      filter: (node) =>
        !(node instanceof Element) ||
        node.getAttribute("data-export-hide") !== "true",
      ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
    });
    if (canvas.width !== geometry.width || canvas.height !== geometry.height)
      throw new Error(t("The exported page size is incorrect. Please retry."));
    return canvas;
  } finally {
    restoreFontSizes();
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
  const stageRef = useRef<HTMLDivElement>(null);
  const labels = [
    t("Cover"),
    ...pages.map((_, index) => `${t("Page")} ${index + 2}`),
    ...(hasStoresPage ? [t("Stores & details")] : []),
  ];

  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    const indexes =
      scope === "all"
        ? Array.from({ length: pageCount }, (_, index) => index)
        : [pageIndex];
    try {
      let fontEmbedCSS: string | undefined;
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
        await readyImages(stage);
        if (!fontEmbedCSS)
          fontEmbedCSS = await getFontEmbedCSS(stage).catch(() => undefined);
        const page = brochureExportPageNode(stage, index);
        if (!page) throw new Error(t("Could not prepare brochure pages."));
        setProgress(
          `${t("Rendering page")} ${position + 1} / ${indexes.length}`,
        );
        await nextFrame();
        const canvas = await captureBrochurePage(page, geometry, {
          toCanvas,
          fontEmbedCSS,
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
        } else {
          const extension = format === "png" ? "png" : "jpg";
          const blob = await canvasBlob(
            canvas,
            format === "png" ? "image/png" : "image/jpeg",
            0.96,
          );
          const filename = `${base}-page-${String(index + 1).padStart(2, "0")}.${extension}`;
          if (zip) zip.file(filename, blob);
          else saveBlob(blob, filename);
        }
        canvas.width = 0;
        canvas.height = 0;
      }
      if (pdf)
        saveBlob(
          pdf.output("blob"),
          `${base}${scope === "all" ? "" : `-page-${String(pageIndex + 1).padStart(2, "0")}`}.pdf`,
        );
      if (zip) {
        setProgress(t("Packing pages…"));
        saveBlob(
          await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 3 },
          }),
          `${base}-${format}-pages.zip`,
        );
      }
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
                onClick={() => setFormat(value)}
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
              onClick={() => setScope("all")}
            >
              {t("All pages")} <small>({pageCount})</small>
            </button>
            <button
              type="button"
              className={scope === "one" ? "active" : ""}
              aria-pressed={scope === "one"}
              disabled={busy}
              onClick={() => setScope("one")}
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
                onChange={(event) => setPageIndex(Number(event.target.value))}
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
          </p>
          {error && (
            <p className="cs-export-error" role="alert">
              {error}
            </p>
          )}
          {busy && (
            <div className="cs-export-progress" role="status">
              <span className="cs-export-spinner" />
              {progress || t("Preparing export…")}
            </div>
          )}
          <div className="cs-export-actions">
            <Button disabled={busy} onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button tone="primary" disabled={busy} onClick={download}>
              {busy
                ? t("Preparing export…")
                : `↓ ${t("Download")} ${format.toUpperCase()}${scope === "all" && format !== "pdf" ? " ZIP" : ""}`}
            </Button>
          </div>
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

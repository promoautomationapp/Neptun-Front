import { toCanvas } from "html-to-image";
import {
  brochureExportFontCSS,
  preserveExportTypography,
} from "../brochure/BrochureExport";

const nextFrame = (view: Window) =>
  new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));

async function readyImage(image: HTMLImageElement) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let finishLoad: () => void = () => {};
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () =>
        reject(
          new Error(
            "A post image did not finish loading. Check the connection and retry.",
          ),
        ),
      15_000,
    );
  });
  const ready = async () => {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        finishLoad = resolve;
        image.addEventListener("load", finishLoad, { once: true });
        image.addEventListener("error", finishLoad, { once: true });
      });
    }
    if (!image.naturalWidth)
      throw new Error(
        "A post image could not be loaded. Check the product photos and retry.",
      );
    await image.decode?.().catch(() => {});
  };
  try {
    await Promise.race([ready(), deadline]);
  } finally {
    clearTimeout(timeout);
    image.removeEventListener("load", finishLoad);
    image.removeEventListener("error", finishLoad);
  }
}

/** Capture an already mounted React canvas at its requested output dimensions.
 * A live render lets detail fitting and divider measurements run at output size;
 * a resized DOM clone retains the preview's measured pixel coordinates.
 */
export async function captureSocialPost(
  node: HTMLElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > 67_000_000
  )
    throw new Error("Choose a valid social post export size.");
  const view = node.ownerDocument.defaultView;
  if (!node.isConnected || !view)
    throw new Error("The post export canvas is not ready. Please retry.");

  await node.ownerDocument.fonts?.ready;
  await Promise.all([...node.querySelectorAll("img")].map(readyImage));
  // Font/image readiness can trigger React layout effects and ResizeObserver.
  // Let their measured styles and the following React commit both settle.
  await nextFrame(view);
  await nextFrame(view);
  const rect = node.getBoundingClientRect();
  if (
    !node.isConnected ||
    Math.abs(rect.width - width) > 0.5 ||
    Math.abs(rect.height - height) > 0.5
  )
    throw new Error(
      "The post export canvas does not match the selected size. Please retry.",
    );

  const fontEmbedCSS = await brochureExportFontCSS(node);
  const restoreTypography = preserveExportTypography(node);
  try {
    const canvas = await toCanvas(node, {
      width,
      height,
      pixelRatio: 1,
      skipAutoScale: true,
      cacheBust: false,
      fontEmbedCSS,
      filter: (element) =>
        !(element instanceof Element) ||
        element.getAttribute("data-export-hide") !== "true",
    });
    if (canvas.width !== width || canvas.height !== height)
      throw new Error(
        "The exported post size is incorrect. Please retry the download.",
      );
    return canvas;
  } finally {
    restoreTypography();
  }
}

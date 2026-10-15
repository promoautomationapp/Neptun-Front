import { API_URL } from "../../api/client";
import { t } from "../brochure/i18n";

const IMAGE_LOAD_TIMEOUT_MS = 15_000;

/** AI assets have already been decoded and validated by the backend. Loading
 * their pixels again must not hold up saving the result or cause regeneration. */
function storedAiAsset(source: string) {
  try {
    const api = new URL(API_URL || window.location.origin);
    const image = new URL(source, api);
    return (
      image.origin === api.origin &&
      /^\/api\/assets\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
        image.pathname,
      )
    );
  } catch {
    return false;
  }
}

export function inspectImage(source: string) {
  if (storedAiAsset(source)) return Promise.resolve(source);
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "use-credentials";
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(source);
    };
    const timer = setTimeout(() => {
      finish(new Error(t("Could not open the edited image.")));
      image.src = "";
    }, IMAGE_LOAD_TIMEOUT_MS);
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error(t("Could not inspect the edited image."));
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let transparent = 0;
        let visible = 0;
        for (let index = 3; index < pixels.length; index += 16) {
          if ((pixels[index] ?? 255) < 20) transparent += 1;
          if ((pixels[index] ?? 0) > 230) visible += 1;
        }
        if (!transparent || !visible)
          throw new Error(
            t("AI did not return a usable transparent product image."),
          );
        finish();
      } catch (error) {
        finish(error);
      }
    };
    image.onerror = () =>
      finish(new Error(t("Could not open the edited image.")));
    image.src = source;
  });
}

export function imageOrientation(source: string) {
  return new Promise<"landscape" | "portrait" | "square">((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "use-credentials";
    const finish = (orientation?: "landscape" | "portrait" | "square") => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (orientation) resolve(orientation);
      else reject(new Error(t("Could not open the edited image.")));
    };
    const timer = setTimeout(() => {
      finish();
      image.src = "";
    }, IMAGE_LOAD_TIMEOUT_MS);
    image.onload = () =>
      finish(
        image.naturalWidth > image.naturalHeight * 1.2
          ? "landscape"
          : image.naturalHeight > image.naturalWidth * 1.2
            ? "portrait"
            : "square",
      );
    image.onerror = () => finish();
    image.src = source;
  });
}

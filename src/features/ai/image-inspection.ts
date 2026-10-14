import { t } from "../brochure/i18n";
export function inspectImage(source: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "use-credentials";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context)
        return reject(new Error(t("Could not inspect the edited image.")));
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
        return reject(
          new Error(t("AI did not return a usable transparent product image.")),
        );
      resolve(source);
    };
    image.onerror = () =>
      reject(new Error(t("Could not open the edited image.")));
    image.src = source;
  });
}

export function imageOrientation(source: string) {
  return new Promise<"landscape" | "portrait" | "square">((resolve) => {
    const image = new Image();
    image.crossOrigin = "use-credentials";
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

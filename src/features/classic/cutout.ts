(() => {
  "use strict";
  async function removePlainBackground(source: string) {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(
      1,
      1000 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable for the demo cutout.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = frame.data;
    const width = canvas.width,
      height = canvas.height,
      count = width * height;
    const visited = new Uint8Array(count),
      queue = new Uint32Array(count);
    let head = 0,
      tail = 0,
      removed = 0;
    const candidate = (index: number) => {
      const offset = index * 4;
      const r = pixels[offset] ?? 0,
        g = pixels[offset + 1] ?? 0,
        b = pixels[offset + 2] ?? 0;
      return (
        Math.min(r, g, b) >= 235 && Math.max(r, g, b) - Math.min(r, g, b) <= 22
      );
    };
    const add = (index: number) => {
      if (visited[index] || !candidate(index)) return;
      visited[index] = 1;
      queue[tail++] = index;
    };
    for (let x = 0; x < width; x++) {
      add(x);
      add((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      add(y * width);
      add(y * width + width - 1);
    }
    while (head < tail) {
      const index = queue[head++]!,
        offset = index * 4;
      pixels[offset + 3] = 0;
      removed++;
      const x = index % width,
        y = Math.floor(index / width);
      if (x > 0) add(index - 1);
      if (x + 1 < width) add(index + 1);
      if (y > 0) add(index - width);
      if (y + 1 < height) add(index + width);
    }
    if (removed / count < 0.02)
      throw new Error(
        "This photo has no plain light background to remove in the demo.",
      );
    context.putImageData(frame, 0, 0);
    return canvas.toDataURL("image/png");
  }
  window.neptunDemoCutout = removePlainBackground;
})();

declare global {
  interface Window {
    neptunDemoCutout: (source: string) => Promise<string>;
  }
}

export {};

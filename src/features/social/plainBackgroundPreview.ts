// A quick preview for catalog photos on a plain white background. The AI cutout
// still replaces this image when it finishes; this only clears connected white
// pixels at the edge and never tries to infer a product silhouette.
export async function plainBackgroundPreview(
  source: string,
): Promise<string | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = source;
  await image.decode();
  const scale = Math.min(
    1,
    900 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = frame.data;
  const { width, height } = canvas;
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let head = 0;
  let tail = 0;
  const add = (index: number) => {
    if (visited[index]) return;
    const offset = index * 4;
    const r = pixels[offset],
      g = pixels[offset + 1],
      b = pixels[offset + 2];
    if (r === undefined || g === undefined || b === undefined) return;
    if (Math.min(r, g, b) < 232 || Math.max(r, g, b) - Math.min(r, g, b) > 24)
      return;
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
    const index = queue[head++];
    if (index === undefined) continue;
    pixels[index * 4 + 3] = 0;
    const x = index % width;
    if (x) add(index - 1);
    if (x < width - 1) add(index + 1);
    if (index >= width) add(index - width);
    if (index < count - width) add(index + width);
  }
  if (tail / count < 0.03) return null;
  context.putImageData(frame, 0, 0);
  return canvas.toDataURL("image/png");
}

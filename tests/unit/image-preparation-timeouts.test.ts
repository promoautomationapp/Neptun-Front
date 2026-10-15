import { afterEach, expect, it, vi } from "vitest";
import {
  imageOrientation,
  inspectImage,
} from "../../src/features/ai/image-inspection";
import {
  createProductImagePreparationQueue,
  productImagePreparationTargets,
} from "../../src/features/brochure/productImagePreparationQueue";
import type { Campaign } from "../../src/domain/models";

class PendingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = "";
  src = "";
  naturalWidth = 200;
  naturalHeight = 400;
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("falls back when a catalog image never loads, allowing all queued products to finish", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Image", PendingImage);
  const prepared = "/api/assets/00000000-0000-4000-8000-000000000001";
  const prepare = vi.fn(async (_body: { orientation: string }) => ({
    image: prepared,
  }));
  const apply = vi.fn();
  const campaign = {
    id: "load-timeouts",
    products: Array.from({ length: 12 }, (_, index) => ({
      code: String(index),
      name: `Product ${index}`,
      image: `/catalog-${index}.png`,
    })),
  } as Campaign;
  const queue = createProductImagePreparationQueue({ prepare });
  const jobs = productImagePreparationTargets(campaign).map((target) =>
    queue.enqueue(target, apply),
  );
  expect(prepare).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(90_000);
  expect(
    (await Promise.all(jobs)).every(
      (outcome) => !outcome.ok && outcome.usingOriginal,
    ),
  ).toBe(true);
  expect(prepare).not.toHaveBeenCalled();
  expect(apply).not.toHaveBeenCalled();
});

it("saves validated backend AI assets without waiting for another browser image download", async () => {
  const image = vi.fn(() => new PendingImage());
  vi.stubGlobal("Image", image);
  const source = "/api/assets/00000000-0000-4000-8000-000000000002";
  expect(await inspectImage(source)).toBe(source);
  expect(image).not.toHaveBeenCalled();
});

it("does not trust another origin merely because its path looks like a stored asset", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Image", PendingImage);
  const result = inspectImage(
    "https://untrusted.example/api/assets/00000000-0000-4000-8000-000000000002",
  );
  const rejected = expect(result).rejects.toBeInstanceOf(Error);
  await vi.advanceTimersByTimeAsync(15_000);
  await rejected;
});

it("cleans up timed-out orientation handlers so a late image response cannot alter the outcome", async () => {
  vi.useFakeTimers();
  const image = new PendingImage();
  vi.stubGlobal(
    "Image",
    vi.fn(function () {
      return image;
    }),
  );
  const result = imageOrientation("/offline-image.png");
  const rejected = expect(result).rejects.toBeInstanceOf(Error);
  await vi.advanceTimersByTimeAsync(15_000);
  await rejected;
  expect(image.onload).toBeNull();
  expect(image.onerror).toBeNull();
  expect(image.src).toBe("");
});

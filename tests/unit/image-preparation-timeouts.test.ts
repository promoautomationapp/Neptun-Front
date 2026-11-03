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
  await vi.advanceTimersByTimeAsync(396_000);
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

it("retries a timed-out source three times, reports progress, and never starts provider work for inaccessible sources", async () => {
  vi.useFakeTimers();
  const images: PendingImage[] = [];
  vi.stubGlobal(
    "Image",
    vi.fn(function () {
      const image = new PendingImage();
      images.push(image);
      return image;
    }),
  );
  const retry = vi.fn();
  const result = imageOrientation("/timeout.png", retry);
  const rejected = expect(result).rejects.toBeInstanceOf(Error);
  await vi.advanceTimersByTimeAsync(66_000);
  await rejected;
  expect(retry.mock.calls).toEqual([
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  expect(images).toHaveLength(4);
  expect(
    images.every(
      (image) =>
        image.onload === null && image.onerror === null && image.src === "",
    ),
  ).toBe(true);
});
it("recovers source loading on retry, preserving the measured orientation", async () => {
  vi.useFakeTimers();
  const images: PendingImage[] = [];
  vi.stubGlobal(
    "Image",
    vi.fn(function () {
      const image = new PendingImage();
      images.push(image);
      return image;
    }),
  );
  const retry = vi.fn();
  const result = imageOrientation("/slow.png", retry);
  await vi.advanceTimersByTimeAsync(16_000);
  expect(images).toHaveLength(2);
  images[1]!.onload!();
  expect(await result).toBe("portrait");
  expect(retry).toHaveBeenCalledOnce();
});
it("does not retry a source that definitively fails to load", async () => {
  const image = new PendingImage();
  vi.stubGlobal(
    "Image",
    vi.fn(function () {
      return image;
    }),
  );
  const retry = vi.fn();
  const result = imageOrientation("/missing.png", retry);
  const rejected = expect(result).rejects.toBeInstanceOf(Error);
  image.onerror!();
  await rejected;
  expect(retry).not.toHaveBeenCalled();
});
it("forwards source and durable-job retries as progress without duplicate preparations", async () => {
  const target = productImagePreparationTargets({
    id: "retry",
    products: [{ code: "tv", name: "TV", image: "/source.png" }],
  } as Campaign)[0]!;
  const onPhase = vi.fn(),
    apply = vi.fn();
  const prepare = vi.fn(async (_body, onRetry) => {
    onRetry?.(2, 3);
    return { image: "/cutout.png" };
  });
  const queue = createProductImagePreparationQueue({
    orientation: async (_source, onRetry) => {
      onRetry?.(1, 3);
      return "square";
    },
    prepare,
    inspect: async (source) => source,
  });
  expect((await queue.enqueue(target, apply, { onPhase })).ok).toBe(true);
  expect(onPhase.mock.calls).toEqual([
    ["preparing"],
    ["retrying", { attempt: 1, limit: 3 }],
    ["retrying", { attempt: 2, limit: 3 }],
    ["saving"],
  ]);
  expect(prepare).toHaveBeenCalledOnce();
  expect(apply).toHaveBeenCalledOnce();
});

import { expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  applyPreparedProductPhoto,
  createProductImagePreparationQueue,
  currentProductPhotoTarget,
  productImagePreparationTargets,
} from "../../src/features/brochure/productImagePreparationQueue";

const campaign = (...codes: string[]): Campaign => ({
  id: "cost-policy",
  name: "Offers",
  productBackgroundColor: "#ffffff",
  products: codes.map((code) => ({
    code,
    name: code,
    image: `/${code}.png`,
    brochurePage: 2,
  })),
});

it("refuses an unverified output before changing the document and continues with the next photo", async () => {
  const draft = campaign("bad", "good");
  const targets = productImagePreparationTargets(draft);
  const original = structuredClone(draft);
  expect(() =>
    applyPreparedProductPhoto(draft, targets[0]!, { image: "/unverified.png" }),
  ).toThrow("could not be verified");
  expect(draft).toEqual(original);
  const save = vi.fn();
  const queue = createProductImagePreparationQueue({
    concurrency: 1,
    orientation: async () => "square",
    inspect: async (image) => image,
    prepare: async (body) =>
      body.image === "/bad.png"
        ? {
            image: "/opaque.png",
            cutoutValidated: false,
            cutoutValidationVersion: 0,
          }
        : {
            image: "/verified.png",
            cutoutValidated: true,
            cutoutValidationVersion: 1,
          },
  });
  const outcomes = await Promise.all(
    targets.map((target) => queue.enqueue(target, save)),
  );
  expect(outcomes.map(({ ok }) => ok)).toEqual([false, true]);
  expect(save).toHaveBeenCalledOnce();
  expect(targets.every((target) => !queue.hasTarget(target))).toBe(true);
});

it("does not inspect or purchase an obsolete waiting photo and continues with the next job", async () => {
  const draft = campaign("first", "accepted", "last");
  const targets = productImagePreparationTargets(draft);
  let release!: () => void;
  const first = new Promise<void>((resolve) => {
    release = resolve;
  });
  const orientation = vi.fn(async () => "square");
  const prepare = vi.fn(async (body: { image: string }) => {
    if (body.image === "/first.png") await first;
    return {
      cutoutValidated: true,
      cutoutValidationVersion: 1,
      image: "/cutout.png",
    };
  });
  const queue = createProductImagePreparationQueue({
    concurrency: 1,
    orientation,
    prepare,
    inspect: async (source) => source,
  });
  const jobs = targets.map((target) =>
    queue.enqueue(target, () => {}, {
      shouldRun: (pending) =>
        Boolean(currentProductPhotoTarget(draft, pending)),
    }),
  );
  draft.products[1]!.skipAiCutout = true;
  release();
  const outcomes = await Promise.all(jobs);
  expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, true]);
  expect(outcomes[1]?.cancelled).toBe(true);
  expect(orientation.mock.calls).toHaveLength(2);
  expect(prepare.mock.calls.map(([body]) => body.image)).toEqual([
    "/first.png",
    "/last.png",
  ]);
  expect(
    targets.every(
      (target) => !queue.hasTarget(target) && !queue.isRunningTarget(target),
    ),
  ).toBe(true);
});

it("rechecks a photo after source inspection before purchasing its cutout", async () => {
  const draft = campaign("changed");
  const target = productImagePreparationTargets(draft)[0]!;
  let inspected!: (orientation: string) => void;
  const prepare = vi.fn(async () => ({
    cutoutValidated: true,
    cutoutValidationVersion: 1,
    image: "/cutout.png",
  }));
  const apply = vi.fn();
  const queue = createProductImagePreparationQueue({
    orientation: () =>
      new Promise((resolve) => {
        inspected = resolve;
      }),
    prepare,
    inspect: async (source) => source,
  });
  const job = queue.enqueue(target, apply, {
    shouldRun: (pending) => Boolean(currentProductPhotoTarget(draft, pending)),
  });
  draft.products[0]!.image = "/replacement.png";
  inspected("square");
  expect(await job).toMatchObject({ ok: false, cancelled: true });
  expect(prepare).not.toHaveBeenCalled();
  expect(apply).not.toHaveBeenCalled();
  expect(queue.has(target.key)).toBe(false);
});

it("keeps a paid cutout after a background change but rejects a changed source or screen size", () => {
  const draft = campaign("tv");
  draft.products[0] = {
    ...draft.products[0]!,
    name: "TV LED 65ABC",
    subcategory: "TV",
    specs: { Përmasat: "65 inch" },
  };
  const target = productImagePreparationTargets(draft)[0]!;
  draft.productBackgroundColor = "#123456";
  expect(
    productImagePreparationTargets(draft)[0]!.backgroundSignature,
  ).not.toBe(target.backgroundSignature);
  expect(currentProductPhotoTarget(draft, target)).toBeTruthy();
  const changedInches = structuredClone(draft);
  changedInches.products[0]!.specs = { Përmasat: "66 inch" };
  expect(currentProductPhotoTarget(changedInches, target)).toBeNull();
  const changedSource = structuredClone(draft);
  changedSource.products[0]!.aiOriginalImage = "/different-original.png";
  expect(currentProductPhotoTarget(changedSource, target)).toBeNull();
  expect(
    applyPreparedProductPhoto(draft, target, {
      cutoutValidated: true,
      cutoutValidationVersion: 1,
      image: "/paid-cutout.png",
    }),
  ).toBe(true);
  expect(draft.products[0]?.image).toBe("/paid-cutout.png");
  expect(productImagePreparationTargets(draft)).toEqual([]);
});

it("does not announce a ready photo when the apply callback rejects the result", async () => {
  const targets = productImagePreparationTargets(
    campaign("rejected", "accepted"),
  );
  const queue = createProductImagePreparationQueue({
    concurrency: 1,
    orientation: async () => "square",
    prepare: async () => ({
      cutoutValidated: true,
      cutoutValidationVersion: 1,
      image: "/cutout.png",
    }),
    inspect: async (source) => source,
  });
  const rejected = queue.enqueue(targets[0]!, async () => false);
  const accepted = queue.enqueue(targets[1]!, () => true);
  expect(await rejected).toMatchObject({ ok: false, cancelled: true });
  expect(await accepted).toMatchObject({ ok: true });
});

it("prioritizes explicit waiting selections in order and cancels only unstarted work", async () => {
  const targets = productImagePreparationTargets(
    campaign("running", "cancelled", "ordinary", "manual-one", "manual-two"),
  );
  let release!: () => void;
  const running = new Promise<void>((resolve) => {
    release = resolve;
  });
  const order: string[] = [];
  const queue = createProductImagePreparationQueue({
    concurrency: 1,
    orientation: async () => "square",
    inspect: async (source) => source,
    prepare: async (body) => {
      order.push(body.image);
      if (body.image === "/running.png") await running;
      return {
        cutoutValidated: true,
        cutoutValidationVersion: 1,
        image: "/cutout.png",
      };
    },
  });
  const jobs = targets.map((target, index) =>
    queue.enqueue(target, () => {}, { priority: index >= 3 }),
  );
  expect(queue.isRunningTarget(targets[0]!)).toBe(true);
  expect(queue.isQueuedTarget(targets[2]!)).toBe(true);
  expect(queue.cancelQueued("cost-policy", [targets[0]!, targets[1]!])).toEqual(
    [targets[1]],
  );
  expect(await jobs[1]).toMatchObject({ ok: false, cancelled: true });
  release();
  await Promise.all(jobs);
  expect(order).toEqual([
    "/running.png",
    "/manual-one.png",
    "/manual-two.png",
    "/ordinary.png",
  ]);
});

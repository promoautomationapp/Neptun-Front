import { expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  applyPreparedProductPhoto,
  createProductImagePreparationQueue,
  currentProductPhotoTarget,
  productImagePreparationTargets,
  productPhotoSelectionKey,
} from "../../src/features/brochure/productImagePreparationQueue";

const campaign: Campaign = {
  id: "campaign",
  name: "Campaign",
  products: [
    {
      code: "prepared",
      name: "Prepared TV",
      image: "/prepared.png",
      aiOriginalImage: "/source.png",
    },
    {
      code: "skipped",
      name: "Uncut phone",
      image: "/phone.jpg",
      skipAiCutout: true,
    },
  ],
};
it("only forces selected photos, retains their original sources, and rejects a late result after another edit", () => {
  const draft = structuredClone(campaign);
  expect(productImagePreparationTargets(draft)).toEqual([]);
  const targets = productImagePreparationTargets(draft, draft.products, {
    force: true,
    instructions: "  Keep the feet  ",
    targetKeys: [JSON.stringify(["skipped", ""])],
  });
  expect(targets).toHaveLength(1);
  const target = targets[0]!;
  expect(target.request).toMatchObject({
    image: "/phone.jpg",
    instructions: "Keep the feet",
    retry: true,
  });
  expect(currentProductPhotoTarget(draft, target)).toBeTruthy();
  expect(
    applyPreparedProductPhoto(draft, target, { image: "/phone-cutout.png" }),
  ).toBe(true);
  expect(draft.products[1]).toMatchObject({
    image: "/phone-cutout.png",
    aiOriginalImage: "/phone.jpg",
    skipAiCutout: false,
  });
  expect(draft.products[0]).toEqual(campaign.products[0]);
  expect(currentProductPhotoTarget(draft, target)).toBeNull();
  const original = productImagePreparationTargets(campaign, undefined, {
    force: true,
  })[0]!;
  expect(original.request.image).toBe("/source.png");
  expect(productPhotoSelectionKey(original)).toBe(
    JSON.stringify(["prepared", ""]),
  );
});
it("recognizes another queued request for the same photo even when repair instructions differ", async () => {
  const photo = {
    id: "campaign",
    name: "Campaign",
    products: [{ code: "tv", name: "TV", image: "/source.png" }],
  };
  let resolve!: (value: { image: string }) => void;
  const prepare = vi.fn(
    () =>
      new Promise<{ image: string }>((done) => {
        resolve = done;
      }),
  );
  const queue = createProductImagePreparationQueue({
    prepare,
    orientation: async () => "square",
    inspect: async (source) => source,
  });
  const automatic = productImagePreparationTargets(photo)[0]!;
  const manual = productImagePreparationTargets(photo, undefined, {
    force: true,
    instructions: "Remove white border",
  })[0]!;
  const job = queue.enqueue(automatic, () => {});
  expect(manual.key).not.toBe(automatic.key);
  expect(queue.hasTarget(manual)).toBe(true);
  expect(queue.enqueue(manual, () => {})).toBe(job);
  await Promise.resolve();
  resolve({ image: "/cutout.png" });
  await job;
  expect(queue.hasTarget(manual)).toBe(false);
  expect(prepare).toHaveBeenCalledOnce();
});
it("does not overwrite an explicit original-photo choice made during a manual repair", () => {
  const draft = structuredClone(campaign);
  const target = productImagePreparationTargets(draft, undefined, {
    force: true,
  })[1]!;
  draft.products[1]!.aiReviewedImageSource = draft.products[1]!.image;
  expect(applyPreparedProductPhoto(draft, target, { image: "/late.png" })).toBe(
    false,
  );
  expect(draft.products[1]!.image).toBe("/phone.jpg");
});

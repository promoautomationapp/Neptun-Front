import {expect, it, vi} from "vitest";
import type {Campaign, Product} from "../../src/domain/models";
import {productImageFit} from "../../src/features/brochure/productImageFit";
import {occupiedProductRows} from "../../src/features/brochure/brochureLayout";
import {brochureVisibleDetailEntries, editDisplayedDetail} from "../../src/features/brochure/detailRows";
import {applyPreparedProductPhoto, createProductImagePreparationQueue, productImagePreparationTargets, retainPreparedProductPhoto} from "../../src/features/brochure/productImagePreparationQueue";

const product: Product = {code: "qa", name: "WASHER", image: "/original.png", brochureImagePlacement: {x: 43, y: 52, scale: .91}};
const campaign: Campaign = {id: "qa", name: "QA", theme: "blue", products: [product]};

it("fits the visible cutout uniformly instead of sizing its transparent margins", () => {
  const fit = productImageFit({naturalWidth: 1000, naturalHeight: 1000, imageBoxWidth: 400, imageBoxHeight: 300, wrapWidth: 400, wrapHeight: 300, bounds: {left: .25, top: .1, right: .75, bottom: .9}});
  expect(fit.scale).toBeCloseTo(1.25);
  expect(fit.x).toBe(50); expect(fit.y).toBe(50);
});

it("fills only the occupied grid rows while retaining manual card spans", () => {
  expect(occupiedProductRows(Array.from({length: 4}, (_, index) => ({...product, code: String(index)})), "grid6portrait")).toBe(2);
  expect(occupiedProductRows([{...product, brochureCardSize: {width: 1, height: 2}}, product], "grid6portrait")).toBe(2);
});

it("limits details to one readable row and edits a full source without dropping hidden facts", () => {
  const rows: Array<[string, string]> = Array.from({length: 8}, (_, index) => [`Fact ${index}`, `Value ${index}`]);
  expect(brochureVisibleDetailEntries(rows, {warrantyInStrip: true})).toHaveLength(4);
  expect(rows).toHaveLength(8);
  const edited = editDisplayedDetail(product, rows, 0, "Screen: AMOLED");
  expect(edited.brochureDetails).toHaveLength(8);
  expect(edited.brochureDetails[0]).toBe("Screen: AMOLED");
  expect(edited.brochureDetails[7]).toBe("Fact 7: Value 7");
});

it("preserves source choice and all placement data when a cutout returns or is reimported", () => {
  const draft = structuredClone(campaign);
  const target = productImagePreparationTargets(draft)[0]!;
  expect(target.request.provider).toBe("openai");
  expect(applyPreparedProductPhoto(draft, target, {image: "/prepared.png", provider: "openai", preparationRevision: 3, backgroundSignature: target.backgroundSignature})).toBe(true);
  expect(draft.products[0]?.brochureImagePlacement).toEqual(product.brochureImagePlacement);
  expect(retainPreparedProductPhoto(draft.products[0], product).image).toBe("/prepared.png");
  expect(applyPreparedProductPhoto(draft, target, {image: "/late.png"})).toBe(false);
  expect(draft.products[0]?.image).toBe("/prepared.png");
});

it("deduplicates background work and limits simultaneous preparation across imports", async () => {
  let running = 0, maximum = 0, calls = 0;
  const releases: Array<() => void> = [];
  const queue = createProductImagePreparationQueue({orientation: async () => "square", inspect: async source => source, prepare: async () => {
    calls++; maximum = Math.max(maximum, ++running);
    await new Promise<void>(resolve => releases.push(resolve)); running--; return {image: "/prepared.png"};
  }});
  const targets = productImagePreparationTargets({...campaign, products: [product, {...product, code: "two"}, {...product, code: "three"}]});
  const jobs = targets.map(target => queue.enqueue(target, () => {}));
  expect(queue.enqueue(targets[0]!, () => {})).toBe(jobs[0]);
  await Promise.resolve(); await Promise.resolve();
  expect(calls).toBe(2);
  releases.shift()!(); await jobs[0]; await Promise.resolve();
  for (const release of releases) release();
  expect((await Promise.all(jobs)).every(result => result.ok)).toBe(true);
  expect(calls).toBe(3); expect(maximum).toBe(2);
});

it("keeps original photos available after uncertain work and continues with the next products", async () => {
  let calls = 0;
  const phases: string[] = [];
  const apply = vi.fn();
  const queue = createProductImagePreparationQueue({concurrency: 1, orientation: async () => "square", inspect: async source => source, prepare: async body => {
    expect(body.orientation).toBe("square");
    if (++calls === 1) throw new Error("Provider response uncertain");
    return {image: "/prepared.png"};
  }});
  const targets = productImagePreparationTargets({...campaign, products: [product, {...product, code: "next"}]});
  const outcomes = await Promise.all(targets.map(target => queue.enqueue(target, apply, {onPhase: phase => phases.push(phase)})));
  expect(outcomes[0]).toMatchObject({ok: false, usingOriginal: true});
  expect(outcomes[1]).toMatchObject({ok: true});
  expect(apply).toHaveBeenCalledOnce();
  expect(phases).toEqual(["preparing", "preparing", "saving"]);
  expect(product.image).toBe("/original.png");
});

it("distinguishes a save error from failure to prepare an image", async () => {
  const queue = createProductImagePreparationQueue({orientation: async () => "square", inspect: async source => source, prepare: async () => ({image: "/prepared.png"})});
  const target = productImagePreparationTargets(campaign)[0]!;
  const outcome = await queue.enqueue(target, () => {throw new Error("Could not save");});
  expect(outcome).toMatchObject({ok: false, usingOriginal: false});
});

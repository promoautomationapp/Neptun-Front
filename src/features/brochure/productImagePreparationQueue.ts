import type { Campaign, Product, JsonValue } from "../../domain/models";
import { requestAi } from "../ai/ai.api";
import { imageOrientation, inspectImage } from "../ai/image-inspection";
import { buildImagePreparationRequest, imageBackgroundSignature, imagePreparationMetadata, imagePreparationSource, needsImagePreparation } from "./imageReview";
import { productImageBackgroundContext } from "./pageBackground";

const metadataFields = ["aiInchesEmbedded", "aiAnnotationStyle", "aiPreparedScreenInches", "aiPreparationRevision", "aiBackgroundSignature", "aiCutoutProvider", "aiAnnotationCleanup", "aiCutoutReviewRevision", "aiCutoutReviewAccepted", "aiReviewedImageSource", "aiReviewedPreparationRevision", "aiReviewedBackgroundSignature", "skipAiCutout"] as const;
export interface ProductPhotoTarget {
  campaignId: string;
  offerCode: string;
  memberCode?: string;
  expectedImage?: string;
  source: string;
  backgroundSignature: string;
  request: ReturnType<typeof buildImagePreparationRequest>;
  key: string;
}
export type PreparedPhotoResult = Record<string, JsonValue> & { image: string };
export interface PhotoOutcome { ok: boolean; target: ProductPhotoTarget; error?: unknown; usingOriginal?: boolean; }
export type PhotoPreparationPhase = "preparing" | "saving";
interface QueueOptions {retry?: boolean; onStart?: () => void; onPhase?: (phase: PhotoPreparationPhase) => void;}

export function retainPreparedProductPhoto(previous: Product | undefined, incoming: Product): Product {
  let next = incoming;
  if (previous?.bundleProducts?.length && incoming.bundleProducts?.length) {
    const members = new Map(previous.bundleProducts.map(member => [member.code, member]));
    next = {...incoming, bundleProducts: incoming.bundleProducts.map(member => ({...members.get(member.code), ...retainPreparedProductPhoto(members.get(member.code), member)}))};
  }
  if (!previous?.image || !incoming.image) return next;
  if (![previous.image, previous.aiOriginalImage].includes(incoming.image)) {
    const replaced = {...next};
    for (const field of ["aiOriginalImage", ...metadataFields] as const) if (Object.hasOwn(previous, field) && !Object.hasOwn(next, field)) Object.assign(replaced, {[field]: undefined});
    return replaced;
  }
  if (!previous.aiOriginalImage && !previous.skipAiCutout && previous.aiReviewedImageSource !== previous.image) return next;
  const retained = {...next, image: previous.image};
  if (previous.aiOriginalImage) retained.aiOriginalImage = previous.aiOriginalImage;
  for (const field of metadataFields) {
    if (Object.hasOwn(previous, field)) Object.assign(retained, {[field]: previous[field]});
    else delete retained[field];
  }
  return retained;
}

export function productImagePreparationTargets(campaign: Campaign, products = campaign.products): ProductPhotoTarget[] {
  return products.flatMap(offer => {
    const backgroundContext = productImageBackgroundContext(campaign, offer);
    return (offer.bundleProducts?.length ? offer.bundleProducts : [offer]).flatMap(product => {
      if (!imagePreparationSource(product) || !needsImagePreparation(product, backgroundContext)) return [];
      const request = buildImagePreparationRequest(product, {backgroundContext});
      const target = {campaignId: campaign.id, offerCode: offer.code, ...(product !== offer ? {memberCode: product.code} : {}), expectedImage: product.image, source: imagePreparationSource(product), backgroundSignature: imageBackgroundSignature(backgroundContext), request};
      return [{...target, key: JSON.stringify([target.campaignId, target.offerCode, target.memberCode || "", target.expectedImage, request])}];
    });
  });
}

export function currentProductPhotoTarget(campaign: Campaign | undefined, target: ProductPhotoTarget) {
  if (!campaign || campaign.id !== target.campaignId) return null;
  const offer = campaign.products.find(item => item.code === target.offerCode);
  const product = target.memberCode ? offer?.bundleProducts?.find(item => item.code === target.memberCode) : offer;
  if (!offer || !product || product.image !== target.expectedImage || product.skipAiCutout) return null;
  const backgroundContext = productImageBackgroundContext(campaign, offer);
  if (imageBackgroundSignature(backgroundContext) !== target.backgroundSignature || JSON.stringify(buildImagePreparationRequest(product, {backgroundContext})) !== JSON.stringify(target.request) || !needsImagePreparation(product, backgroundContext)) return null;
  return {offer, product};
}

export function applyPreparedProductPhoto(campaign: Campaign, target: ProductPhotoTarget, result: PreparedPhotoResult) {
  const current = currentProductPhotoTarget(campaign, target);
  if (!current || !result.image) return false;
  const {offer, product} = current;
  product.aiOriginalImage ||= target.source;
  product.image = result.image;
  Object.assign(product, imagePreparationMetadata(result));
  for (const field of ["aiReviewedImageSource", "aiReviewedPreparationRevision", "aiReviewedBackgroundSignature"] as const) delete product[field];
  if (product.screenArtwork) delete product.screenArtwork.detectedFor;
  if (target.memberCode) {
    offer.productArtworks = offer.productArtworks?.map(artwork => artwork.type === "bundle-product" && artwork.memberCode === target.memberCode && !artwork.usesPrimaryImage ? {...artwork, image: result.image} : artwork);
    if (offer.bundleProducts?.[0] === product && offer.image === target.expectedImage) {
      offer.image = result.image; offer.aiOriginalImage ||= target.source;
      Object.assign(offer, imagePreparationMetadata(result));
    }
  }
  return true;
}

export function createProductImagePreparationQueue({prepare = async body => await requestAi("ai-remove-background", body) as PreparedPhotoResult, orientation = imageOrientation, inspect = inspectImage, concurrency = 2}: {prepare?: (body: ReturnType<typeof buildImagePreparationRequest> & {orientation: string}) => Promise<PreparedPhotoResult>; orientation?: (source: string) => Promise<string>; inspect?: (source: string) => Promise<string>; concurrency?: number} = {}) {
  const limit = Number.isFinite(concurrency) ? Math.max(1, Math.min(3, Math.floor(concurrency))) : 2;
  const jobs = new Map<string, Promise<PhotoOutcome>>();
  const waiting: Array<{target: ProductPhotoTarget; apply: (target: ProductPhotoTarget, result: PreparedPhotoResult) => Promise<void> | void; retry: boolean; onStart?: () => void; onPhase?: (phase: PhotoPreparationPhase) => void; resolve: (outcome: PhotoOutcome) => void}> = [];
  let running = 0;
  function drain() {
    while (running < limit && waiting.length) {
      const job = waiting.shift()!; running++;
      void (async () => {
        let outcome: PhotoOutcome;
        let prepared = false;
        try {
          job.onStart?.();
          job.onPhase?.("preparing");
          // Do not guess a different output size when the source is unavailable:
          // that would miss an existing paid result's cache identity.
          const layout = await orientation(job.target.source);
          const result = await prepare({...job.target.request, ...(job.retry ? {retry: true} : {}), orientation: layout});
          if (!result.image) throw new Error("Could not prepare this product photo.");
          result.image = await inspect(result.image);
          prepared = true;
          job.onPhase?.("saving");
          await job.apply(job.target, result);
          outcome = {ok: true, target: job.target};
        } catch (error) { outcome = {ok: false, target: job.target, error, usingOriginal: !prepared && Boolean(job.target.expectedImage || job.target.source)}; }
        jobs.delete(job.target.key); running--; job.resolve(outcome); drain();
      })();
    }
  }
  return {
    has: (key: string) => jobs.has(key),
    enqueue(target: ProductPhotoTarget, apply: (target: ProductPhotoTarget, result: PreparedPhotoResult) => Promise<void> | void, {retry = false, onStart, onPhase}: QueueOptions = {}) {
      const existing = jobs.get(target.key); if (existing) return existing;
      let finish!: (outcome: PhotoOutcome) => void;
      const promise = new Promise<PhotoOutcome>(resolve => {finish = resolve;});
      jobs.set(target.key, promise); waiting.push({target, apply, retry, onStart, onPhase, resolve: finish}); drain(); return promise;
    },
  };
}

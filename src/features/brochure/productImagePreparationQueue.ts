import type { Campaign, Product, JsonValue } from "../../domain/models";
import { requestAi } from "../ai/ai.api";
import { imageOrientation, inspectImage } from "../ai/image-inspection";
import {
  buildImagePreparationRequest,
  imageBackgroundSignature,
  imagePreparationMetadata,
  imagePreparationSource,
  needsImagePreparation,
} from "./imageReview";
import { productImageBackgroundContext } from "./pageBackground";

const metadataFields = [
  "aiInchesEmbedded",
  "aiAnnotationStyle",
  "aiPreparedScreenInches",
  "aiPreparationRevision",
  "aiBackgroundSignature",
  "aiCutoutProvider",
  "aiCutoutValidated",
  "aiCutoutValidationVersion",
  "aiAnnotationCleanup",
  "aiCutoutReviewRevision",
  "aiCutoutReviewAccepted",
  "aiReviewedImageSource",
  "aiReviewedPreparationRevision",
  "aiReviewedBackgroundSignature",
  "skipAiCutout",
] as const;
export interface ProductPhotoTarget {
  campaignId: string;
  offerCode: string;
  memberCode?: string;
  expectedImage?: string;
  source: string;
  backgroundSignature: string;
  request: ReturnType<typeof buildImagePreparationRequest>;
  force?: boolean;
  expectedSkipAiCutout?: boolean;
  expectedReviewedImageSource?: string;
  key: string;
}
export interface ProductPhotoPreparationOptions {
  force?: boolean;
  instructions?: string;
  targetKeys?: string[];
  userRequested?: boolean;
}
export function productPhotoSelectionKey(
  target: Pick<ProductPhotoTarget, "offerCode" | "memberCode">,
) {
  return JSON.stringify([target.offerCode, target.memberCode || ""]);
}
export type PreparedPhotoResult = Record<string, JsonValue> & { image: string };
export interface PhotoOutcome {
  ok: boolean;
  target: ProductPhotoTarget;
  error?: unknown;
  usingOriginal?: boolean;
  cancelled?: boolean;
}
export type PhotoPreparationPhase = "preparing" | "retrying" | "saving";
export interface PhotoPreparationRetry {
  attempt: number;
  limit: number;
}
type PhaseHandler = (
  phase: PhotoPreparationPhase,
  retry?: PhotoPreparationRetry,
) => void;
interface QueueOptions {
  retry?: boolean;
  shouldRun?: (target: ProductPhotoTarget) => boolean;
  priority?: boolean;
  onStart?: () => void;
  onPhase?: PhaseHandler;
}

export function retainPreparedProductPhoto(
  previous: Product | undefined,
  incoming: Product,
): Product {
  let next = incoming;
  if (previous?.bundleProducts?.length && incoming.bundleProducts?.length) {
    const members = new Map(
      previous.bundleProducts.map((member) => [member.code, member]),
    );
    next = {
      ...incoming,
      bundleProducts: incoming.bundleProducts.map((member) => ({
        ...members.get(member.code),
        ...retainPreparedProductPhoto(members.get(member.code), member),
      })),
    };
  }
  if (!previous?.image || !incoming.image) return next;
  if (![previous.image, previous.aiOriginalImage].includes(incoming.image)) {
    const replaced = { ...next };
    for (const field of ["aiOriginalImage", ...metadataFields] as const)
      if (Object.hasOwn(previous, field) && !Object.hasOwn(next, field))
        Object.assign(replaced, { [field]: undefined });
    return replaced;
  }
  if (
    !(
      previous.aiOriginalImage &&
      previous.aiCutoutValidated === true &&
      (previous.aiCutoutValidationVersion ?? 0) >= 1
    ) &&
    !previous.skipAiCutout &&
    previous.aiReviewedImageSource !== previous.image
  )
    return next;
  const retained = { ...next, image: previous.image };
  if (previous.aiOriginalImage)
    retained.aiOriginalImage = previous.aiOriginalImage;
  for (const field of metadataFields) {
    if (Object.hasOwn(previous, field))
      Object.assign(retained, { [field]: previous[field] });
    else delete retained[field];
  }
  return retained;
}

export function productImagePreparationTargets(
  campaign: Campaign,
  products = campaign.products,
  options: ProductPhotoPreparationOptions = {},
): ProductPhotoTarget[] {
  return products.flatMap((offer) => {
    const backgroundContext = productImageBackgroundContext(campaign, offer);
    return (
      offer.bundleProducts?.length ? offer.bundleProducts : [offer]
    ).flatMap((product) => {
      if (
        !imagePreparationSource(product) ||
        !needsImagePreparation(product, backgroundContext, options)
      )
        return [];
      const request = buildImagePreparationRequest(product, {
        backgroundContext,
        retry: options.force,
        regenerate: options.force,
        rejectedImage: options.force ? product.image : undefined,
        instructions: options.instructions,
      });
      const target = {
        campaignId: campaign.id,
        offerCode: offer.code,
        ...(product !== offer ? { memberCode: product.code } : {}),
        expectedImage: product.image,
        source: imagePreparationSource(product),
        backgroundSignature: imageBackgroundSignature(backgroundContext),
        request,
        ...(options.force
          ? {
              force: true,
              expectedSkipAiCutout: Boolean(product.skipAiCutout),
              expectedReviewedImageSource: product.aiReviewedImageSource,
            }
          : {}),
      };
      if (
        options.targetKeys &&
        !options.targetKeys.includes(productPhotoSelectionKey(target))
      )
        return [];
      return [
        {
          ...target,
          key: JSON.stringify([
            target.campaignId,
            target.offerCode,
            target.memberCode || "",
            target.expectedImage,
            request,
          ]),
        },
      ];
    });
  });
}

export function currentProductPhotoTarget(
  campaign: Campaign | undefined,
  target: ProductPhotoTarget,
) {
  if (!campaign || campaign.id !== target.campaignId) return null;
  const offer = campaign.products.find(
    (item) => item.code === target.offerCode,
  );
  const product = target.memberCode
    ? offer?.bundleProducts?.find((item) => item.code === target.memberCode)
    : offer;
  if (
    !offer ||
    !product ||
    product.image !== target.expectedImage ||
    (product.skipAiCutout && !target.force)
  )
    return null;
  if (
    target.force &&
    (Boolean(product.skipAiCutout) !== target.expectedSkipAiCutout ||
      product.aiReviewedImageSource !== target.expectedReviewedImageSource)
  )
    return null;
  const backgroundContext = productImageBackgroundContext(campaign, offer);
  const requestIdentity = (request: ProductPhotoTarget["request"]) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(request).filter(([key]) => key !== "backgroundContext"),
      ),
    );
  if (
    requestIdentity(
      buildImagePreparationRequest(product, {
        backgroundContext,
        retry: target.force,
        regenerate: target.force,
        rejectedImage: target.request.rejectedImage,
        instructions: target.request.instructions,
      }),
    ) !== requestIdentity(target.request) ||
    !needsImagePreparation(product, backgroundContext, { force: target.force })
  )
    return null;
  return { offer, product };
}

export function applyPreparedProductPhoto(
  campaign: Campaign,
  target: ProductPhotoTarget,
  result: PreparedPhotoResult,
) {
  const current = currentProductPhotoTarget(campaign, target);
  if (!current || !result.image) return false;
  const metadata = imagePreparationMetadata(result);
  const { offer, product } = current;
  product.aiOriginalImage ||= target.source;
  product.image = result.image;
  product.skipAiCutout = false;
  Object.assign(product, metadata);
  for (const field of [
    "aiReviewedImageSource",
    "aiReviewedPreparationRevision",
    "aiReviewedBackgroundSignature",
  ] as const)
    delete product[field];
  if (product.screenArtwork) delete product.screenArtwork.detectedFor;
  if (target.memberCode) {
    offer.productArtworks = offer.productArtworks?.map((artwork) =>
      artwork.type === "bundle-product" &&
      artwork.memberCode === target.memberCode &&
      !artwork.usesPrimaryImage
        ? { ...artwork, image: result.image }
        : artwork,
    );
    if (
      offer.bundleProducts?.[0] === product &&
      offer.image === target.expectedImage
    ) {
      offer.image = result.image;
      offer.aiOriginalImage ||= target.source;
      offer.skipAiCutout = false;
      Object.assign(offer, metadata);
    }
  }
  return true;
}

export function createProductImagePreparationQueue({
  prepare = async (body, onRetry) =>
    (await requestAi("ai-remove-background", body, undefined, {
      onRetry,
    })) as PreparedPhotoResult,
  orientation = imageOrientation,
  inspect = inspectImage,
  concurrency = 2,
}: {
  prepare?: (
    body: ReturnType<typeof buildImagePreparationRequest> & {
      orientation: string;
    },
    onRetry?: (attempt: number, limit: number) => void,
  ) => Promise<PreparedPhotoResult>;
  orientation?: (
    source: string,
    onRetry?: (attempt: number, limit: number) => void,
  ) => Promise<string>;
  inspect?: (source: string) => Promise<string>;
  concurrency?: number;
} = {}) {
  const limit = Number.isFinite(concurrency)
    ? Math.max(1, Math.min(3, Math.floor(concurrency)))
    : 2;
  const jobs = new Map<string, Promise<PhotoOutcome>>();
  const activeTargets = new Map<string, ProductPhotoTarget>();
  const runningTargets = new Set<string>();
  const waiting: Array<{
    target: ProductPhotoTarget;
    apply: (
      target: ProductPhotoTarget,
      result: PreparedPhotoResult,
    ) => Promise<boolean | void> | boolean | void;
    retry: boolean;
    priority: boolean;
    shouldRun?: (target: ProductPhotoTarget) => boolean;
    onStart?: () => void;
    onPhase?: PhaseHandler;
    resolve: (outcome: PhotoOutcome) => void;
  }> = [];
  let running = 0;
  const samePhoto = (first: ProductPhotoTarget, second: ProductPhotoTarget) => {
    const identity = (target: ProductPhotoTarget) =>
      JSON.stringify([
        target.campaignId,
        productPhotoSelectionKey(target),
        target.expectedImage,
        Boolean(target.expectedSkipAiCutout),
        target.expectedReviewedImageSource,
        Object.fromEntries(
          Object.entries(target.request).filter(
            ([key]) =>
              key !== "retry" &&
              key !== "regenerate" &&
              key !== "rejectedImage" &&
              key !== "instructions" &&
              key !== "backgroundContext",
          ),
        ),
      ]);
    return identity(first) === identity(second);
  };
  const obsolete = Symbol("obsolete-photo-target");
  function drain() {
    while (running < limit && waiting.length) {
      const job = waiting.shift()!;
      running++;
      runningTargets.add(job.target.key);
      void (async () => {
        let outcome: PhotoOutcome;
        let prepared = false;
        try {
          if (job.shouldRun?.(job.target) === false) throw obsolete;
          job.onStart?.();
          job.onPhase?.("preparing");
          // Do not guess a different output size when the source is unavailable:
          // that would miss an existing paid result's cache identity.
          const onRetry = (attempt: number, limit: number) =>
            job.onPhase?.("retrying", { attempt, limit });
          const layout = await orientation(job.target.source, onRetry);
          if (job.shouldRun?.(job.target) === false) throw obsolete;
          const result = await prepare(
            {
              ...job.target.request,
              ...(job.retry ? { retry: true } : {}),
              orientation: layout,
            },
            onRetry,
          );
          if (!result.image)
            throw new Error("Could not prepare this product photo.");
          imagePreparationMetadata(result);
          result.image = await inspect(result.image);
          prepared = true;
          job.onPhase?.("saving");
          const applied = await job.apply(job.target, result);
          outcome =
            applied === false
              ? { ok: false, target: job.target, cancelled: true }
              : { ok: true, target: job.target };
        } catch (error) {
          outcome =
            error === obsolete
              ? {
                  ok: false,
                  target: job.target,
                  cancelled: true,
                  usingOriginal: Boolean(
                    job.target.expectedImage || job.target.source,
                  ),
                }
              : {
                  ok: false,
                  target: job.target,
                  error,
                  usingOriginal:
                    !prepared &&
                    Boolean(job.target.expectedImage || job.target.source),
                };
        }
        jobs.delete(job.target.key);
        activeTargets.delete(job.target.key);
        runningTargets.delete(job.target.key);
        running--;
        job.resolve(outcome);
        drain();
      })();
    }
  }
  return {
    has: (key: string) => jobs.has(key),
    hasTarget: (target: ProductPhotoTarget) =>
      [...activeTargets.values()].some((current) => samePhoto(current, target)),
    isRunningTarget: (target: ProductPhotoTarget) =>
      [...activeTargets.entries()].some(
        ([key, current]) =>
          runningTargets.has(key) && samePhoto(current, target),
      ),
    isQueuedTarget: (target: ProductPhotoTarget) =>
      waiting.some((job) => samePhoto(job.target, target)),
    cancelQueued(campaignId: string, targets?: ProductPhotoTarget[]) {
      const cancelled: ProductPhotoTarget[] = [];
      for (let index = waiting.length - 1; index >= 0; index--) {
        const job = waiting[index]!;
        if (
          job.target.campaignId !== campaignId ||
          (targets && !targets.some((target) => samePhoto(job.target, target)))
        )
          continue;
        waiting.splice(index, 1);
        jobs.delete(job.target.key);
        activeTargets.delete(job.target.key);
        cancelled.push(job.target);
        job.resolve({
          ok: false,
          target: job.target,
          cancelled: true,
          usingOriginal: true,
        });
      }
      return cancelled;
    },
    enqueue(
      target: ProductPhotoTarget,
      apply: (
        target: ProductPhotoTarget,
        result: PreparedPhotoResult,
      ) => Promise<boolean | void> | boolean | void,
      {
        retry = false,
        priority = false,
        shouldRun,
        onStart,
        onPhase,
      }: QueueOptions = {},
    ) {
      const existing = jobs.get(target.key);
      if (existing) return existing;
      const current = [...activeTargets.entries()].find(([, active]) =>
        samePhoto(active, target),
      );
      if (current) return jobs.get(current[0])!;
      let finish!: (outcome: PhotoOutcome) => void;
      const promise = new Promise<PhotoOutcome>((resolve) => {
        finish = resolve;
      });
      jobs.set(target.key, promise);
      activeTargets.set(target.key, target);
      const job = {
        target,
        apply,
        retry,
        priority,
        shouldRun,
        onStart,
        onPhase,
        resolve: finish,
      };
      const ordinary = priority
        ? waiting.findIndex((current) => !current.priority)
        : -1;
      if (ordinary < 0) waiting.push(job);
      else waiting.splice(ordinary, 0, job);
      drain();
      return promise;
    },
  };
}

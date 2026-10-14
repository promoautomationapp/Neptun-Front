import type { Campaign, Product } from "../../domain/models";
import type { AiProposal, ImageProposal } from "../brochure/AiReview";
import { requestAi as postJson } from "./ai.api";
import { inspectImage, imageOrientation } from "./image-inspection";
import { t } from "../brochure/i18n";
import {
  buildProofreadItems,
  dirtyProofreadItems,
} from "../brochure/reviewText";
import {
  needsImagePreparation,
  imagePreparationSource,
  buildImagePreparationRequest,
  imagePreparationMetadata,
} from "../brochure/imageReview";
import { productImageBackgroundContext } from "../brochure/pageBackground";
import { request } from "../../api/client";
import { z } from "zod";
import type { ProofreadItem } from "../brochure/reviewText";
export interface ReviewSnapshot {
  checkedText: ProofreadItem[];
  configured: boolean | null;
  phase: string;
  proposals: AiProposal[];
  errors: string[];
  progress: string;
  imageProgress: number;
}
export interface CampaignReviewTask {
  getSnapshot: () => ReviewSnapshot;
  subscribe: (listener: () => void) => () => void;
  prepare: (existing?: AiProposal[], retryFailed?: boolean) => Promise<void>;
  promise: Promise<void>;
}
// This factory is called only by the existing AI button's click handler. Subscribing
// from a modal reads progress; it never initiates an AI request.
export function startCampaignAiReview(
  campaign: Campaign,
  mode: string,
): CampaignReviewTask {
  let state: ReviewSnapshot = {
    checkedText: [],
    configured: null,
    phase: "checking",
    proposals: [],
    errors: [],
    progress: "",
    imageProgress: 0,
  };
  const listeners = new Set<() => void>();
  const set = <K extends keyof ReviewSnapshot>(
    key: K,
    value: ReviewSnapshot[K],
  ) => {
    state = { ...state, [key]: value };
    for (const listener of listeners) listener();
  };
  const setPhase = (value: string) => set("phase", value),
    setErrors = (value: string[]) => set("errors", value),
    setImageProgress = (value: number) => set("imageProgress", value),
    setProgress = (value: string) => set("progress", value),
    setProposals = (value: AiProposal[]) => set("proposals", value);
  const checkedTextKeys = { current: new Set<string>() };
  const products = campaign.products;
  const pendingProducts = products.filter((product) =>
    needsImagePreparation(
      product,
      productImageBackgroundContext(campaign, product),
    ),
  );
  const { items: allTextItems, metadata } = buildProofreadItems(
    campaign,
    new Set(products.map((product) => String(product.code))),
    { cover: true, footer: true, name: true, description: true, specs: true },
  );
  const dirtyTextItems =
    mode === "images" ? [] : dirtyProofreadItems(campaign, allTextItems);
  async function prepare(existing: AiProposal[] = [], retryFailed = false) {
    setPhase("loading");
    setErrors([]);
    setImageProgress(0);
    const next = [...existing];
    const failures: string[] = [];
    const items =
      mode === "images"
        ? []
        : dirtyTextItems.filter(
            (item) => !checkedTextKeys.current.has(item.key),
          );
    if (items.length) {
      const batches: (typeof allTextItems)[] = [];
      let batch: typeof allTextItems = [];
      for (const item of items) {
        if (
          batch.length >= 80 ||
          JSON.stringify([...batch, item]).length > 45_000
        ) {
          if (batch.length) batches.push(batch);
          batch = [];
        }
        batch.push(item);
      }
      if (batch.length) batches.push(batch);
      for (let index = 0; index < batches.length; index += 1) {
        setProgress(
          `${t("Checking campaign text")} ${index + 1}/${batches.length}`,
        );
        try {
          const response = await postJson("ai-proofread", {
            items: batches[index] ?? [],
            ...(retryFailed ? { retry: true } : {}),
            context: {
              campaignType: campaign.type,
              campaignName: campaign.name,
            },
          });
          set("checkedText", [...state.checkedText, ...(batches[index] ?? [])]);
          for (const item of batches[index] ?? [])
            checkedTextKeys.current.add(item.key);
          for (const change of response.changes || []) {
            const details = metadata.get(change.id);
            if (details)
              next.push({
                ...details,
                ...change,
                type: "text",
                approved: true,
              });
          }
        } catch {
          failures.push(t("Text review"));
        }
      }
    }
    const queue = pendingProducts.filter(
      (product: Product) =>
        !next.some(
          (proposal) =>
            proposal.type === "image" && proposal.code === String(product.code),
        ),
    );
    let finished = 0;
    async function worker() {
      while (queue.length) {
        const product = queue.shift();
        if (!product) continue;
        try {
          const source = imagePreparationSource(product);
          const request = buildImagePreparationRequest(product, {
            backgroundContext: productImageBackgroundContext(campaign, product),
            orientation: await imageOrientation(source),
            retry: retryFailed,
          });
          const response = await postJson("ai-remove-background", request);
          const optimized = await inspectImage(response.image);
          next.push({
            type: "image",
            code: String(product.code),
            label: `${product.brand || ""} · ${product.name}`,
            original: source,
            expectedImage: product.image,
            suggested: optimized,
            screenInches: request.screenInches,
            ...imagePreparationMetadata(response),
            approved: true,
          });
        } catch {
          failures.push(product.name);
        }
        finished += 1;
        setImageProgress(finished);
        setProgress(
          `${t("Preparing product images")} ${finished}/${pendingProducts.length}`,
        );
      }
    }
    if (queue.length) {
      setProgress(
        `${t("Preparing product images")} 0/${pendingProducts.length}`,
      );
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, () => worker()),
      );
    }
    setProposals(next);
    setErrors(failures);
    setPhase("review");
    setProgress("");
  }

  const existing: ImageProposal[] =
    mode === "images"
      ? products
          .filter(
            (product) =>
              product.image &&
              product.aiOriginalImage &&
              !pendingProducts.includes(product),
          )
          .map((product) => ({
            type: "image",
            code: product.code,
            label: `${product.brand || ""} · ${product.name}`,
            original: product.aiOriginalImage ?? "",
            expectedImage: product.image,
            suggested: product.image ?? "",
            screenInches: product.aiPreparedScreenInches,
            aiPreparationRevision: product.aiPreparationRevision,
            aiAnnotationStyle: product.aiAnnotationStyle,
            aiInchesEmbedded: product.aiInchesEmbedded,
            aiPreparedScreenInches: product.aiPreparedScreenInches,
            aiBackgroundSignature: product.aiBackgroundSignature,
            approved: true,
          }))
      : [];
  const promise = (async () => {
    try {
      const status = await request(
        "/api/ai-status",
        z.object({ configured: z.boolean() }),
      );
      set("configured", status.configured);
    } catch {
      set("configured", false);
    }
    await prepare(existing);
  })();
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    prepare,
    promise,
  };
}

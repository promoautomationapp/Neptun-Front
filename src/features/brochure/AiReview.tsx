import type { Campaign, Product } from "../../domain/models";
import { inspectImage, imageOrientation } from "../ai/image-inspection";
import type { CampaignReviewTask } from "../ai/campaign-review";
import { requestAi } from "../ai/ai.api";
import { request } from "../../api/client";
import { z } from "zod";
import React, { useEffect, useState } from "react";
import { Button, Modal } from "./Modals";
import { t } from "./i18n";
import {
  buildProofreadItems,
  dirtyProofreadItems,
  needsTextReview,
} from "./reviewText";
import {
  buildImagePreparationRequest,
  imageBackgroundSignature,
  imagePreparationMetadata,
  IMAGE_PREPARATION_REVISION,
  needsImagePreparation,
} from "./imageReview";
import { productImageBackgroundContext } from "./pageBackground";
import { screenArtworkForPhotoChange } from "./screenGeometry";
export {
  recordTextReview,
  legacyTextSnapshot as textSnapshot,
} from "./reviewText";

const postJson = requestAi;
const preparationFields = [
  "aiInchesEmbedded",
  "aiAnnotationStyle",
  "aiPreparedScreenInches",
  "aiPreparationRevision",
  "aiBackgroundSignature",
] as const;
type ImageMetadata = Pick<Product, (typeof preparationFields)[number]>;
export interface ImageProposal extends ImageMetadata {
  type: "image";
  code: string;
  label: string;
  original: string;
  expectedImage?: string;
  suggested: string;
  screenInches?: number | null;
  approved: boolean;
}
export interface TextProposal {
  type: "text";
  id: string;
  scope: string;
  code: string;
  field: string;
  specKey: string;
  fieldKey: string;
  label: string;
  original: string;
  suggested: string;
  reason?: string;
  approved: boolean;
}
export type AiProposal = ImageProposal | TextProposal;
function isCampaignTextField(
  key: string,
): key is "name" | "type" | "coverHeadline" | "tagline" | "paymentText" {
  return ["name", "type", "coverHeadline", "tagline", "paymentText"].includes(
    key,
  );
}
function isProductTextField(
  key: string,
): key is "name" | "description" | "warranty" {
  return ["name", "description", "warranty"].includes(key);
}
function isStoreTextField(
  key: string,
): key is "city" | "name" | "address" | "phone" {
  return ["city", "name", "address", "phone"].includes(key);
}
function copyPreparationField<K extends keyof ImageMetadata>(
  product: ImageMetadata,
  proposal: ImageMetadata,
  key: K,
) {
  if (key in proposal) product[key] = proposal[key];
  else delete product[key];
}

export function needsAiPreparation(campaign: Campaign) {
  return (
    (campaign.products || []).some((product: Product) =>
      needsImagePreparation(
        product,
        productImageBackgroundContext(campaign, product),
      ),
    ) || needsTextReview(campaign)
  );
}

export function applyAiProposals(draft: Campaign, proposals: AiProposal[]) {
  let applied = 0;
  for (const proposal of proposals) {
    if (proposal.type === "image") {
      const product = draft.products.find(
        (item) => String(item.code) === proposal.code,
      );
      if (
        !product ||
        product.image !== (proposal.expectedImage || proposal.original)
      )
        continue;
      const signature = imageBackgroundSignature(
        productImageBackgroundContext(draft, product),
      );
      if (
        proposal.aiBackgroundSignature &&
        proposal.aiBackgroundSignature !== signature
      )
        continue;
      if (!proposal.approved) {
        if (product.aiOriginalImage === proposal.original) {
          product.screenArtwork = screenArtworkForPhotoChange(
            product.screenArtwork,
            product.image,
            proposal.original,
          );
          product.image = proposal.original;
          delete product.aiOriginalImage;
        }
        for (const key of preparationFields) delete product[key];
        product.aiReviewedImageSource = product.image;
        product.aiReviewedPreparationRevision = IMAGE_PREPARATION_REVISION;
        product.aiReviewedBackgroundSignature = signature;
        continue;
      }
      product.aiOriginalImage ||= proposal.original;
      if (product.image !== proposal.suggested) {
        product.screenArtwork = screenArtworkForPhotoChange(
          product.screenArtwork,
          product.image,
          proposal.suggested,
        );
        product.image = proposal.suggested;
        applied += 1;
      }
      delete product.aiReviewedImageSource;
      delete product.aiReviewedPreparationRevision;
      delete product.aiReviewedBackgroundSignature;
      for (const key of preparationFields) {
        copyPreparationField(product, proposal, key);
      }
    } else if (proposal.scope === "campaign") {
      if (!proposal.approved || !isCampaignTextField(proposal.field)) continue;
      const current =
        proposal.field === "coverHeadline"
          ? (draft.coverHeadline ?? draft.name)
          : draft[proposal.field];
      if (current !== proposal.original) continue;
      draft[proposal.field] = proposal.suggested;
      applied += 1;
    } else if (proposal.scope === "contact") {
      if (!proposal.approved) continue;
      const contact = draft.storesSnapshot?.contact;
      if (!contact || contact[proposal.field] !== proposal.original) continue;
      contact[proposal.field] = proposal.suggested;
      applied += 1;
    } else if (proposal.scope === "store") {
      if (!proposal.approved) continue;
      const store = draft.storesSnapshot?.stores?.[Number(proposal.code)];
      if (
        !store ||
        !isStoreTextField(proposal.field) ||
        store[proposal.field] !== proposal.original
      )
        continue;
      store[proposal.field] = proposal.suggested;
      applied += 1;
    } else {
      if (!proposal.approved) continue;
      const product = draft.products.find(
        (item) => String(item.code) === proposal.code,
      );
      if (!product) continue;
      if (proposal.field === "specLabel") {
        if (
          proposal.specKey !== proposal.original ||
          !(proposal.specKey in (product.specs || {})) ||
          (proposal.suggested !== proposal.specKey &&
            proposal.suggested in (product.specs ?? {}))
        )
          continue;
        product.specs = Object.fromEntries(
          Object.entries(product.specs ?? {}).map(([name, value]) => [
            name === proposal.specKey ? proposal.suggested : name,
            value,
          ]),
        );
      } else if (proposal.field === "specs") {
        const renamed = proposals.find(
          (item) =>
            item.type === "text" &&
            item.approved &&
            item.scope === "product" &&
            item.code === proposal.code &&
            item.field === "specLabel" &&
            item.specKey === proposal.specKey,
        )?.suggested;
        const currentKey =
          product.specs?.[proposal.specKey] === proposal.original
            ? proposal.specKey
            : renamed && product.specs?.[renamed] === proposal.original
              ? renamed
              : null;
        if (!currentKey) continue;
        if (!product.specs) continue;
        product.specs[currentKey] = proposal.suggested;
      } else {
        if (
          !isProductTextField(proposal.field) ||
          product[proposal.field] !== proposal.original
        )
          continue;
        product[proposal.field] = proposal.suggested;
      }
      applied += 1;
    }
  }
  if (
    !(draft.products || []).some((product: Product) =>
      needsImagePreparation(
        product,
        productImageBackgroundContext(draft, product),
      ),
    )
  ) {
    delete draft.aiBackgroundChanged;
  }
  return applied;
}

export function AiReview({
  campaign,
  mode = "manual",
  onApply,
  onDecline,
  onClose,
  task,
}: {
  task?: CampaignReviewTask;
  campaign: Campaign;
  mode?: string;
  onApply: (proposals: AiProposal[]) => void;
  onDecline: (proposals: AiProposal[]) => void;
  onClose: () => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [phase, setPhase] = useState("checking");
  const [proposals, setProposals] = useState<AiProposal[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [imageProgress, setImageProgress] = useState(0);
  const [retryingCode, setRetryingCode] = useState("");
  const [retryError, setRetryError] = useState("");
  const [invalidCodes, setInvalidCodes] = useState(() => new Set<string>());
  const [selectedImageCode, setSelectedImageCode] = useState(() =>
    String((campaign.products || []).find((item) => item.image)?.code || ""),
  );
  const products = campaign.products || [];
  const pendingProducts = products.filter((product: Product) =>
    needsImagePreparation(
      product,
      productImageBackgroundContext(campaign, product),
    ),
  );
  const allSelected = new Set(
    products.map((product: Product) => String(product.code)),
  );
  const { items: allTextItems } = buildProofreadItems(campaign, allSelected, {
    cover: true,
    footer: true,
    name: true,
    description: true,
    specs: true,
  });
  const dirtyTextItems =
    mode === "images" ? [] : dirtyProofreadItems(campaign, allTextItems);
  const needsTextCheck = dirtyTextItems.length > 0;

  async function prepare(existing: AiProposal[] = []) {
    await task?.prepare(existing, true);
  }

  useEffect(() => {
    if (task) {
      const apply = () => {
        const state = task.getSnapshot();
        setConfigured(state.configured);
        setPhase(state.phase);
        setProposals(state.proposals);
        setErrors(state.errors);
        setProgress(state.progress);
        setImageProgress(state.imageProgress);
      };
      apply();
      return task.subscribe(apply);
    }
    const previouslyPrepared: ImageProposal[] =
      mode === "images"
        ? products
            .filter(
              (product: Product) =>
                product.image &&
                product.aiOriginalImage &&
                !pendingProducts.includes(product),
            )
            .map((product: Product) => ({
              type: "image",
              code: String(product.code),
              label: `${product.brand || ""} · ${product.name}`,
              original: product.aiOriginalImage ?? "",
              expectedImage: product.image,
              suggested: product.image ?? "",
              screenInches: product.aiPreparedScreenInches,
              ...Object.fromEntries(
                [
                  "aiInchesEmbedded",
                  "aiAnnotationStyle",
                  "aiPreparedScreenInches",
                  "aiPreparationRevision",
                  "aiBackgroundSignature",
                ].map((key) => [key, product[key as keyof Product]]),
              ),
              approved: true,
            }))
        : [];
    if (
      !pendingProducts.length &&
      !needsTextCheck &&
      !previouslyPrepared.length
    ) {
      setConfigured(true);
      setPhase("review");
      return;
    }
    let cancelled = false;
    request("/api/ai-status", z.object({ configured: z.boolean() }))
      .then((result) => {
        if (cancelled) return;
        setConfigured(Boolean(result.configured));
        setProposals(previouslyPrepared);
        setPhase("review");
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setApproval(index: number, approved: boolean) {
    setProposals((current) =>
      current.map((item, position) =>
        position === index ? { ...item, approved } : item,
      ),
    );
  }
  async function retryImage(proposal: ImageProposal) {
    const code = proposal.code;
    const product = products.find((item) => String(item.code) === code);
    if (!product) return;
    setInvalidCodes((current) => new Set(current).add(code));
    setRetryingCode(code);
    setRetryError("");
    try {
      const request = buildImagePreparationRequest(product, {
        image: proposal.original,
        backgroundContext: productImageBackgroundContext(campaign, product),
        orientation: await imageOrientation(proposal.original),
        retry: true,
      });
      const response = await postJson("ai-remove-background", request);
      const suggested = await inspectImage(response.image);
      setProposals((current) =>
        current.map((item) =>
          item.type === "image" && item.code === code
            ? {
                ...item,
                suggested,
                screenInches: request.screenInches,
                ...imagePreparationMetadata(response),
              }
            : item,
        ),
      );
      setInvalidCodes((current) => {
        const next = new Set(current);
        next.delete(code);
        return next;
      });
    } catch {
      setRetryError(t("Could not prepare this image. Try again shortly."));
    } finally {
      setRetryingCode("");
    }
  }
  const ready =
    !errors.length &&
    !retryingCode &&
    ![...invalidCodes].some((code) =>
      proposals.some(
        (proposal) =>
          proposal.type === "image" &&
          proposal.code === code &&
          proposal.approved,
      ),
    ) &&
    pendingProducts.every((product: Product) =>
      proposals.some(
        (proposal) =>
          proposal.type === "image" && proposal.code === String(product.code),
      ),
    );
  const textProposals = proposals.filter(
    (proposal) => proposal.type === "text",
  );
  const imageProposals = proposals.filter(
    (proposal) => proposal.type === "image",
  );
  const activeImageCode = imageProposals.some(
    (proposal) => proposal.code === selectedImageCode,
  )
    ? selectedImageCode
    : imageProposals[0]?.code;
  return (
    <Modal
      title={t(
        mode === "images"
          ? "Re-cut product image"
          : mode === "complete"
            ? "Final AI check"
            : "AI review",
      )}
      kicker={t(mode === "images" ? "PRODUCT IMAGES" : "IMAGES & COPY")}
      onClose={onClose}
      wide
    >
      <div className="cs-ai-review">
        {configured === false && (
          <div className="cs-ai-notice">
            {t(
              "AI is unavailable. Your saved images and text remain available.",
            )}
          </div>
        )}
        {phase === "checking" && configured !== false && (
          <div className="cs-ai-loading" role="status">
            <span className="cs-ai-spinner" />
            {t("Checking AI connection…")}
          </div>
        )}
        {phase === "loading" && (
          <div className="cs-ai-loading" role="status">
            <span className="cs-ai-spinner" />
            <div className="cs-ai-loading-copy">
              <strong>{progress}</strong>
              {!!pendingProducts.length && (
                <div className="cs-ai-progress">
                  <span
                    style={{
                      width: `${Math.round((imageProgress / pendingProducts.length) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <small>
                {t(
                  "You can continue working in the app while images are prepared. Completed images are saved.",
                )}
              </small>
            </div>
          </div>
        )}
        {phase === "review" && (
          <>
            <p>
              {mode === "images"
                ? t(
                    "Select a product, compare its image, and re-cut only that image if needed.",
                  )
                : mode === "complete"
                  ? t(
                      "Review the final text corrections. They start selected; unselect any you want to leave unchanged, or decline all and complete.",
                    )
                  : t(
                      "Suggested text corrections start selected. Unselect any you want to keep, or decline all. Product backgrounds are removed automatically.",
                    )}
            </p>
            {!!errors.length && (
              <div className="cs-ai-errors">
                <p>
                  {t(
                    "Some items still need AI preparation. Completed images are saved; try the remaining items again.",
                  )}
                </p>
                <small>{errors.join(" · ")}</small>
                <Button onClick={() => prepare(proposals)}>
                  {t("Retry failed items")}
                </Button>
              </div>
            )}
            {retryError && (
              <div className="cs-ai-errors">
                <p>{retryError}</p>
              </div>
            )}
            {mode !== "images" &&
              !needsTextCheck &&
              !textProposals.length &&
              !errors.length && (
                <div className="cs-ai-notice cs-ai-success">
                  {t(
                    needsTextCheck
                      ? "No spelling or grammar changes suggested."
                      : "All brochure text is up to date. Nothing changed since the last AI review.",
                  )}
                </div>
              )}
            {mode !== "images" && textProposals.length > 1 && (
              <div className="cs-ai-bulk">
                <span>
                  {textProposals.filter((item) => item.approved).length}/
                  {textProposals.length} {t("suggestions selected")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setProposals((current) =>
                      current.map((item) =>
                        item.type === "text"
                          ? { ...item, approved: true }
                          : item,
                      ),
                    )
                  }
                >
                  {t("Select all changes")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProposals((current) =>
                      current.map((item) =>
                        item.type === "text"
                          ? { ...item, approved: false }
                          : item,
                      ),
                    )
                  }
                >
                  {t("Unselect all changes")}
                </button>
              </div>
            )}
            {mode !== "images" && !!imageProposals.length && (
              <p className="cs-ai-ready-count">
                {imageProposals.length}{" "}
                {t("product images prepared with transparent backgrounds.")}
              </p>
            )}
            {!!imageProposals.length && (
              <>
                <p className="cs-ai-disclosure">
                  {t(
                    "Compare each prepared product image with its original. Keep the original if the AI changed product details.",
                  )}{" "}
                  {t(
                    "Details already in the source photo, such as protective film or a blank screen, remain. Choose another product photo to change them.",
                  )}
                </p>
                <div className="cs-ai-image-list">
                  {imageProposals.map((proposal) => (
                    <button
                      key={proposal.code}
                      type="button"
                      className={
                        activeImageCode === proposal.code ? "active" : ""
                      }
                      onClick={() => setSelectedImageCode(proposal.code)}
                    >
                      <img src={proposal.original} alt="" />
                      <span>
                        <strong>{proposal.label}</strong>
                        <small>{proposal.code}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="cs-ai-proposals">
              {imageProposals
                .filter((proposal) => proposal.code === activeImageCode)
                .map((proposal) => (
                  <article key={proposal.code} className="cs-ai-proposal">
                    <header>
                      <strong>{proposal.label}</strong>
                      <span>{t("Background removed")}</span>
                    </header>
                    <div className="cs-ai-compare">
                      <div>
                        <small>{t("Original")}</small>
                        <img src={proposal.original} alt="" />
                      </div>
                      <div className="cs-ai-checker">
                        <small>{t("Prepared image")}</small>
                        <img src={proposal.suggested} alt="" />
                      </div>
                    </div>
                    <div
                      className="cs-ai-choice"
                      role="group"
                      aria-label={proposal.label}
                    >
                      <button
                        className={!proposal.approved ? "active" : ""}
                        type="button"
                        aria-pressed={!proposal.approved}
                        onClick={() =>
                          setApproval(proposals.indexOf(proposal), false)
                        }
                      >
                        {t("Keep original")}
                      </button>
                      <button
                        className={proposal.approved ? "active approve" : ""}
                        type="button"
                        aria-pressed={proposal.approved}
                        onClick={() =>
                          setApproval(proposals.indexOf(proposal), true)
                        }
                      >
                        {t("Use prepared image")}
                      </button>
                    </div>
                    <div className="cs-ai-image-action">
                      <Button
                        disabled={!!retryingCode}
                        onClick={() => retryImage(proposal)}
                      >
                        {retryingCode === proposal.code
                          ? t("Checking this image again…")
                          : t("This cutout is wrong · Try again with AI")}
                      </Button>
                      {invalidCodes.has(proposal.code) &&
                        retryingCode !== proposal.code &&
                        proposal.approved && (
                          <small>
                            {t("Retry this image before continuing.")}
                          </small>
                        )}
                    </div>
                  </article>
                ))}
              {mode !== "images" &&
                textProposals.map((proposal) => {
                  const index = proposals.indexOf(proposal);
                  return (
                    <article key={proposal.id} className="cs-ai-proposal">
                      <header>
                        <strong>{proposal.label}</strong>
                        <span>{t("Text correction")}</span>
                      </header>
                      <div className="cs-ai-compare cs-ai-copy">
                        <div>
                          <small>{t("Original")}</small>
                          <p>{proposal.original}</p>
                        </div>
                        <div>
                          <small>{t("AI suggestion")}</small>
                          <p>{proposal.suggested}</p>
                        </div>
                      </div>
                      {proposal.reason && (
                        <p className="cs-ai-reason">{proposal.reason}</p>
                      )}
                      <div
                        className="cs-ai-choice"
                        role="group"
                        aria-label={proposal.label}
                      >
                        <button
                          className={!proposal.approved ? "active" : ""}
                          type="button"
                          aria-pressed={!proposal.approved}
                          onClick={() => setApproval(index, false)}
                        >
                          {t("Keep original")}
                        </button>
                        <button
                          className={proposal.approved ? "active approve" : ""}
                          type="button"
                          aria-pressed={proposal.approved}
                          onClick={() => setApproval(index, true)}
                        >
                          {t("Approve change")}
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
            {mode === "images" && (
              <p className="cs-ai-disclosure">
                {t(
                  "Original product images are kept for restoration. Check the prepared images because AI can change product details.",
                )}
              </p>
            )}
          </>
        )}
      </div>
      {phase === "review" && (
        <div className="cs-modal-actions cs-ai-footer">
          <Button onClick={onClose}>{t("Cancel")}</Button>
          {mode !== "images" && (
            <Button disabled={!ready} onClick={() => onDecline(proposals)}>
              {t(
                mode === "complete"
                  ? "Decline all & complete"
                  : mode === "brochure"
                    ? "Decline all & open brochure"
                    : "Decline all & close",
              )}
            </Button>
          )}
          <Button
            tone="primary"
            disabled={!ready}
            onClick={() => onApply(proposals)}
          >
            {t(
              mode === "images"
                ? "Save re-cut images"
                : mode === "complete"
                  ? "Apply selected & complete"
                  : mode === "brochure"
                    ? "Apply selected & open brochure"
                    : "Apply selected changes",
            )}
          </Button>
        </div>
      )}
    </Modal>
  );
}

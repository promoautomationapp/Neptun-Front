import { z } from "zod";
import { normalizeApiDocument, request } from "../../api/client";
import { jsonValue } from "../../domain/schemas";
import type {
  PreparedPhotoResult,
  ProductPhotoTarget,
} from "./productImagePreparationQueue";

export class SavedPhotoLookupError extends Error {}

const resultSchema = z
  .object({
    image: z.string().min(1),
    cutoutValidated: z.literal(true),
    cutoutValidationVersion: z.number().int().min(1),
    annotationCleanup: z.literal(true),
    annotationHandling: z.literal("editable-overlays"),
  })
  .catchall(jsonValue);
const responseSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string(),
        resultId: z.string(),
        result: resultSchema,
      }),
    )
    .max(200),
});

/** This endpoint only reads completed, validated photos. A miss cannot start AI.
 * Check the whole import before loading source pixels or entering the AI queue. */
export async function reusableProductPhotos(targets: ProductPhotoTarget[]) {
  const results = new Map<string, PreparedPhotoResult>();
  for (let offset = 0; offset < targets.length; offset += 200) {
    const batch = targets.slice(offset, offset + 200);
    const response = await request("/api/ai/cutouts/reuse", responseSchema, {
      method: "POST",
      timeoutMs: 20_000,
      body: normalizeApiDocument({
        items: batch.map((target, index) => ({
          ...target.request,
          key: String(index),
        })),
      }),
    });
    for (const item of response.items) {
      const index = Number(item.key);
      if (!Number.isInteger(index) || String(index) !== item.key) continue;
      const target = batch[index];
      if (target) results.set(target.key, item.result);
    }
  }
  return results;
}

import type { SocialPost } from "../../domain/models";
import { t } from "../brochure/i18n";

export function socialPostDisplayName(post: Pick<SocialPost, "name">) {
  const name = post.name?.trim();
  return !name || name === "New social post" || name === "Social post"
    ? t("New social post")
    : name;
}

/** Copies editable content, while the new document starts its own save and review history. */
export function duplicateSocialPost(source: SocialPost): SocialPost {
  const copy = {
    ...structuredClone(source),
    status: "in_progress",
    reviewComments: [],
    reviewHistory: [],
  };
  copy.id = crypto.randomUUID();
  copy.name = `${socialPostDisplayName(source)} · ${t("Copy")}`;
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  copy.status = "in_progress";
  copy.revision = 0;
  copy.reviewComments = [];
  copy.reviewHistory = [];
  delete copy.version;
  delete copy.disabledAt;
  delete copy.disabledBy;
  Reflect.deleteProperty(copy, "createdBy");
  delete copy.updatedBy;
  const refreshArtworkIds = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (
        (key === "artworks" || key === "productArtworks") &&
        Array.isArray(child)
      ) {
        for (const artwork of child) {
          if (artwork && typeof artwork === "object" && "id" in artwork)
            artwork.id = crypto.randomUUID();
        }
      }
      if (Array.isArray(child)) child.forEach(refreshArtworkIds);
      else refreshArtworkIds(child);
    }
  };
  refreshArtworkIds(copy);
  return copy;
}

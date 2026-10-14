import { z } from "zod";
import { request } from "../../api/client";
import { postSchema } from "../../domain/schemas";
import type { SocialPost } from "../../domain/models";
export const getPosts = async (): Promise<SocialPost[]> =>
  (await request("/api/team/posts", z.object({ posts: z.array(postSchema) })))
    .posts;
const pending = new Map<
  string,
  { latest: SocialPost | null; promise: Promise<SocialPost> }
>();
const versions = new Map<string, number>();
export function savePost(post: SocialPost): Promise<SocialPost> {
  const existing = pending.get(post.id);
  if (existing) {
    existing.latest = post;
    return existing.promise;
  }
  const state: { latest: SocialPost | null; promise: Promise<SocialPost> } = {
    latest: post,
    promise: Promise.resolve(post),
  };
  pending.set(post.id, state);
  state.promise = (async () => {
    let saved = post;
    while (state.latest) {
      const latest = state.latest;
      state.latest = null;
      const version = versions.get(latest.id) ?? latest.version;
      saved = (
        await request("/api/team/posts", z.object({ post: postSchema }), {
          method: "POST",
          body: { post: { ...latest, ...(version ? { version } : {}) } },
        })
      ).post;
      if (saved.version) versions.set(saved.id, saved.version);
    }
    return saved;
  })().finally(() => pending.delete(post.id));
  return state.promise;
}
export async function removePost(id: string): Promise<{ deleted: boolean }> {
  await pending.get(id)?.promise;
  return request(
    `/api/team/posts/${encodeURIComponent(id)}`,
    z.object({ deleted: z.boolean() }),
    { method: "DELETE" },
  );
}

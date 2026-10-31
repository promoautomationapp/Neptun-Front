import { expect, it } from "vitest";
import { createPost } from "../../src/features/social/postModel";
import {
  annotateSocialPost,
  socialComments,
  type AnnotatedSocialPost,
} from "../../src/features/social/socialAnnotations";
import { postSchema } from "../../src/domain/schemas";
import { setLanguage } from "../../src/features/brochure/i18n";
const user = { email: "staff@example.test", role: "staff" as const };
it("persists anchored comments, replies, resolve actor and action ids through post serialization", () => {
  setLanguage("en");
  const post = createPost();
  expect(
    annotateSocialPost(post, user, [
      "comment",
      {
        pageIndex: 0,
        pageLabel: "Social",
        position: { x: 25, y: 40 },
        text: "Move this",
        mentions: ["pm@example.test"],
      },
    ]),
  ).toBe(true);
  const id = socialComments(post)[0]!.id!;
  expect(
    annotateSocialPost(post, user, [
      "reply",
      { commentId: id, text: "Adjusted", mention: "pm@example.test" },
    ]),
  ).toBe(true);
  expect(annotateSocialPost(post, user, ["fix", { commentId: id }])).toBe(true);
  const restored = postSchema.parse(
    JSON.parse(JSON.stringify(post)),
  ) as AnnotatedSocialPost;
  expect(restored.notificationLanguage).toBe("en");
  expect(restored.reviewComments?.[0]).toMatchObject({
    position: { x: 25, y: 40 },
    authorEmail: user.email,
    fixed: true,
    fixedBy: user.email,
    replies: [{ text: "Adjusted", authorEmail: user.email }],
  });
  expect(restored.reviewHistory?.map((item) => item.action)).toEqual([
    "comment",
    "reply",
    "fix",
  ]);
  expect(new Set(restored.reviewHistory?.map((item) => item.id)).size).toBe(3);
});
it("rejects unsigned, empty and missing-thread actions and limits resolution to editors", () => {
  const post = createPost();
  expect(
    annotateSocialPost(post, null, [
      "comment",
      { pageIndex: 0, pageLabel: "Post", text: "No actor" },
    ]),
  ).toBe(false);
  expect(
    annotateSocialPost(post, user, [
      "reply",
      { commentId: "missing", text: "Reply", mention: "" },
    ]),
  ).toBe(false);
  expect(
    annotateSocialPost(post, user, [
      "comment",
      { pageIndex: 0, pageLabel: "Post", text: " " },
    ]),
  ).toBe(false);
  annotateSocialPost(post, user, [
    "comment",
    { pageIndex: 0, pageLabel: "Post", text: "Check" },
  ]);
  expect(
    annotateSocialPost(post, { email: "pm@example.test", role: "pm" }, [
      "fix",
      { commentId: socialComments(post)[0]?.id },
    ]),
  ).toBe(false);
  expect(socialComments(post)[0]?.fixed).toBe(false);
});

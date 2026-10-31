import type { Campaign, SocialPost } from "../../domain/models";
import type {
  ReviewActionArguments,
  ReviewParticipant,
} from "../brochure/BrochureComments";
import { getLanguage } from "../brochure/i18n";

/** Social annotations use the same message/actor records as brochure reviews. */
export type AnnotatedSocialPost = SocialPost &
  Pick<Campaign, "reviewComments" | "reviewHistory">;
export function socialComments(post: SocialPost) {
  return (post as AnnotatedSocialPost).reviewComments || [];
}

export function annotateSocialPost(
  post: SocialPost,
  user: ReviewParticipant | null | undefined,
  args: ReviewActionArguments,
): boolean {
  if (!user?.email || user.disabled || user.active === false) return false;
  const [action, details] = args;
  const annotated = post as AnnotatedSocialPost;
  const comments = (annotated.reviewComments ||= []);
  const at = new Date().toISOString();
  let commentId: string | undefined;
  if (action === "comment" || action === "reply") {
    const text = details.text.trim();
    if (!text || text.length > 2000) return false;
    const message = {
      id: crypto.randomUUID(),
      text,
      authorEmail: user.email,
      createdAt: at,
      mention: details.mention || "",
      mentions: [...new Set(details.mentions || [])].slice(0, 20),
    };
    if (action === "comment" && "pageIndex" in details) {
      const point = details.position;
      const position =
        point && Number.isFinite(point.x) && Number.isFinite(point.y)
          ? {
              x: Math.max(1, Math.min(99, point.x)),
              y: Math.max(1, Math.min(99, point.y)),
            }
          : null;
      comments.push({
        ...message,
        pageIndex: 0,
        pageLabel: post.name,
        position,
        replies: [],
        fixed: false,
      });
      commentId = message.id;
    } else if (action === "reply" && "commentId" in details) {
      const comment = comments.find((item) => item.id === details.commentId);
      if (!comment) return false;
      (comment.replies ||= []).push(message);
      commentId = comment.id;
    } else return false;
  } else {
    if (!["staff", "admin", "superadmin"].includes(user.role)) return false;
    const comment = comments.find((item) => item.id === details.commentId);
    if (!comment || comment.fixed) return false;
    Object.assign(comment, { fixed: true, fixedAt: at, fixedBy: user.email });
    commentId = comment.id;
  }
  (annotated.reviewHistory ||= []).push({
    id: crypto.randomUUID(),
    action,
    actor: user.email,
    role: user.role,
    at,
    commentId,
  });
  post.notificationLanguage = getLanguage() === "sq" ? "sq" : "en";
  return true;
}

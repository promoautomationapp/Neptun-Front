import React, { useEffect, useRef, useState } from "react";
import type { Campaign } from "../../domain/models";
import { t } from "./i18n";
import { reviewCommentsForLayout } from "./campaignPages";
import { CommentForm } from "./BrochureComments";
import type {
  BrochureCommentsProps,
  ReviewParticipant,
} from "./BrochureComments";

export const REVIEW_STATUS = {
  in_progress: "In progress",
  in_review: "In review",
  changes_requested: "Changes requested",
  completed: "Completed",
};

export type ReviewStatus = keyof typeof REVIEW_STATUS;

export interface ReviewPanelProps extends Omit<
  BrochureCommentsProps,
  "campaign" | "members"
> {
  campaign: BrochureCommentsProps["campaign"] &
    Pick<Partial<Campaign>, "status">;
  members?: readonly ReviewParticipant[];
}

export function ReviewPanel({
  campaign,
  user,
  members = [],
  pageIndex,
  pageLabel,
  onAction,
  focusedCommentId,
}: ReviewPanelProps) {
  const root = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const status = campaign.status || "in_progress";
  const comments = reviewCommentsForLayout(campaign).filter(
    (item) => item.pageIndex === pageIndex,
  );
  const openCount = (campaign.reviewComments || []).filter(
    (item) => !item.fixed,
  ).length;
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const canComment = user?.role === "staff" || user?.role === "pm" || isAdmin;
  useEffect(() => {
    if (!focusedCommentId) return;
    const article = [
      ...(root.current?.querySelectorAll<HTMLElement>(
        "[data-review-comment-id]",
      ) || []),
    ].find((item) => item.dataset.reviewCommentId === focusedCommentId);
    article?.scrollIntoView?.({ block: "nearest" });
  }, [focusedCommentId, pageIndex, comments.length]);

  return (
    <section
      ref={root}
      className="cs-review-panel"
      aria-label={t("Page review comments")}
    >
      <div className="cs-review-panel-head">
        <div>
          <span className="cs-label">{t("PAGE REVIEW")}</span>
          <h4>
            {t("Comments for")} {pageLabel}
          </h4>
        </div>
        <span className="cs-review-count">{comments.length}</span>
      </div>
      {comments.length ? (
        <div className="cs-review-comments">
          {comments.map((item) => (
            <article
              key={item.id}
              data-review-comment-id={item.id}
              data-focused={item.id === focusedCommentId || undefined}
              className={item.fixed ? "fixed" : "open"}
            >
              <div className="cs-review-comment-meta">
                <strong>{item.authorEmail}</strong>
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt ?? Number.NaN).toLocaleString()}
                </time>
              </div>
              <p>{item.text}</p>
              {(item.mentions?.length
                ? item.mentions
                : item.mention
                  ? [item.mention]
                  : []
              ).map((email) => (
                <small key={email} className="cs-pin-mention">
                  @{email}
                </small>
              ))}
              {(item.replies || []).map((reply) => (
                <div className="cs-review-reply" key={reply.id}>
                  <strong>{reply.authorEmail}</strong>
                  {(reply.mentions?.length
                    ? reply.mentions
                    : reply.mention
                      ? [reply.mention]
                      : []
                  ).map((email) => (
                    <small key={email}> @{email}</small>
                  ))}
                  <p>{reply.text}</p>
                </div>
              ))}
              <div className="cs-review-comment-bottom">
                <span>{t(item.fixed ? "Fixed" : "Needs fixing")}</span>
                {(user?.role === "staff" || isAdmin) && !item.fixed && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await onAction("fix", { commentId: item.id });
                      setBusy(false);
                    }}
                  >
                    {t("Mark resolved")}
                  </button>
                )}
              </div>
              <details className="cs-review-reply-form">
                <summary>{t("Reply")}</summary>
                <CommentForm
                  label={t("Write a reply")}
                  buttonLabel="Post reply"
                  members={members}
                  user={user}
                  busy={busy}
                  onSave={async (reply, mention, mentions = []) => {
                    setBusy(true);
                    try {
                      return await onAction("reply", {
                        commentId: item.id,
                        text: reply,
                        mention,
                        ...(mentions.length ? { mentions } : {}),
                      });
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </details>
            </article>
          ))}
        </div>
      ) : (
        <p className="cs-review-empty">{t("No comments on this page yet.")}</p>
      )}
      {canComment && (
        <CommentForm
          key={pageIndex}
          label={t("Add a comment for this page")}
          buttonLabel="Add comment"
          members={members}
          user={user}
          busy={busy}
          onSave={async (text, mention, mentions = []) => {
            setBusy(true);
            try {
              return await onAction("comment", {
                pageIndex,
                pageLabel,
                text,
                ...(mention ? { mention } : {}),
                ...(mentions.length ? { mentions } : {}),
              });
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {(user?.role === "staff" || isAdmin) &&
        status === "changes_requested" && (
          <p className="cs-review-help">
            {openCount
              ? `${openCount} ${t("comments still need fixing.")}`
              : t(
                  "All comments are fixed. Submit for review again or complete the brochure.",
                )}
          </p>
        )}
    </section>
  );
}

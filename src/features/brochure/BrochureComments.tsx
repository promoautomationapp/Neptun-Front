import { SearchableSelect } from "../../components/SearchableSelect";
import React, { useState } from "react";
import type {
  Campaign,
  CampaignReviewCommentsItem,
  ReviewReply,
} from "../../domain/models";
import type { User } from "../auth/auth.api";
import { t } from "./i18n";
import { roleLabel } from "../auth/auth.api";
import { reviewCommentsForLayout } from "./campaignPages";

export type ReviewParticipant = Pick<User, "email" | "role">;
export type ReviewPosition = NonNullable<
  CampaignReviewCommentsItem["position"]
>;

export type ReviewActionArguments =
  | [
      action: "comment",
      details: {
        pageIndex: number;
        pageLabel: string;
        position?: ReviewPosition | null;
        text: string;
        mention?: string;
      },
    ]
  | [
      action: "reply",
      details: { commentId?: string; text: string; mention: string },
    ]
  | [action: "fix", details: { commentId?: string }];

export type ReviewActionHandler = (
  ...args: ReviewActionArguments
) => boolean | Promise<boolean>;

export interface CommentFormProps {
  label: string;
  members: readonly ReviewParticipant[];
  user: ReviewParticipant | null | undefined;
  busy: boolean;
  onSave: (text: string, mention: string) => boolean | Promise<boolean>;
  buttonLabel?: string;
  autoFocus?: boolean;
}

export interface BrochureCommentsProps {
  campaign: Partial<Pick<Campaign, "reviewComments" | "reviewPagePlacements">>;
  pageIndex: number;
  pageLabel: string;
  user: ReviewParticipant | null | undefined;
  members: readonly ReviewParticipant[];
  onAction: ReviewActionHandler;
}

type PositionedComment = CampaignReviewCommentsItem & {
  position: ReviewPosition;
};

export function CommentForm({
  label,
  members,
  user,
  busy,
  onSave,
  buttonLabel = "Post comment",
  autoFocus = false,
}: CommentFormProps) {
  const [text, setText] = useState("");
  const [mention, setMention] = useState("");
  return (
    <form
      className="cs-pin-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim() || busy) return;
        if (await onSave(text.trim(), mention)) {
          setText("");
          setMention("");
        }
      }}
    >
      <label>
        {label}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={2000}
          autoFocus={autoFocus}
        />
      </label>
      <label>
        {t("Mention a teammate")}
        <SearchableSelect
          value={mention}
          onChange={(event) => setMention(event.target.value)}
        >
          <option value="">{t("No mention")}</option>
          {members
            .filter((member) => member.email !== user?.email)
            .map((member) => (
              <option key={member.email} value={member.email}>
                @{member.email} ·{" "}
                {t(roleLabel(member.role))}
              </option>
            ))}
        </SearchableSelect>
      </label>
      <button type="submit" disabled={busy || !text.trim()}>
        {busy ? t("Saving…") : t(buttonLabel)}
      </button>
    </form>
  );
}

function ThreadMessage({
  message,
}: {
  message: CampaignReviewCommentsItem | ReviewReply;
}) {
  return (
    <div className="cs-pin-message">
      <div>
        <strong>{message.authorEmail}</strong>
        <time dateTime={message.createdAt}>
          {new Date(message.createdAt ?? Number.NaN).toLocaleString()}
        </time>
      </div>
      {message.mention && (
        <span className="cs-pin-mention">@{message.mention}</span>
      )}
      <p>{message.text}</p>
    </div>
  );
}

export function BrochureComments({
  campaign,
  pageIndex,
  pageLabel,
  user,
  members,
  onAction,
}: BrochureCommentsProps) {
  const [pending, setPending] = useState<ReviewPosition | null>(null);
  const [activeId, setActiveId] = useState<string | undefined | null>(null);
  const [busy, setBusy] = useState(false);
  const comments = reviewCommentsForLayout(campaign).filter(
    (item): item is PositionedComment =>
      item.pageIndex === pageIndex && Boolean(item.position),
  );
  const active = comments.find((item) => item.id === activeId);
  const point = active?.position || pending;
  const close = () => {
    setPending(null);
    setActiveId(null);
  };
  async function save(...args: ReviewActionArguments) {
    setBusy(true);
    try {
      return await onAction(...args);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="cs-comment-layer"
      aria-label={t("Brochure comments")}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setPending({
          x: Math.max(
            1,
            Math.min(99, ((event.clientX - rect.left) / rect.width) * 100),
          ),
          y: Math.max(
            1,
            Math.min(99, ((event.clientY - rect.top) / rect.height) * 100),
          ),
        });
        setActiveId(null);
      }}
    >
      {comments.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={`cs-comment-pin ${item.fixed ? "resolved" : ""} ${activeId === item.id ? "active" : ""}`}
          style={{ left: `${item.position.x}%`, top: `${item.position.y}%` }}
          aria-label={`${t("Comment")} ${index + 1}: ${item.text}`}
          title={item.text}
          onClick={(event) => {
            event.stopPropagation();
            setActiveId(item.id);
            setPending(null);
          }}
        >
          {index + 1}
        </button>
      ))}
      {pending && (
        <span
          className="cs-comment-pin draft"
          style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
        >
          +
        </span>
      )}
      {point && (
        <section
          className="cs-comment-popover"
          style={
            point.x > 55
              ? {
                  right: `${100 - point.x}%`,
                  ...(point.y > 58
                    ? { bottom: `${100 - point.y}%` }
                    : { top: `${point.y}%` }),
                }
              : {
                  left: `${point.x}%`,
                  ...(point.y > 58
                    ? { bottom: `${100 - point.y}%` }
                    : { top: `${point.y}%` }),
                }
          }
          onClick={(event) => event.stopPropagation()}
        >
          <header>
            <strong>
              {active
                ? `${t("Comment")} · ${active.fixed ? t("Resolved") : t("Open")}`
                : t("Add a comment here")}
            </strong>
            <button
              type="button"
              aria-label={t("Close comments")}
              onClick={close}
            >
              ×
            </button>
          </header>
          {active && (
            <div className="cs-pin-thread">
              <ThreadMessage message={active} />
              {(active.replies || []).map((reply) => (
                <ThreadMessage key={reply.id} message={reply} />
              ))}
            </div>
          )}
          {active && (user?.role === "staff" || user?.role === "admin" || user?.role === "superadmin") && !active.fixed && (
            <button
              className="cs-pin-resolve"
              type="button"
              disabled={busy}
              onClick={() => save("fix", { commentId: active.id })}
            >
              ✓ {t("Mark resolved")}
            </button>
          )}
          <CommentForm
            key={active?.id || "new"}
            label={active ? t("Write a reply") : t("Your comment")}
            buttonLabel={active ? "Post reply" : "Post comment"}
            autoFocus
            members={members}
            user={user}
            busy={busy}
            onSave={async (text, mention) => {
              const okay = active
                ? await save("reply", { commentId: active.id, text, mention })
                : await save("comment", {
                    pageIndex,
                    pageLabel,
                    position: pending,
                    text,
                    mention,
                  });
              if (okay && !active) close();
              return okay;
            }}
          />
        </section>
      )}
    </div>
  );
}

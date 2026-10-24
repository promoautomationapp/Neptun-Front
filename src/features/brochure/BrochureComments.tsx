import React, { useEffect, useId, useRef, useState } from "react";
import type {
  Campaign,
  CampaignReviewCommentsItem,
  ReviewReply,
} from "../../domain/models";
import type { User } from "../auth/auth.api";
import { t } from "./i18n";
import { MentionTextarea, mentionableMembers } from "./MentionInput";
import { reviewCommentsForLayout } from "./campaignPages";

export type ReviewParticipant = Pick<User, "email" | "role"> & {
  id?: string;
  name?: string;
  username?: string;
  status?: string;
  isSupport?: boolean;
  active?: boolean;
  disabled?: boolean;
};
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
        mentions?: string[];
      },
    ]
  | [
      action: "reply",
      details: {
        commentId?: string;
        text: string;
        mention: string;
        mentions?: string[];
      },
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
  onSave: (
    text: string,
    mention: string,
    mentions?: string[],
  ) => boolean | Promise<boolean>;
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
  focusedCommentId?: string | null;
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
  const [mentions, setMentions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  const id = useId();
  return (
    <form
      className="cs-pin-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim() || busy || locked.current) return;
        locked.current = true;
        setSaving(true);
        setError(false);
        try {
          const eligible = mentionableMembers(members, user);
          const recipients = mentions
            .filter((email) =>
              eligible.some((member) => member.email === email),
            )
            .slice(0, 20);
          if (await onSave(text.trim(), recipients[0] || "", recipients)) {
            setText("");
            setMentions([]);
          } else setError(true);
        } catch {
          setError(true);
        } finally {
          locked.current = false;
          setSaving(false);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <MentionTextarea
        id={id}
        value={text}
        onTextChange={setText}
        mentions={mentions}
        onMentionsChange={setMentions}
        members={members}
        user={user}
        rows={3}
        maxLength={2000}
        autoFocus={autoFocus}
      />
      {error && (
        <p className="cs-pin-form-error" role="alert">
          {t("Could not save the comment. Your draft is kept.")}
        </p>
      )}
      <button type="submit" disabled={busy || saving || !text.trim()}>
        {busy || saving ? t("Saving…") : t(buttonLabel)}
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
        <span className="cs-pin-author">
          <span className="cs-comment-avatar" aria-hidden="true">
            {(message.authorEmail || "?").slice(0, 2).toUpperCase()}
          </span>
          <strong>{message.authorEmail}</strong>
        </span>
        <time dateTime={message.createdAt}>
          {new Date(message.createdAt ?? Number.NaN).toLocaleString()}
        </time>
      </div>
      {(message.mentions?.length
        ? message.mentions
        : message.mention
          ? [message.mention]
          : []
      ).map((email) => (
        <span key={email} className="cs-pin-mention">
          @{email}
        </span>
      ))}
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
  focusedCommentId,
}: BrochureCommentsProps) {
  const [pending, setPending] = useState<ReviewPosition | null>(null);
  const [activeId, setActiveId] = useState<string | undefined | null>(null);
  const [busy, setBusy] = useState(false);
  const comments = reviewCommentsForLayout(campaign).filter(
    (item): item is PositionedComment =>
      item.pageIndex === pageIndex && Boolean(item.position),
  );
  const focusExists = Boolean(
    focusedCommentId && comments.some((item) => item.id === focusedCommentId),
  );
  useEffect(() => {
    if (focusExists) {
      setActiveId(focusedCommentId);
      setPending(null);
    }
  }, [focusedCommentId, focusExists, pageIndex]);
  const active = comments.find((item) => item.id === activeId);
  const point = active?.position || pending;
  useEffect(() => {
    if (!point) return;
    const dismiss = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !(event.target as Element)?.closest?.(".cs-mention-suggestions")
      ) {
        setPending(null);
        setActiveId(null);
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [point]);
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
          role="dialog"
          aria-label={t(active ? "Comment thread" : "Add a comment here")}
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
            <span className={`cs-comment-status ${active.fixed ? "" : "open"}`}>
              {t(active.fixed ? "Resolved" : "Open")}
            </span>
          )}
          {active && (
            <div className="cs-pin-thread">
              <ThreadMessage message={active} />
              {(active.replies || []).map((reply) => (
                <ThreadMessage key={reply.id} message={reply} />
              ))}
            </div>
          )}
          {active &&
            (user?.role === "staff" ||
              user?.role === "admin" ||
              user?.role === "superadmin") &&
            !active.fixed && (
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
            autoFocus={!active}
            members={members}
            user={user}
            busy={busy}
            onSave={async (text, mention, mentions = []) => {
              const okay = active
                ? await save("reply", {
                    commentId: active.id,
                    text,
                    mention,
                    ...(mentions.length ? { mentions } : {}),
                  })
                : await save("comment", {
                    pageIndex,
                    pageLabel,
                    position: pending,
                    text,
                    mention,
                    ...(mentions.length ? { mentions } : {}),
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

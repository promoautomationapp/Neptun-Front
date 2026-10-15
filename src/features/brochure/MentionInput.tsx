import { useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import type { ReviewParticipant } from "./BrochureComments";
import { roleLabel } from "../auth/auth.api";
import { matchesSearch } from "./searchText";
import { t } from "./i18n";
import "../../styles/comment-mentions.css";

export function mentionableMembers(
  members: readonly ReviewParticipant[],
  user?: ReviewParticipant | null,
) {
  const unique = new Map<string, ReviewParticipant>();
  for (const member of members) {
    const email = member.email.trim().toLowerCase();
    if (
      !email ||
      email === user?.email.trim().toLowerCase() ||
      member.role === "superadmin" ||
      member.isSupport ||
      member.disabled ||
      member.active === false ||
      (member.status && member.status !== "active")
    )
      continue;
    unique.set(email, { ...member, email });
  }
  return [...unique.values()];
}
const displayName = (member: ReviewParticipant) =>
  member.name?.trim() || member.username?.trim() || member.email;
interface Range {
  start: number;
  end: number;
  query: string;
}
export function MentionTextarea({
  value,
  onTextChange,
  mentions,
  onMentionsChange,
  members,
  user,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onTextChange: (text: string) => void;
  mentions: readonly string[];
  onMentionsChange: (emails: string[]) => void;
  members: readonly ReviewParticipant[];
  user?: ReviewParticipant | null;
}) {
  const id = useId(),
    textarea = useRef<HTMLTextAreaElement>(null);
  const [range, setRange] = useState<Range | null>(null),
    [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const popup = useRef<HTMLDivElement>(null);
  const isOpen = Boolean(range);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = textarea.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 250), window.innerWidth - 24);
      const above = rect.top - 12,
        below = window.innerHeight - rect.bottom - 12;
      const useAbove = above >= 150 || above > below;
      setPosition({
        position: "fixed",
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        width,
        right: "auto",
        maxHeight: Math.min(210, Math.max(100, (useAbove ? above : below) - 6)),
        ...(useAbove
          ? { bottom: window.innerHeight - rect.top + 6, top: "auto" }
          : { top: rect.bottom + 6, bottom: "auto" }),
      });
    };
    place();
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !textarea.current?.contains(event.target) &&
        !popup.current?.contains(event.target)
      )
        setRange(null);
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [isOpen]);
  const eligible = mentionableMembers(members, user);
  const selected = eligible.filter((member) => mentions.includes(member.email));
  const choices =
    range && selected.length < 20
      ? eligible.filter(
          (member) =>
            !mentions.includes(member.email) &&
            matchesSearch(
              `${displayName(member)} ${member.username || ""} ${member.email}`,
              range.query,
            ),
        )
      : [];
  function inspect(text: string, caret: number) {
    const before = text.slice(0, caret);
    const match = [...before.matchAll(/(^|[\s(])@/g)].at(-1);
    if (!match) {
      setRange(null);
      return;
    }
    const start = (match.index || 0) + (match[1]?.length || 0);
    const query = before.slice(start + 1);
    if (query.includes("\n") || query.length > 254) {
      setRange(null);
      return;
    }
    if (
      selected.some((member) =>
        text.slice(start).startsWith(`@${member.email}`),
      )
    ) {
      setRange(null);
      return;
    }
    setRange({ start, end: caret, query });
    setHighlight(0);
  }
  function choose(member: ReviewParticipant) {
    if (!range) return;
    const inserted = `@${member.email} `;
    onTextChange(
      value.slice(0, range.start) + inserted + value.slice(range.end),
    );
    onMentionsChange([...new Set([...mentions, member.email])].slice(0, 20));
    setRange(null);
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(
        range.start + inserted.length,
        range.start + inserted.length,
      );
    });
  }
  return (
    <div className="cs-mention-input">
      <textarea
        {...props}
        ref={textarea}
        value={value}
        aria-autocomplete="list"
        aria-controls={range ? `${id}-options` : undefined}
        aria-activedescendant={
          range && choices[highlight] ? `${id}-option-${highlight}` : undefined
        }
        onChange={(event) => {
          const text = event.target.value;
          onTextChange(text);
          onMentionsChange(
            mentions.filter((email) => text.includes(`@${email}`)),
          );
          inspect(text, event.target.selectionStart);
        }}
        onClick={(event) => inspect(value, event.currentTarget.selectionStart)}
        onBlur={() => setRange(null)}
        onKeyDown={(event) => {
          if (!range) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setRange(null);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight(
              (current) =>
                (current +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  Math.max(1, choices.length)) %
                Math.max(1, choices.length),
            );
          } else if (event.key === "Enter" && choices[highlight]) {
            event.preventDefault();
            choose(choices[highlight]);
          } else if (event.key === "Tab") setRange(null);
        }}
      />
      {range &&
        createPortal(
          <div
            className="cs-mention-options"
            ref={popup}
            style={position}
            id={`${id}-options`}
            role="listbox"
            aria-label={t("Mention a teammate")}
          >
            {choices.length ? (
              choices.map((member, index) => (
                <button
                  key={member.email}
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={highlight === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(member)}
                >
                  <span>
                    <strong>{displayName(member)}</strong>
                    <small>{member.email}</small>
                  </span>
                  <em>{t(roleLabel(member.role))}</em>
                </button>
              ))
            ) : (
              <p>{t("No matching teammates")}</p>
            )}
          </div>,
          document.body,
        )}
      {selected.length ? (
        <div className="cs-selected-mentions">
          {selected.map((member) => (
            <div
              className="cs-selected-mention"
              key={member.email}
              title={member.email}
            >
              <span>@{displayName(member)}</span>
              <button
                type="button"
                aria-label={
                  selected.length === 1
                    ? t("Remove mention")
                    : `${t("Remove mention")}: ${member.email}`
                }
                onClick={() => {
                  onMentionsChange(
                    mentions.filter((email) => email !== member.email),
                  );
                  onTextChange(value.replace(`@${member.email}`, ""));
                  setRange(null);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <small className="cs-mention-hint">
          {t("Type @ to mention a teammate")}
        </small>
      )}
    </div>
  );
}

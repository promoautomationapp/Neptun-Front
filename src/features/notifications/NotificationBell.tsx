import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { getLanguage } from "../brochure/i18n";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.api";
import type {
  NotificationFeed,
  NotificationFilter,
  WorkspaceNotification,
} from "./notifications.api";
import "./notifications.css";
const text = (english: string, albanian: string) =>
  getLanguage() === "sq" ? albanian : english;
const labels = {
  review_submitted: ["Ready for review", "Gati për shqyrtim"],
  mention: ["You were mentioned", "Ju përmendën"],
  review_comment: ["New review comment", "Koment i ri në shqyrtim"],
  review_reply: ["New reply", "Përgjigje e re"],
} as const;
interface BellProps {
  onOpen: (notification: WorkspaceNotification) => void | Promise<void>;
  enabled?: boolean;
}
export function NotificationBell({ onOpen, enabled = true }: BellProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState<string[]>([]);
  const [readAll, setReadAll] = useState(false);
  const [position, setPosition] = useState({
    top: 60,
    left: 12,
    width: 400,
    maxHeight: 520,
  });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: number; controller: AbortController } | null>(
    null,
  );
  const sequence = useRef(0);
  const writes = useRef(new Set<string>());
  const cancel = useCallback(() => {
    sequence.current++;
    pending.current?.controller.abort();
    pending.current = null;
  }, []);
  const load = useCallback(
    async (force = false) => {
      if (
        !enabled ||
        pending.current ||
        (!force && document.visibilityState === "hidden")
      )
        return;
      const id = ++sequence.current;
      const controller = new AbortController();
      pending.current = { id, controller };
      setLoading(true);
      try {
        const result = await getNotifications(filter, controller.signal);
        if (!controller.signal.aborted && id === sequence.current) {
          setFeed(result);
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted && id === sequence.current)
          setError(
            cause instanceof Error
              ? cause.message
              : text(
                  "Could not check notifications.",
                  "Njoftimet nuk mund të kontrolloheshin.",
                ),
          );
      } finally {
        if (pending.current?.id === id) {
          pending.current = null;
          setLoading(false);
        }
      }
    },
    [enabled, filter],
  );
  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setFeed(null);
      return;
    }
    void load();
    const timer = setInterval(() => {
      void load();
    }, 45000);
    const wake = () => {
      if (document.visibilityState !== "hidden") void load();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("neptun:notifications-updated", wake);
    return () => {
      clearInterval(timer);
      cancel();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("neptun:notifications-updated", wake);
    };
  }, [enabled, load, cancel]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(1, Math.min(410, window.innerWidth - 24));
      const below = window.innerHeight - rect.bottom - 20;
      const height = Math.max(
        160,
        Math.min(560, Math.max(below, rect.top - 20), window.innerHeight - 24),
      );
      const top =
        below >= Math.min(260, height)
          ? rect.bottom + 8
          : Math.max(12, rect.top - height - 8);
      setPosition({
        top,
        left: Math.max(
          12,
          Math.min(rect.right - width, window.innerWidth - width - 12),
        ),
        width,
        maxHeight: Math.min(height, window.innerHeight - top - 12),
      });
    };
    place();
    panel.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const refresh = useCallback(() => {
    cancel();
    void load(true);
  }, [cancel, load]);
  async function markOne(item: WorkspaceNotification) {
    if (item.readAt || writes.current.has(item.id)) return;
    writes.current.add(item.id);
    setReading((ids) => [...ids, item.id]);
    try {
      await markNotificationRead(item.id);
      cancel();
      setFeed((current) => {
        if (!current) return current;
        const wasUnread = current.notifications.some(
          (row) => row.id === item.id && !row.readAt,
        );
        return {
          unreadCount: Math.max(0, current.unreadCount - Number(wasUnread)),
          notifications: current.notifications.map((row) =>
            row.id === item.id
              ? { ...row, readAt: new Date().toISOString() }
              : row,
          ),
        };
      });
      void load(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : text(
              "Could not mark the notification as read.",
              "Njoftimi nuk mund të shënohej si i lexuar.",
            ),
      );
    } finally {
      writes.current.delete(item.id);
      setReading((ids) => ids.filter((id) => id !== item.id));
    }
  }
  async function markAll() {
    if (readAll || !feed?.unreadCount) return;
    setReadAll(true);
    try {
      await markAllNotificationsRead();
      cancel();
      setFeed((current) =>
        current
          ? {
              unreadCount: 0,
              notifications: current.notifications.map((row) => ({
                ...row,
                readAt: row.readAt || new Date().toISOString(),
              })),
            }
          : current,
      );
      void load(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : text(
              "Could not update notifications.",
              "Njoftimet nuk mund të përditësoheshin.",
            ),
      );
    } finally {
      setReadAll(false);
    }
  }
  async function openNotification(item: WorkspaceNotification) {
    setOpen(false);
    void markOne(item);
    try {
      await onOpen(item);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : text(
              "Could not open this campaign.",
              "Kjo fushatë nuk mund të hapej.",
            ),
      );
    }
  }
  if (!enabled) return null;
  const unread = feed?.unreadCount || 0;
  const items = (feed?.notifications || []).filter(
    (item) => filter === "all" || !item.readAt,
  );
  const title = text("Notifications", "Njoftimet");
  return (
    <div className="nn-bell-wrap">
      <button
        ref={trigger}
        className="nn-bell"
        type="button"
        aria-label={`${title}${unread ? ` · ${unread} ${text("unread", "të palexuara")}` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load(true);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unread > 0 && (
          <span className="nn-count" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            className="nn-panel"
            role="dialog"
            aria-label={title}
            tabIndex={-1}
            ref={panel}
            style={position}
          >
            <header>
              <strong>{title}</strong>
              <button
                type="button"
                className="nn-close"
                aria-label={text("Close notifications", "Mbyll njoftimet")}
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                ×
              </button>
            </header>
            <div className="nn-toolbar">
              <div
                role="tablist"
                aria-label={text("Notification filter", "Filtri i njoftimeve")}
              >
                {(
                  [
                    ["all", text("All", "Të gjitha")],
                    ["unread", text("Unread", "Të palexuara")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    role="tab"
                    type="button"
                    aria-selected={filter === value}
                    key={value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="nn-read-all"
                disabled={readAll || !unread}
                onClick={() => {
                  void markAll();
                }}
              >
                {readAll
                  ? text("Saving…", "Po ruhen…")
                  : text("Mark all read", "Shënoji të gjitha si të lexuara")}
              </button>
            </div>
            {error && (
              <div className="nn-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={refresh}>
                  {text("Retry", "Riprovo")}
                </button>
              </div>
            )}
            {loading && (
              <div className="nn-loading" role="status">
                {feed
                  ? text(
                      "Checking for updates…",
                      "Po kontrollohen përditësimet…",
                    )
                  : text("Loading notifications…", "Po ngarkohen njoftimet…")}
              </div>
            )}
            {!loading && !items.length && !error && (
              <p className="nn-empty">
                {filter === "unread"
                  ? text("You're all caught up.", "I keni lexuar të gjitha.")
                  : text("No notifications yet.", "Ende nuk ka njoftime.")}
              </p>
            )}
            <ul className="nn-items">
              {items.map((item) => (
                <li className={item.readAt ? "" : "is-unread"} key={item.id}>
                  <button
                    type="button"
                    className="nn-item-open"
                    onClick={() => {
                      void openNotification(item);
                    }}
                  >
                    <span className="nn-type">
                      {text(labels[item.type][0], labels[item.type][1])}
                    </span>
                    <strong>{item.campaignName}</strong>
                    <span className="nn-message">{item.message}</span>
                    <small>
                      {item.actorName ||
                        text("Workspace team", "Ekipi i hapësirës")}{" "}
                      ·{" "}
                      <time dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleString(
                          getLanguage() === "sq" ? "sq-AL" : "en-GB",
                          { dateStyle: "short", timeStyle: "short" },
                        )}
                      </time>
                      {item.pageIndex !== null
                        ? ` · ${text("Page", "Faqja")} ${item.pageIndex + 1}`
                        : ""}
                    </small>
                  </button>
                  {!item.readAt && (
                    <button
                      className="nn-mark-one"
                      type="button"
                      disabled={reading.includes(item.id) || readAll}
                      aria-label={`${text("Mark as read", "Shëno si të lexuar")}: ${item.campaignName}`}
                      onClick={() => {
                        void markOne(item);
                      }}
                    >
                      ✓
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

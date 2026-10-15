import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../../components/Modal";
import { NavIcon } from "../studio/NavIcon";
import { apiFetch } from "../../api/client";
import { getLanguage, t } from "../brochure/i18n";
import "../../styles/catalog-refresh.css";
interface RefreshStatus {
  status: "idle" | "queued" | "running" | "completed" | "failed";
  runId?: string | null;
  lastSuccessfulAt?: string | null;
  completedAt?: string | null;
  processed?: number;
  total?: number;
  added?: number;
  updated?: number;
  missing?: number;
  error?: string | null;
  revision?: string;
  imagesPending?: number;
}
async function refreshRequest(
  method: "GET" | "POST",
  signal?: AbortSignal,
): Promise<RefreshStatus> {
  const response = await apiFetch("/api/catalog/refresh", {
    method,
    signal,
    ...(method === "POST"
      ? { headers: { "Content-Type": "application/json" }, body: "{}" }
      : {}),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      value.error || "Could not refresh the catalog. Please retry.",
    );
  return value;
}
export function CatalogRefreshControl({
  onUpdated,
  showLastUpdated = true,
}: {
  onUpdated: () => Promise<void> | void;
  showLastUpdated?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);
  const callback = useRef(onUpdated);
  callback.current = onUpdated;
  const previous = useRef<string | null>(null);
  const previousImages = useRef(0);
  const initialized = useRef(false);
  const pollNow = useRef(() => {});
  const busy =
    starting || status?.status === "queued" || status?.status === "running";
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let pending: AbortController | undefined;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      clearTimeout(timer);
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const next = await refreshRequest("GET", controller.signal);
        if (controller.signal.aborted) return;
        setStatus(next);
        setError("");
        const version = next.lastSuccessfulAt || null;
        const photosFinished =
          previousImages.current > 0 && !next.imagesPending;
        const settled = next.status === "completed" || next.status === "failed";
        const notify =
          initialized.current &&
          ((version && previous.current !== version) ||
            (settled && photosFinished));
        previous.current = version;
        previousImages.current = next.imagesPending || 0;
        initialized.current = true;
        if (notify) await callback.current();
        if (controller.signal.aborted) return;
        timer = setTimeout(
          poll,
          next.status === "queued" || next.status === "running"
            ? 2500
            : next.imagesPending
              ? 15000
              : 60000,
        );
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not check catalog updates.",
        );
        timer = setTimeout(poll, 30000);
      }
    };
    pollNow.current = () => {
      void poll();
    };
    void poll();
    return () => {
      stopped = true;
      pending?.abort();
      clearTimeout(timer);
      pollNow.current = () => {};
    };
  }, []);
  async function start() {
    if (busy) return;
    setStarting(true);
    setStartError("");
    try {
      setStatus(await refreshRequest("POST"));
    } catch (cause) {
      setStartError(
        cause instanceof Error ? cause.message : "Could not start the update.",
      );
    } finally {
      setStarting(false);
      pollNow.current();
    }
  }
  const updated = status?.lastSuccessfulAt;
  const time =
    updated && !Number.isNaN(Date.parse(updated))
      ? new Intl.DateTimeFormat(getLanguage() === "sq" ? "sq-AL" : "en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(updated))
      : t("Not synced yet");
  const failure =
    startError ||
    error ||
    (status?.status === "failed"
      ? status.error || t("Update failed. Existing products are kept.")
      : "");
  const progress = busy
    ? status?.total
      ? `${status.processed || 0}/${status.total} ${t("products")}`
      : t("Starting update…")
    : t(status?.status === "completed" ? "Up to date" : "Not synced yet");
  const percent = status?.total
    ? Math.min(100, Math.max(0, ((status.processed || 0) / status.total) * 100))
    : undefined;
  const closeDetails = () => {
    setDetailsOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="cs-catalog-refresh">
      <button
        ref={trigger}
        className={`cs-catalog-refresh-button${busy ? " is-busy" : ""}${failure ? " has-error" : ""}`}
        type="button"
        onClick={() => setDetailsOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("View catalog update details")}
        title={t(
          busy
            ? "Catalog is updating"
            : failure
              ? "Catalog needs attention"
              : "View catalog update details",
        )}
      >
        <span className={busy ? "is-refreshing" : ""}>
          <NavIcon name="refresh" size={18} />
        </span>
        <span>{t("Catalog")}</span>
        {(busy || failure) && (
          <span
            className="cs-catalog-indicator"
            aria-label={t(
              busy ? "Catalog is updating" : "Catalog needs attention",
            )}
          />
        )}
      </button>
      {detailsOpen &&
        createPortal(
          <Modal
            title={t("Catalog update")}
            kicker="NEPTUN"
            onClose={closeDetails}
          >
            <div className="cs-catalog-details">
              <div className="cs-catalog-source">
                <span className="cs-catalog-source-icon">
                  <NavIcon name="catalog" size={25} />
                </span>
                <div>
                  <strong>neptun-ks.com</strong>
                  <small>{t("Source")}</small>
                </div>
              </div>
              <p>
                {t(
                  "Updates run once daily at 03:00. You can also start an update here.",
                )}
              </p>
              {showLastUpdated && (
                <dl className="cs-catalog-last-update">
                  <dt>{t("Last updated")}</dt>
                  <dd>{time}</dd>
                </dl>
              )}
              <div
                className="cs-catalog-progress"
                role="status"
                aria-live="polite"
              >
                <strong>{progress}</strong>
                {busy && (
                  <progress
                    aria-label={t("Catalog update progress")}
                    max={100}
                    {...(percent === undefined ? {} : { value: percent })}
                  />
                )}
              </div>
              {!busy && status?.status === "completed" && (
                <dl className="cs-catalog-counts">
                  <div>
                    <dt>{t("Added")}</dt>
                    <dd>{status.added ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("Updated")}</dt>
                    <dd>{status.updated ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("Kept from earlier updates")}</dt>
                    <dd>{status.missing ?? "—"}</dd>
                  </div>
                </dl>
              )}
              {failure && (
                <div className="cs-catalog-refresh-error" role="alert">
                  {failure}
                </div>
              )}
              <p className="cs-catalog-retention-note">
                {t(
                  "Saved products remain available while the catalog updates.",
                )}{" "}
                {t(
                  "Products not found on the website are kept in your catalog.",
                )}
              </p>
            </div>
            <div className="cs-modal-actions">
              <button
                type="button"
                className="cs-button"
                onClick={closeDetails}
              >
                {t("Close")}
              </button>
              <button
                className="cs-button primary cs-catalog-detail-action"
                type="button"
                onClick={start}
                disabled={busy}
                aria-busy={busy}
              >
                <NavIcon name="refresh" size={17} />
                {t(busy ? "Updating catalog…" : "Fetch products again")}
              </button>
            </div>
          </Modal>,
          document.body,
        )}
    </div>
  );
}

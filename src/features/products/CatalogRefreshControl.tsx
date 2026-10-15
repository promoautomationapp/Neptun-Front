import { useEffect, useRef, useState } from "react";
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
  const metadata = busy
    ? status?.total
      ? `${status.processed || 0}/${status.total} ${t("products")}`
      : t("Starting update…")
    : showLastUpdated
      ? `${t("Last updated")}: ${time}`
      : "";
  return (
    <div className="cs-catalog-refresh">
      <button
        className="cs-catalog-refresh-button"
        type="button"
        onClick={start}
        disabled={busy}
        aria-busy={busy}
        title={t("Refresh manually or once daily at 03:00")}
      >
        <span aria-hidden="true" className={busy ? "is-refreshing" : ""}>
          ↻
        </span>
        <span>
          {t(busy ? "Updating catalog…" : "Fetch products again")}
          <small>neptun-ks.com</small>
        </span>
      </button>
      {(failure || metadata) && (
        <small
          className={`cs-catalog-refresh-meta${failure ? " cs-catalog-refresh-error" : ""}`}
          role={failure ? "alert" : "status"}
          title={failure || metadata}
        >
          {failure || metadata}
        </small>
      )}
    </div>
  );
}

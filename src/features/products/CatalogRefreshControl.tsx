import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../api/client";
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
  const [starting, setStarting] = useState(false);
  const callback = useRef(onUpdated);
  callback.current = onUpdated;
  const previous = useRef<string | null>(null);
  const previousRevision = useRef<string | null>(null);
  const previousImages = useRef(0);
  const initialized = useRef(false);
  const busy =
    starting || status?.status === "queued" || status?.status === "running";
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await refreshRequest("GET", controller.signal);
        if (controller.signal.aborted) return;
        setStatus(next);
        setError("");
        const version = next.lastSuccessfulAt || null;
        const photosFinished = previousImages.current > 0 && !next.imagesPending;
        const settled = next.status === "completed" || next.status === "failed";
        const revisionChanged = Boolean(next.revision && previousRevision.current !== next.revision);
        if (initialized.current && ((version && previous.current !== version) || (settled && !next.imagesPending && (photosFinished || revisionChanged))))
          await callback.current();
        previous.current = version;
        previousRevision.current = next.revision || null;
        previousImages.current = next.imagesPending || 0;
        initialized.current = true;
        timer = setTimeout(
          poll,
          next.status === "queued" || next.status === "running" || next.imagesPending ? 2500 : 30000,
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
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [status?.status]);
  async function start() {
    if (busy) return;
    setStarting(true);
    setError("");
    try {
      setStatus(await refreshRequest("POST"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start the update.",
      );
    } finally {
      setStarting(false);
    }
  }
  const updated = status?.lastSuccessfulAt;
  const time =
    updated && !Number.isNaN(Date.parse(updated))
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(updated))
      : "Not synced yet";
  return (
    <div className="cs-catalog-refresh">
      <button
        className="cs-catalog-refresh-button"
        type="button"
        onClick={start}
        disabled={busy}
        aria-busy={busy}
        title="Fetch products again from https://neptun-ks.com/"
      >
        <span aria-hidden="true" className={busy ? "is-refreshing" : ""}>
          ↻
        </span>
        <span>
          {busy ? "Updating catalog…" : "Fetch products again"}
          <small>neptun-ks.com</small>
        </span>
      </button>
      {showLastUpdated && (
        <small className="cs-catalog-updated">Last updated: {time}</small>
      )}
      {busy && (
        <small role="status">
          Working in the background
          {status?.total ? ` · ${status.processed || 0}/${status.total}` : ""}
        </small>
      )}
    {!busy && status?.status === "completed" && (
        <small role="status" className="cs-catalog-refresh-result">
          <span>{status.added || 0} new</span><span aria-hidden="true">·</span>
          <span>{status.updated || 0} updated</span><span aria-hidden="true">·</span>
          <span>{status.missing || 0} no longer listed</span>
        </small>
    )}
    {!busy && Boolean(status?.imagesPending) && <small role="status">Preparing product photos in the background · {status?.imagesPending} remaining</small>}
      {(error || status?.status === "failed") && (
        <small className="cs-catalog-refresh-error" role="alert">
          {error ||
            status?.error ||
            "Update failed. Existing products are kept."}
        </small>
      )}
    </div>
  );
}

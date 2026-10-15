import React, { useEffect, useState } from "react";
import { getAiUsage, getMediaUsage, getDbUsage } from "./insights.api";
import type { AiUsage, MediaUsage, DbUsage } from "./insights.api";
import type { User } from "../auth/auth.api";
import { getLanguage, t } from "../brochure/i18n";
import "../../styles/insights.css";

const operationNames: Record<string, string> = {
  cutout: "Product cutouts",
  brand_prep: "Brand images",
  background: "Background images",
  lifestyle: "Lifestyle images",
  tv_artwork: "TV artwork",
  proofread: "Text proofreading",
  text_generate: "Text generation",
  placement: "AI placement",
  detect_screen: "TV screen detection",
  product_image_search: "Product photo search",
};
const operationLabel = (value: string) => t(operationNames[value] ?? value);
const count = (n: number) =>
  new Intl.NumberFormat(getLanguage() === "sq" ? "sq-AL" : "en-GB").format(n);
const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
export function usageCost(value: {
  minimumUsd: number | null;
  maximumUsd: number | null;
}) {
  if (value.minimumUsd === null) return t("Unknown");
  if (value.maximumUsd === null) return `≥ ${usd(value.minimumUsd)}`;
  return value.minimumUsd === value.maximumUsd
    ? usd(value.minimumUsd)
    : `${usd(value.minimumUsd)} – ${usd(value.maximumUsd)}`;
}
function bytes(n: number) {
  const unit =
    n >= 1024 ** 3 ? "GB" : n >= 1024 ** 2 ? "MB" : n >= 1024 ? "KB" : "B";
  const scale =
    unit === "GB"
      ? 1024 ** 3
      : unit === "MB"
        ? 1024 ** 2
        : unit === "KB"
          ? 1024
          : 1;
  return `${(n / scale).toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${unit}`;
}
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function usageDateRange(
  period: string,
  date: string,
  month: string,
  from: string,
  to: string,
) {
  if (period === "all") return {};
  if (period === "today") return { from: today(), to: today() };
  if (period === "date") return { from: date, to: date };
  if (period === "month") {
    const [year, m] = month.split("-").map(Number);
    if (!year || !m) return {};
    return {
      from: `${month}-01`,
      to: `${month}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`,
    };
  }
  return { from, to };
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="cs-insight-metric">
      <span>{t(label)}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function InsightsPage({ user }: { user: Pick<User, "role"> }) {
  const [tab, setTab] = useState("ai"),
    [period, setPeriod] = useState("all"),
    [date, setDate] = useState(today),
    [month, setMonth] = useState(() => today().slice(0, 7)),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today);
  const [group, setGroup] = useState("day"),
    [operation, setOperation] = useState(""),
    [model, setModel] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [ai, setAi] = useState<AiUsage | null>(null),
    [media, setMedia] = useState<MediaUsage | null>(null),
    [db, setDb] = useState<DbUsage | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const range = usageDateRange(period, date, month, from, to),
    rangeFrom = range.from,
    rangeTo = range.to;
  const invalid =
    period !== "all" && (!rangeFrom || !rangeTo || rangeFrom > rangeTo);
  useEffect(() => {
    setPage(1);
  }, [period, date, month, from, to, operation, model, group]);
  useEffect(() => {
    if (user.role !== "superadmin" || invalid) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      group,
      operation,
      model,
      page: String(page),
      limit: "25",
      ...(rangeFrom ? { from: rangeFrom } : {}),
      ...(rangeTo ? { to: rangeTo } : {}),
    });
    const run =
      tab === "ai"
        ? getAiUsage(params, abort.signal).then(setAi)
        : tab === "media"
          ? getMediaUsage(abort.signal).then(setMedia)
          : getDbUsage(abort.signal).then(setDb);
    run
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : t("Could not load usage."));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [
    user.role,
    tab,
    rangeFrom,
    rangeTo,
    invalid,
    group,
    operation,
    model,
    page,
    revision,
  ]);
  if (user.role !== "superadmin") return null;
  const pages = Math.max(1, Math.ceil((ai?.total ?? 0) / 25));
  return (
    <section className="cs-main-panel cs-insights">
      <div className="cs-insights-heading">
        <div>
          <span className="cs-eyebrow">{t("SUPERADMIN")}</span>
          <h1>{t("Usage & storage")}</h1>
          <p>{t("Project usage, prepared media, and database statistics.")}</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => setRevision((n) => n + 1)}
        >
          {t(loading ? "Loading…" : "Refresh statistics")}
        </button>
      </div>
      <div
        className="cs-insights-tabs"
        role="tablist"
        aria-label={t("Usage categories")}
      >
        {[
          ["ai", "AI usage"],
          ["media", "Images & R2"],
          ["database", "Database"],
        ].map(([id, label]) => (
          <button
            key={id}
            id={`insights-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`insights-panel-${id}`}
            onClick={() => setTab(id!)}
          >
            {t(label!)}
          </button>
        ))}
      </div>
      {error && (
        <p className="cs-insights-error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="cs-insights-loading" role="status">
          {t("Loading statistics…")}
        </p>
      )}
      <div
        role="tabpanel"
        id={`insights-panel-${tab}`}
        aria-labelledby={`insights-tab-${tab}`}
        aria-busy={loading}
      >
        {tab === "ai" && (
          <>
            <div className="cs-insights-filters">
              <label>
                {t("Period")}
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  {[
                    ["all", "All time"],
                    ["today", "Today"],
                    ["date", "Specific date"],
                    ["month", "Month"],
                    ["range", "Date range"],
                  ].map(([v, label]) => (
                    <option key={v} value={v}>
                      {t(label!)}
                    </option>
                  ))}
                </select>
              </label>
              {period === "date" && (
                <label>
                  {t("Date")}
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              )}
              {period === "month" && (
                <label>
                  {t("Month")}
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </label>
              )}
              {period === "range" && (
                <>
                  <label>
                    {t("From")}
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("To")}
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                {t("Operation")}
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                >
                  <option value="">{t("All operations")}</option>
                  {Object.keys(operationNames).map((op) => (
                    <option value={op} key={op}>
                      {operationLabel(op)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Model")}
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">{t("All models")}</option>
                  {ai?.options.models.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("Group by")}
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  <option value="day">{t("Day")}</option>
                  <option value="month">{t("Month")}</option>
                </select>
              </label>
            </div>
            {invalid && (
              <p role="alert">{t("Choose a valid start and end date.")}</p>
            )}
            <p className="cs-insights-note">
              {t(
                "Dates use Europe/Belgrade. Costs are in USD. Saved results reused from cache create no new AI charge.",
              )}
            </p>
            {ai && !invalid && (
              <div className={loading ? "cs-insights-stale" : ""}>
                <div className="cs-insights-metrics">
                  <Metric
                    label="Estimated metered spending"
                    value={
                      ai.summary.requests > 0 &&
                      ai.summary.requests === ai.summary.unknownCosts
                        ? t("Unknown")
                        : usageCost(ai.summary)
                    }
                  />
                  <Metric
                    label="AI records"
                    value={count(ai.summary.requests)}
                  />
                  <Metric
                    label="Input tokens"
                    value={count(ai.summary.inputTokens)}
                  />
                  <Metric
                    label="Output tokens"
                    value={count(ai.summary.outputTokens)}
                  />
                </div>
                {(ai.summary.unknownCosts > 0 ||
                  ai.summary.partialCosts > 0 ||
                  ai.summary.unknownTokens > 0) && (
                  <p className="cs-insights-notice">
                    {t("Historical coverage")}: {count(ai.summary.unknownCosts)}{" "}
                    {t("records have no recoverable cost")};{" "}
                    {count(ai.summary.partialCosts)}{" "}
                    {t("have partial cost details")};{" "}
                    {count(ai.summary.unknownTokens)} {t("have missing tokens")}
                    .{" "}
                    {t(
                      "Totals include only recorded usage. Unknown amounts are excluded, not counted as free.",
                    )}
                  </p>
                )}
                <p className="cs-insights-note">
                  {t(
                    "Estimates use standard provider rates and are not an invoice.",
                  )}{" "}
                  <a href={ai.pricingUrl} target="_blank" rel="noreferrer">
                    {t("OpenAI pricing")}
                  </a>{" "}
                  · {ai.pricingVersion}
                </p>
                <h2>{t("By operation and model")}</h2>
                <div className="cs-insights-table">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Operation",
                          "Model",
                          "Records",
                          "Input tokens",
                          "Output tokens",
                          "Estimated USD",
                          "Unknown cost",
                        ].map((h) => (
                          <th key={h}>{t(h)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ai.operations.map((row) => (
                        <tr key={row.operation + row.model}>
                          <td>{operationLabel(row.operation)}</td>
                          <td>{row.model}</td>
                          <td>{count(row.requests)}</td>
                          <td>{count(row.inputTokens)}</td>
                          <td>{count(row.outputTokens)}</td>
                          <td>
                            {row.requests === row.unknownCosts
                              ? t("Unknown")
                              : usageCost(row)}
                          </td>
                          <td>{row.unknownCosts + row.partialCosts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h2>{t("Usage over time")}</h2>
                <div className="cs-insights-table cs-insights-timeline">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Date",
                          "Records",
                          "Input tokens",
                          "Output tokens",
                          "Estimated USD",
                        ].map((h) => (
                          <th key={h}>{t(h)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ai.timeline.map((row) => (
                        <tr key={row.date}>
                          <td>{row.date}</td>
                          <td>{count(row.requests)}</td>
                          <td>{count(row.inputTokens)}</td>
                          <td>{count(row.outputTokens)}</td>
                          <td>
                            {row.requests === row.unknownCosts
                              ? t("Unknown")
                              : usageCost(row)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h2>{t("Detailed AI records")}</h2>
                <div className="cs-insights-table">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Date",
                          "Operation",
                          "Product / context",
                          "Model",
                          "User",
                          "Status",
                          "Input tokens",
                          "Output tokens",
                          "Estimated USD",
                          "Source",
                        ].map((h) => (
                          <th key={h}>{t(h)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ai.records.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {new Date(row.createdAt).toLocaleString(
                              getLanguage() === "sq" ? "sq-AL" : "en-GB",
                              {
                                timeZone: ai.timeZone,
                                dateStyle: "short",
                                timeStyle: "short",
                              },
                            )}
                          </td>
                          <td>{operationLabel(row.operation)}</td>
                          <td className="cs-insights-subject">
                            {row.subject || "—"}
                          </td>
                          <td>{row.model}</td>
                          <td>{row.user || "—"}</td>
                          <td>{t(row.status)}</td>
                          <td>
                            {row.inputTokens === null
                              ? "—"
                              : count(row.inputTokens)}
                          </td>
                          <td>
                            {row.outputTokens === null
                              ? "—"
                              : count(row.outputTokens)}
                          </td>
                          <td>
                            {usageCost(row)}
                            <small>{t(row.costBasis)}</small>
                          </td>
                          <td title={row.requestId || undefined}>
                            {t(
                              row.source === "unmetered"
                                ? "Unmetered history"
                                : "Provider usage",
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!ai.total && <p>{t("No AI usage in this period.")}</p>}
                <div className="cs-insights-pagination">
                  <span>
                    {count(ai.total)} {t("records")} · {page} / {pages}
                  </span>
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((n) => n - 1)}
                  >
                    {t("Previous")}
                  </button>
                  <button
                    disabled={page >= pages || loading}
                    onClick={() => setPage((n) => n + 1)}
                  >
                    {t("Next")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {tab === "media" && media && (
          <>
            <p className="cs-insights-note">
              {media.driver === "r2"
                ? `Cloudflare R2 · ${media.bucketName}`
                : t("Local development storage")}
            </p>
            <div className="cs-insights-metrics">
              <Metric
                label="Stored project objects"
                value={media.bucket ? count(media.bucket.objects) : "—"}
              />
              <Metric
                label="R2 project storage"
                value={media.bucket ? bytes(media.bucket.bytes) : "—"}
              />
              <Metric
                label="Registered media"
                value={count(media.registered.objects)}
              />
              <Metric
                label="Registered media size"
                value={bytes(media.registered.bytes)}
              />
            </div>
            {media.bucketError && (
              <p role="alert">
                {t(
                  "R2 listing is temporarily unavailable. Registered media statistics are still shown.",
                )}
              </p>
            )}
            <p className="cs-insights-note">
              {t(
                "R2 totals cover this project prefix, including retained versions. Registered totals cover active database assets. R2 transfer, request charges, and billing are available in Cloudflare.",
              )}
            </p>
            <h2>{t("Prepared images available for reuse")}</h2>
            <div className="cs-insights-metrics">
              {media.prepared.map((row) => (
                <Metric
                  key={row.operation}
                  label={operationLabel(row.operation)}
                  value={count(row.count)}
                />
              ))}
            </div>
            <h2>{t("Media library")}</h2>
            <div className="cs-insights-table">
              <table>
                <thead>
                  <tr>
                    <th>{t("Type")}</th>
                    <th>{t("Files")}</th>
                    <th>{t("Storage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {media.kinds.map((row) => (
                    <tr key={row.kind}>
                      <td>{operationLabel(row.kind)}</td>
                      <td>{count(row.count)}</td>
                      <td>{bytes(row.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cs-insights-metrics">
              {Object.entries(media.linked).map(([key, n]) => (
                <Metric
                  key={key}
                  label={
                    (
                      {
                        products: "Products with photos",
                        brands: "Saved brand logos",
                        aliases: "Reusable image links",
                        variants: "Prepared variants",
                      } as Record<string, string>
                    )[key] || key
                  }
                  value={count(n)}
                />
              ))}
            </div>
          </>
        )}
        {tab === "database" && db && (
          <>
            <div className="cs-insights-metrics">
              <Metric label="Database size" value={bytes(db.bytes)} />
              {Object.entries(db.counts).map(([key, n]) => (
                <Metric
                  key={key}
                  label={
                    (
                      {
                        products: "Products",
                        campaigns: "Brochures",
                        posts: "Social posts",
                        assets: "Media assets",
                        members: "Team members",
                        aiResults: "Saved AI results",
                        catalogRuns: "Catalog refreshes",
                      } as Record<string, string>
                    )[key] || key
                  }
                  value={count(n)}
                />
              ))}
            </div>
            <p className="cs-insights-note">
              {t(
                "Counts belong to this project. Database and table sizes include indexes, retained history, and infrastructure tables; they are not Neon billing totals.",
              )}
            </p>
            <h2>{t("Largest database tables")}</h2>
            <div className="cs-insights-table">
              <table>
                <thead>
                  <tr>
                    <th>{t("Table")}</th>
                    <th>{t("Size including indexes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {db.tables.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{bytes(row.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

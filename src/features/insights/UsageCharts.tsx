import React from "react";
import type { AiUsage } from "./insights.api";
import { getLanguage, t } from "../brochure/i18n";

export const insightText = (english: string, albanian: string) =>
  getLanguage() === "sq" ? albanian : english;
const number = (value: number) =>
  new Intl.NumberFormat(getLanguage() === "sq" ? "sq-AL" : "en-GB").format(
    value,
  );
type UsageTotals = AiUsage["summary"];
interface ChartPoint {
  id: string;
  label: string;
  totals: UsageTotals;
}
interface UsageChartsProps {
  usage: AiUsage;
  cost: (value: UsageTotals) => string;
  operationLabel: (operation: string) => string;
  operations?: boolean;
}
function TokenBars({
  totals,
  maximum,
}: {
  totals: UsageTotals;
  maximum: number;
}) {
  const known = totals.inputTokens + totals.outputTokens;
  const unknown = known === 0 && totals.unknownTokens > 0;
  return (
    <div
      className={`cs-usage-bar-track${unknown ? " is-unknown" : ""}`}
      aria-hidden="true"
    >
      {!unknown && (
        <>
          <span
            className="cs-usage-bar-input"
            style={{ width: `${(totals.inputTokens / maximum) * 100}%` }}
          />
          <span
            className="cs-usage-bar-output"
            style={{ width: `${(totals.outputTokens / maximum) * 100}%` }}
          />
        </>
      )}
    </div>
  );
}
export function UsageCharts({
  usage,
  cost,
  operationLabel,
  operations = false,
}: UsageChartsProps) {
  const points: ChartPoint[] = operations
    ? usage.operations
        .map((totals) => ({
          id: `${totals.operation}:${totals.model}`,
          label: `${operationLabel(totals.operation)} · ${totals.model}`,
          totals,
        }))
        .sort((a, b) => b.totals.minimumUsd - a.totals.minimumUsd)
    : usage.timeline.map((totals) => ({
        id: totals.date,
        label: totals.date,
        totals,
      }));
  const maxCost = Math.max(
    ...points.map(({ totals }) =>
      totals.requests > totals.unknownCosts ? totals.minimumUsd : 0,
    ),
    0.000001,
  );
  const maxTokens = Math.max(
    ...points.map(({ totals }) => totals.inputTokens + totals.outputTokens),
    1,
  );
  return (
    <div className="cs-usage-charts">
      <figure
        className="cs-usage-chart"
        aria-label={insightText(
          operations
            ? "Recorded AI spending by operation"
            : "Recorded AI spending over time",
          operations
            ? "Shpenzimi i regjistruar sipas veprimit"
            : "Shpenzimi i regjistruar sipas kohës",
        )}
      >
        <figcaption>
          <strong>
            {insightText(
              operations
                ? "Spending by operation & model"
                : "Spending over time",
              operations
                ? "Shpenzimi sipas veprimit dhe modelit"
                : "Shpenzimi sipas kohës",
            )}
          </strong>
          <span>USD · {insightText("known amounts", "shumat e njohura")}</span>
        </figcaption>
        <p>
          {insightText(
            "Bars show recorded minimum estimates. Ranges and unknown charges are labelled; unknown is never counted as free.",
            "Shtyllat tregojnë vlerësimet minimale të regjistruara. Intervalet dhe kostot e panjohura shënohen; e panjohura nuk llogaritet falas.",
          )}
        </p>
        {!points.length && <p>{t("No AI usage in this period.")}</p>}
        <ul>
          {points.map(({ id, label, totals }) => {
            const unknown =
              totals.requests > 0 && totals.requests === totals.unknownCosts;
            const value = unknown ? t("Unknown") : cost(totals);
            return (
              <li
                key={id}
                aria-label={`${label}: ${value}${totals.unknownCosts ? `; ${totals.unknownCosts} ${insightText("unknown costs", "kosto të panjohura")}` : ""}`}
              >
                <div className="cs-usage-bar-label">
                  <span title={label}>{label}</span>
                  <strong>{value}</strong>
                </div>
                <div
                  className={`cs-usage-bar-track${unknown ? " is-unknown" : ""}`}
                  aria-hidden="true"
                >
                  {!unknown && (
                    <span
                      className="cs-usage-bar-cost"
                      style={{
                        width: `${(totals.minimumUsd / maxCost) * 100}%`,
                      }}
                    />
                  )}
                </div>
                {(totals.unknownCosts > 0 || totals.partialCosts > 0) && (
                  <small>
                    {number(totals.unknownCosts)}{" "}
                    {insightText("unknown", "të panjohura")} ·{" "}
                    {number(totals.partialCosts)}{" "}
                    {insightText("partial estimates", "vlerësime të pjesshme")}
                  </small>
                )}
              </li>
            );
          })}
        </ul>
      </figure>
      <figure
        className="cs-usage-chart"
        aria-label={insightText(
          operations
            ? "Recorded AI tokens by operation"
            : "Recorded AI tokens over time",
          operations
            ? "Tokenat e regjistruar sipas veprimit"
            : "Tokenat e regjistruar sipas kohës",
        )}
      >
        <figcaption>
          <strong>
            {insightText(
              operations ? "Tokens by operation & model" : "Tokens over time",
              operations
                ? "Tokenat sipas veprimit dhe modelit"
                : "Tokenat sipas kohës",
            )}
          </strong>
          <span className="cs-usage-legend">
            <i className="cs-usage-bar-input" />
            {t("Input tokens")}
            <i className="cs-usage-bar-output" />
            {t("Output tokens")}
          </span>
        </figcaption>
        <p>
          {insightText(
            "Only recorded tokens are plotted. Missing token counts are excluded and shown below each period.",
            "Grafiku përfshin vetëm tokenat e regjistruar. Numërimet që mungojnë përjashtohen dhe shënohen për çdo periudhë.",
          )}
        </p>
        {!points.length && <p>{t("No AI usage in this period.")}</p>}
        <ul>
          {points.map(({ id, label, totals }) => {
            const unknown =
              totals.inputTokens + totals.outputTokens === 0 &&
              totals.unknownTokens > 0;
            return (
              <li
                key={id}
                aria-label={`${label}: ${unknown ? t("Unknown") : `${number(totals.inputTokens)} ${t("Input tokens")}, ${number(totals.outputTokens)} ${t("Output tokens")}`}${totals.unknownTokens ? `; ${number(totals.unknownTokens)} ${t("have missing tokens")}` : ""}`}
              >
                <div className="cs-usage-bar-label">
                  <span title={label}>{label}</span>
                  <strong>
                    {unknown
                      ? t("Unknown")
                      : `${number(totals.inputTokens)} / ${number(totals.outputTokens)}`}
                  </strong>
                </div>
                <TokenBars totals={totals} maximum={maxTokens} />
                {totals.unknownTokens > 0 && (
                  <small>
                    {number(totals.unknownTokens)} {t("have missing tokens")}
                  </small>
                )}
              </li>
            );
          })}
        </ul>
      </figure>
    </div>
  );
}

const months = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  sq: [
    "janar",
    "shkurt",
    "mars",
    "prill",
    "maj",
    "qershor",
    "korrik",
    "gusht",
    "shtator",
    "tetor",
    "nëntor",
    "dhjetor",
  ],
} as const;

/** Browser ICU builds can fall back to English for sq-AL. Localize words ourselves
 * and ask Intl only for numeric parts in the workspace's actual time zone. */
export function formatCatalogTime(
  value: string | null | undefined,
  language: "en" | "sq",
): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  const parts = new Intl.DateTimeFormat("en-GB-u-nu-latn", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Belgrade",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  const month = months[language][Number(part("month")) - 1];
  return `${Number(part("day"))} ${month}${language === "sq" ? ", ora " : " at "}${part("hour").padStart(2, "0")}:${part("minute").padStart(2, "0")}`;
}

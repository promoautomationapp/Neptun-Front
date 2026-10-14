export function warrantyDuration(value:unknown) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*(muaj|months?|vit(?:e)?|years?)$/i);
  if (!match) return null;
  const amount = Number((match[1] ?? "").replace(",", "."));
  if (!Number.isInteger(amount) || amount <= 0) return null;
  const months = /^(vit|year)/i.test(match[2] ?? "") ? amount * 12 : amount;
  if (months % 12 === 0) {
    const count = months / 12;
    return { count, unit: count === 1 ? "VIT" : "VITE", months };
  }
  return { count: months, unit: "MUAJ", months };
}

export function warrantyText(value:unknown, language = "sq") {
  const duration = warrantyDuration(value);
  if (!duration) return "";
  if (language === "en") {
    const years = duration.months % 12 === 0;
    return `${duration.count} ${years ? (duration.count === 1 ? "year" : "years") : duration.count === 1 ? "month" : "months"}`;
  }
  return `${duration.count} ${duration.unit.toLowerCase()}`;
}

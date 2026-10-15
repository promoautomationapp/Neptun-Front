/** Match accents, case and spacing consistently in every picker. */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
export function compactSearch(value: string): string {
  return normalizeSearch(value).replace(/[^a-z0-9]/g, "");
}
export function matchesSearch(value: string, query: string): boolean {
  const wanted = normalizeSearch(query);
  if (!wanted) return true;
  const text = normalizeSearch(value);
  const words = wanted.split(/[^a-z0-9]+/).filter(Boolean);
  return words.length > 0 && (words.every(word => text.includes(word)) || compactSearch(text).includes(compactSearch(wanted)));
}

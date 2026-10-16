/** Auto layout uses translate/scale; those corrections must not retrigger its own measurements. */
const requestedStyle = (value: string | null) =>
  (value || "").split(";").map((part) => part.trim()).filter((part) =>
    part && !/^(?:translate|scale)\s*:/i.test(part),
  ).sort().join(";");

export function requestedLayoutChanged(records: MutationRecord[]): boolean {
  const firstValues = new Map<Element, Map<string, string | null>>();
  for (const record of records) {
    if (record.type !== "attributes") return true;
    if (!(record.target instanceof Element) || !record.attributeName) continue;
    let attributes = firstValues.get(record.target);
    if (!attributes) firstValues.set(record.target, attributes = new Map());
    if (!attributes.has(record.attributeName)) attributes.set(record.attributeName, record.oldValue);
  }
  for (const [element, attributes] of firstValues) {
    for (const [attribute, before] of attributes) {
      const after = element.getAttribute(attribute);
      if (attribute === "style" ? requestedStyle(before) !== requestedStyle(after) : before !== after) return true;
    }
  }
  return false;
}

export function stableMeasurement<T extends object>(previous: T | null, next: T | null): T | null {
  return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
}

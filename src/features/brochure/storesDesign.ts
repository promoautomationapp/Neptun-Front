import type { Campaign, Store, Placement } from "../../domain/models";
import { orderedStoreIndexes } from "./brochureLayout";
import { includesOnlineStore, selectedStoreIndexes } from "./storesSelection";
import { pageBackgroundReadability } from "./pageBackground";

export interface StoreEntry {
  key: string | number;
  store: Store | null;
  online: boolean;
}

export function storePageEntries(
  campaign: Partial<Campaign> = {},
  stores: Store[] = [],
) {
  const locations = Array.isArray(stores) ? stores : [];
  const selected = new Set(selectedStoreIndexes(campaign, locations.length));
  const entries: StoreEntry[] = orderedStoreIndexes(campaign, locations.length)
    .filter((key) => selected.has(key))
    .map((key) => ({ key, store: locations[key] ?? null, online: false }));
  if (includesOnlineStore(campaign))
    entries.push({ key: "online", store: null, online: true });
  return entries;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
function finiteNumber(value: unknown, fallback: number) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function defaultStorePlacement(index: number, count: number) {
  const total = Math.max(1, Math.floor(finiteNumber(count, 1)));
  const slot = clamp(Math.floor(finiteNumber(index, 0)), 0, total - 1);
  const columns = 4;
  const rows = Math.ceil(total / columns);
  const width = 23;
  const horizontalGap = (100 - columns * width) / (columns - 1);
  const verticalGap = rows <= 5 ? 2.5 : Math.min(2, 50 / (rows - 1));
  const height = Math.min(18, (100 - (rows - 1) * verticalGap) / rows);
  const row = Math.floor(slot / columns);
  const rowCount = Math.min(columns, total - row * columns);
  const rowWidth = rowCount * width + (rowCount - 1) * horizontalGap;
  const gridHeight = rows * height + (rows - 1) * verticalGap;
  return {
    x:
      (total <= 8 ? (100 - rowWidth) / 2 : 0) +
      (slot % columns) * (width + horizontalGap),
    y: (100 - gridHeight) / 2 + row * (height + verticalGap),
    width,
    height,
  };
}

export function storePlacement(
  campaign: Partial<Campaign>,
  key: string | number,
  index: number,
  count: number,
) {
  const fallback = defaultStorePlacement(index, count);
  const saved = campaign?.storePositions?.[key];
  if (!saved || typeof saved !== "object") return fallback;
  const width = clamp(finiteNumber(saved.width, fallback.width), 4, 100);
  const height = clamp(finiteNumber(saved.height, fallback.height), 4, 100);
  return {
    x: clamp(finiteNumber(saved.x, fallback.x), 0, 100 - width),
    y: clamp(finiteNumber(saved.y, fallback.y), 0, 100 - height),
    width,
    height,
  };
}

export function storesPageIsLight(campaign: Partial<Campaign> = {}) {
  return pageBackgroundReadability(campaign, "stores").light;
}

const cleanLine = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const comparable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const escapePattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function storeDisplayLines(store: Partial<Store> = {}) {
  const originalCity = cleanLine(store.city);
  const originalName = cleanLine(store.name);
  let city = originalCity.toLocaleUpperCase("sq");
  let name = originalName;
  if (originalCity && comparable(originalCity) === comparable(originalName))
    name = "";
  else if (originalCity && originalName) {
    const prefix = escapePattern(comparable(originalCity));
    const numbered = comparable(originalName).match(
      new RegExp(
        `^${prefix}\\s*(?:[-–—]\\s*)?(\\d+)(?=$|\\s|[·,;:()\\-–—])\\s*(?:[·,;:\\-–—]\\s*)?`,
      ),
    );
    if (numbered) {
      city += ` ${numbered[1]}`;
      name = originalName.slice(numbered[0].length).trim();
    } else {
      const repeated = comparable(originalName).match(
        new RegExp(`^${prefix}\\s*[·,;:\\-–—]\\s*`),
      );
      if (repeated) name = originalName.slice(repeated[0].length).trim();
    }
  }
  return {
    city,
    name,
    address: cleanLine(store.address),
    phone: cleanLine(store.phone),
  };
}

export function storeDisplayChanges(
  store: Store,
  field: keyof Store,
  value: string,
) {
  const changes: Partial<Store> = { [field]: value };
  if (field === "name") {
    const city = storeDisplayLines(store).city;
    // Numbered branches can keep their number in the imported name. A visible
    // name edit replaces that source, so retain the derived heading in city.
    if (city !== cleanLine(store.city).toLocaleUpperCase("sq"))
      changes.city = city;
  }
  return changes;
}

export function withoutFooterStorePlacements(
  placements: Record<string, Placement> = {},
) {
  return Object.fromEntries(
    Object.entries(placements).filter(([kind]) => !kind.startsWith("store-")),
  );
}

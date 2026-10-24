import type { Campaign, Product } from "../../domain/models";
import { isAppleProduct, isMobilePhone } from "./productTypes";
import { productDesignFor } from "../settings/product-design-defaults";
import { usesBlueReferencePrice } from "./priceDesign";
import { isOctoberBrochure } from "./octoberDesign";
import {
  detailPlainText,
  normalizedDetail,
  savedDetailEntries,
  type DetailEntry,
} from "./detailFacts";

export { isMobilePhone } from "./productTypes";

const normalized = (value: unknown) => normalizedDetail(value).toUpperCase();
const memoryKey = /MEMOR|MEMORY|STORAGE|RAM|KAPACITET.*BRENDSH/;
const memoryUnit = /\b\d+(?:[.,]\d+)?\s*(?:GB|TB)\b/i;

export function defaultProductDetailPlacement(
  product: Partial<Product> = {},
  campaign: Partial<Campaign> = {},
) {
  if (
    product.detailPlacement === "left" ||
    product.detailPlacement === "bottom"
  )
    return product.detailPlacement;
  if (isOctoberBrochure(campaign) && isAppleProduct(product)) return "bottom";
  const choice = productDesignFor(campaign).details.placement;
  if (choice !== "automatic") return choice;
  const priceProduct: Product = {
    ...product,
    name: product.name ?? "",
    code: product.code ?? "",
  };
  return isMobilePhone(product) &&
    usesBlueReferencePrice(priceProduct, campaign)
    ? "left"
    : "bottom";
}

export function isMemoryDetail(key: unknown, value: unknown) {
  const label = normalized(key),
    text = normalized(value);
  return (
    memoryUnit.test(text) &&
    (memoryKey.test(label) ||
      /\bRAM\b/.test(text) ||
      /\d+\s*(?:GB|TB)\s*\/\s*\d+\s*(?:GB|TB)/.test(text))
  );
}

const memoryAmount = (value: string) =>
  value
    .match(/\b(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/i)
    ?.slice(1)
    .join("")
    .toUpperCase();

function descriptionPhoneFacts(description?: string): DetailEntry[] {
  const facts: DetailEntry[] = [];
  for (const line of detailPlainText(description)
    .split(/[\n\r]+/)
    .map((line) => line.replace(/^\s*[*•·-]\s*/, "").trim())
    .filter(Boolean)) {
    if (/^(?:Android|iOS)\s*\d/i.test(line)) facts.push(["Sistemi", line]);
    else {
      const labeled = line.match(
        /^((?:Sistemi(?:\s+operativ)?|Operating\s+system|OS|(?:Kamera|Camera)(?:\s+(?:dual|front|rear|e\s+parme|e\s+pasme))?|Front(?:\s+camera)?|Rear(?:\s+camera)?|Memor(?:j[aeëe]*|i[aeëe]*)(?:\s+(?:e\s+)?brendshme)?|Memory|Storage|RAM|Bateria|Battery))(?:\s*:\s*|\s+)(.+)$/i,
      );
      if (labeled?.[1] && labeled[2])
        facts.push([labeled[1], labeled[2].trim()]);
    }
  }
  return facts;
}

export interface PhoneMemoryAmounts {
  ram?: string;
  storage?: string;
}

// Explicit RAM labels take priority over pair order: "128GB / 4GB RAM" is
// storage/RAM, while the canonical reference row is RAM/storage.
export function phoneMemoryAmounts(
  text: string,
  label = "",
): PhoneMemoryAmounts {
  const ram = text.match(
    /\b(\d+(?:[.,]\d+)?)\s*(GB|TB)\s*RAM\b|\bRAM\s*:?\s*(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/i,
  );
  if (ram) {
    const ramValue = `${ram[1] || ram[3]}${(ram[2] || ram[4] || "").toUpperCase()}`;
    const remainder = text.replace(ram[0], "");
    return { ram: ramValue, storage: memoryAmount(remainder) };
  }
  const pair = text.match(
    /\b(\d+(?:[.,]\d+)?)\s*(GB|TB)?\s*\/\s*(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/i,
  );
  if (pair) {
    const first = `${pair[1]}${(pair[2] || pair[4] || "GB").toUpperCase()}`;
    const second = `${pair[3]}${(pair[4] || "GB").toUpperCase()}`;
    const storageFirst =
      /^(?:MEMOR|MEMORY|STORAGE)/.test(normalized(label)) &&
      /RAM/.test(normalized(label));
    return storageFirst
      ? { storage: first, ram: second }
      : { ram: first, storage: second };
  }
  const amount = memoryAmount(text);
  return /^RAM\b/.test(normalized(label))
    ? { ram: amount }
    : { storage: amount };
}

function explicitPhoneMemory(
  product: Partial<Product>,
  entries: DetailEntry[],
): string {
  const memory = entries.filter(([key]) => memoryKey.test(normalized(key)));
  let ram: string | undefined, storage: string | undefined;
  for (const [key, value] of memory) {
    const amounts = phoneMemoryAmounts(value, key);
    ram ||= amounts.ram;
    storage ||= amounts.storage;
  }
  if (ram && storage) return `${ram} / ${storage}`;
  // A supplied model-name memory pair is a catalog fact, never a default.
  const modelPair = String(product.name || "").match(
    /\b\d+\s*(?:GB)?\s*\/\s*\d+\s*(?:GB|TB)\b/i,
  )?.[0];
  if (modelPair && !ram && !storage) {
    const amounts = phoneMemoryAmounts(modelPair, "RAM / Memorje");
    if (amounts.ram && amounts.storage)
      return `${amounts.ram} / ${amounts.storage}`;
  }
  return memory
    .map(([, value]) => value)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" / ");
}

const cameraKey = /KAMERA|CAMERA|^(?:FRONT|REAR|SELFIE)\b/;

function combinedPhoneCamera(entries: DetailEntry[]): string {
  const rear: string[] = [],
    front: string[] = [];
  const append = (values: string[], value: string) => {
    const clean = value.trim().replace(/^[,;]+\s*|\s*[,;]+$/g, "");
    if (
      clean &&
      !values.some(
        (item) =>
          normalized(item).replace(/\s+/g, "") ===
          normalized(clean).replace(/\s+/g, ""),
      )
    )
      values.push(clean);
  };
  for (const [key, value] of entries.filter(([key]) =>
    cameraKey.test(normalized(key)),
  )) {
    const frontLabel = /FRONT|SELFIE|E PARME/.test(normalized(key));
    const combined = value.match(
      /^([\s\S]*?)(?:[,;]?\s*\b(?:Front(?:\s+camera)?|Selfie|Kamera\s+e\s+parme)\s*:?\s*)([\s\S]+)$/i,
    );
    if (combined?.[1] !== undefined && combined[2]) {
      append(rear, combined[1]);
      append(front, combined[2]);
    } else append(frontLabel ? front : rear, value);
  }
  return [
    ...(rear.length ? [rear.join("; ")] : []),
    ...(front.length ? [`Front: ${front.join("; ")}`] : []),
  ].join("\n");
}

// Only supplied catalog/import facts populate the four default phone boxes.
// A manually saved list (including an empty list) stays authoritative.
export function mobileDetailEntries(
  product: Partial<Product> = {},
  { includeFallback = false } = {},
): DetailEntry[] {
  const saved = savedDetailEntries(product);
  if (saved) return saved;
  const entries: DetailEntry[] = Object.entries(product.specs || {}).filter(
    ([, value]) =>
      value !== null && value !== undefined && String(value).trim(),
  );
  if (!isMobilePhone(product) || isAppleProduct(product)) return entries;
  const facts = [...entries, ...descriptionPhoneFacts(product.description)];
  const selected: DetailEntry[] = [],
    used = new Set<string>();
  function add(keyPattern: RegExp, label: string, valuePattern?: RegExp) {
    const found = facts.find(
      ([key, value]) =>
        keyPattern.test(normalized(key)) || valuePattern?.test(value),
    );
    if (!found) return;
    facts.forEach(([key, value]) => {
      if (keyPattern.test(normalized(key)) || valuePattern?.test(value))
        used.add(key);
    });
    selected.push([label, found[1]]);
  }
  add(
    /^(?:\*\s*)?(?:OS|SISTEMI|SISTEMI OPERATIV|OPERATING SYSTEM|SOFTWARE)$/,
    "Sistemi",
    /\b(?:Android|iOS)\s*\d/i,
  );
  const camera = combinedPhoneCamera(facts);
  if (camera) {
    selected.push(["Kamera", camera]);
    facts.forEach(([key]) => {
      if (cameraKey.test(normalized(key))) used.add(key);
    });
  }
  const memory = explicitPhoneMemory(product, facts);
  if (memory) {
    selected.push(["RAM / Memorje", memory]);
    facts.forEach(([key]) => {
      if (memoryKey.test(normalized(key))) used.add(key);
    });
  }
  add(/BATER|BATTERY/, "Bateria", /\b\d[\d .,]*\s*mAh\b/i);
  return includeFallback
    ? [...selected, ...entries.filter(([key]) => !used.has(key))]
    : selected;
}

// Use only while constructing a newly imported product. Never run this over
// saved campaign lists: those lists include deliberate user order and edits.
export function groupImportedPhoneDetails(
  product: Partial<Product>,
  lines: string[],
): string[] {
  if (!isMobilePhone(product) || isAppleProduct(product)) return [...lines];
  const parsed = lines.map((line, index) => {
    const facts = descriptionPhoneFacts(line);
    if (!facts.length && /\b\d[\d .,]*\s*mAh\b/i.test(line))
      facts.push(["Bateria", line.trim()]);
    if (!facts.length && isMemoryDetail("", line))
      facts.push(["RAM / Memorje", line.trim()]);
    return { index, facts };
  });
  const all = parsed.flatMap(({ facts }) => facts);
  const consumed = new Set<number>();
  const consume = (pattern: RegExp) =>
    parsed.forEach(({ index, facts }) => {
      if (facts.length && facts.every(([key]) => pattern.test(normalized(key))))
        consumed.add(index);
    });
  const grouped: string[] = [];
  const osPattern = /^(?:OS|SISTEMI|SISTEMI OPERATIV|OPERATING SYSTEM)$/;
  const os = all.find(([key]) => osPattern.test(normalized(key)));
  if (os) {
    grouped.push(os[1].replace(/^(Android|iOS)\s*(?=\d)/i, "$1\n"));
    consume(osPattern);
  }
  const cameras = all.filter(([key]) => cameraKey.test(normalized(key)));
  const camera = combinedPhoneCamera(cameras);
  if (camera) {
    grouped.push(
      `${/^(?:Front|Selfie)\b/i.test(camera) ? "" : "KAMERA: "}${camera}`,
    );
    consume(cameraKey);
  }
  const memory = explicitPhoneMemory({}, all);
  if (memory) {
    const amounts = phoneMemoryAmounts(memory, "RAM / Memorje");
    grouped.push(
      amounts.storage && amounts.ram
        ? `${amounts.storage}\n${amounts.ram}`
        : memory,
    );
    consume(memoryKey);
  }
  const battery = all.find(([key]) => /BATER|BATTERY/.test(normalized(key)));
  if (battery) {
    grouped.push(`Bateria:\n${battery[1]}`);
    consume(/BATER|BATTERY/);
  }
  return [...grouped, ...lines.filter((_, index) => !consumed.has(index))];
}

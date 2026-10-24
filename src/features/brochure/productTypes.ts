import type { Product } from "../../domain/models";
const normalized = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

// An explicit brand takes precedence over compatible-device names on accessories.
export function isAppleProduct(product: Partial<Product> | null | undefined) {
  const brand = String(product?.brand || "").trim();
  if (brand) return brand.toUpperCase() === "APPLE";
  const identity = normalized(
    `${product?.category || ""} ${product?.subcategory || ""} ${product?.name || ""}`,
  );
  if (accessory.test(identity)) return false;
  if (isMacBook(product || {})) return true;
  const name = String(product?.name || "")
    .trim()
    .replace(/^(?:SMARTPHONE|MOBILE\s+PHONE|TELEFON(?:A|E)?\s+MOBIL)\s+/i, "");
  return /^(?:APPLE\b|IPHONE\b|IPAD\b|MACBOOK\b|IMAC\b|AIRPODS\b|APPLE WATCH\b)/i.test(
    name,
  );
}

// A mixed-brand offer can still contain Apple photos, including a nested
// bundle represented by one combined image.
export function hasApplePhotos(
  product: Partial<Product> | null | undefined,
): boolean {
  return (
    isAppleProduct(product) ||
    Boolean(product?.bundleProducts?.some(hasApplePhotos))
  );
}

export function isApplePhotoArtwork(
  product: Partial<Product> | null | undefined,
  artworkType: string | undefined,
  member?: Partial<Product> | null,
): boolean {
  if (["wifi", "inverter", "energy"].includes(artworkType || "")) return false;
  // An uploaded additional photo may show any product in a mixed offer.
  // A resolved member gives a more precise answer for a generated member photo.
  return hasApplePhotos(
    artworkType === "bundle-product" && member ? member : product,
  );
}

// Device names also occur on cases, chargers and screen protectors. Reject
// those product types before looking for a phone family or phone specification.
const accessory =
  /\b(?:AK?SESOR\w*|AKESOR\w*|MBESHTJELLESE|MBROJTES\w*|MBUSHES\w*|MBAJTES\w*|KABLLO\w*|COVER|CASE|SLEEVE|PROTECTOR|PROTECTION|CHARGER|CABLE|KUFJE|HEADPHONES?|EARPHONES?|BUDS|POWER\s*BANK|ADAPTOR|ADAPTER)\b/;

export function isMacBook(product: Partial<Product> = {}) {
  const name = normalized(product.name);
  const category = normalized(product.category);
  const subcategory = normalized(product.subcategory);
  if (
    accessory.test(name) ||
    accessory.test(category) ||
    accessory.test(subcategory)
  )
    return false;
  if (product.brand && normalized(product.brand) !== "APPLE") return false;
  return (
    /\bMAC\s*BOOK\b/.test(name) ||
    /^(?:APPLE\s+)?MAC\s*BOOK(?:S|\s+(?:AIR|PRO))?$/.test(subcategory)
  );
}

/** Device families stay together in the October brochure, even on sparse pages. */
export function appleProductFamily(product: Partial<Product> = {}) {
  if (!isAppleProduct(product)) return null;
  if (isMacBook(product)) return "macbook";
  const identity = normalized(
    `${product.name || ""} ${product.subcategory || ""}`,
  );
  if (accessory.test(identity)) return "other";
  if (/\bIPHONE\b/.test(identity)) return "iphone";
  if (/\bIPAD\b/.test(identity)) return "ipad";
  return "other";
}

const accessoryCategory =
  /\b(?:AK?SESOR\w*|AKESOR\w*|ACCESSOR\w*|PERIPHERALS?|PERIFERI\w*|KUFJE|HEADPHONES?|EARPHONES?|EARBUDS?|KEYBOARDS?|TASTIER\w*|MOUSE|MICE|MAUS\w*|GAMEPADS?|CONTROLLERS?|KONTROLL\w*)\b/;
const accessoryIdentity =
  /\b(?:KUFJE|HEADPHONES?|EARPHONES?|EARBUDS?|AIRPODS|BUDS|KEYBOARDS?|TASTIER\w*|MOUSE|MICE|MAUS\w*|GAMEPADS?|CONTROLLERS?|CHARGERS?|CABLES?|KABLLO\w*|POWER\s*BANK|ADAPTORS?|ADAPTERS?|SLEEVES?|PROTECTORS?)\b/;
const principalDevice =
  /^(?:(?:GAMING\s+)?(?:LAPTOP|NOTEBOOK|TABLET|SMARTPHONE|TELEFON\w*|TV|TELEVIZOR\w*|MONITOR|DESKTOP|COMPUTER|KOMPJUTER|KONSOLE|CONSOLE)\b)|\b(?:MAC\s*BOOK|IPHONE|IPAD|GALAXY|REDMI\s+(?!BUDS))\b/;

export function isBrochureAccessory(product: Partial<Product> = {}) {
  // Classify using the most specific category first. A phone or notebook can
  // have a broad parent category called "Devices and accessories".
  const subcategory = normalized(product.subcategory);
  const category = normalized(product.category);
  const name = normalized(product.name);
  if (accessoryCategory.test(subcategory)) return true;
  if (principalDevice.test(subcategory)) return false;
  if (accessoryIdentity.test(name)) return true;
  if (principalDevice.test(name)) return false;
  return accessoryCategory.test(category);
}
const otherDevice =
  /\b(?:TABLET\w*|IPAD|LAPTOP|NOTEBOOK|MACBOOK|IMAC|MONITOR|SMARTWATCH|WATCH|TV|TELEVIZOR|TELEFON\w*\s+FIKS)\b/;
const phoneCategory =
  /^(?:SMARTPHONES?|MOBILE(?:\s+PHONES?)?|CELL(?:ULAR)?\s+PHONES?|CELULAR|TELEFON(?:A|E)?(?:\s+MOBIL(?:E|I)?)?|TELEFONA\s+CELULARE)$/;
const phoneFamily =
  /^(?:APPLE\s+)?IPHONE\b|^(?:SMARTPHONE|MOBILE\s+PHONE|CELL\s+PHONE|TELEFON(?:A|E)?\s+MOBIL)\b|^(?:XIAOMI\s+)?REDMI\b|^XIAOMI\s+\d{1,2}(?:[A-Z]|\s|$)|^SAMSUNG\s+(?:SM-[ASMGZ]|GALAXY\s+(?:[ASMGZ]\d|NOTE\b))|^(?:GOOGLE\s+)?PIXEL\s+\d|^(?:REALME|ONEPLUS|OPPO|VIVO|HONOR|MOTOROLA|NOKIA)\s+\S/;

export function isMobilePhone(product: Partial<Product> = {}) {
  const name = normalized(product.name);
  const category = normalized(product.category);
  const subcategory = normalized(product.subcategory);
  if (
    accessory.test(subcategory) ||
    accessory.test(name) ||
    otherDevice.test(subcategory) ||
    otherDevice.test(name)
  )
    return false;
  if (phoneCategory.test(subcategory) || phoneCategory.test(category))
    return true;
  if (phoneFamily.test(name)) return true;

  // Imported products can have a generic or missing category. Require both a
  // phone-sized screen and an explicit mobile OS/network fact in this case.
  const specs = Object.entries(product.specs || {});
  const screen = specs.find(([key]) =>
    /EKRAN|DISPLAY|SCREEN|DIAGONAL/.test(normalized(key)),
  );
  const inches = String(screen?.[1] || "").match(
    /\b(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:["″”]|inch|inç)/i,
  );
  const size = inches ? Number((inches[1] ?? "").replace(",", ".")) : 0;
  const facts = specs
    .map(([key, value]) => `${normalized(key)} ${normalized(value)}`)
    .join(" ");
  return (
    size >= 3 &&
    size <= 8.5 &&
    /\b(?:ANDROID|IOS|SIM|4G|5G|LTE)\b/.test(facts) &&
    /\b(?:KAMERA|CAMERA|CPU|RAM)\b/.test(facts)
  );
}

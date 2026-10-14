import type {
  Campaign,
  Product,
  PageLayout,
  Gradient,
} from "../../domain/models";
import { coverProducts, splitPages } from "./campaignPages";
import {
  backgroundReadability,
  readableForeground,
} from "./backgroundContrast";
import type { BackgroundContext } from "./backgroundContrast";
export const BACKGROUND_PRESETS = [
  { label: "NEPTUN Blue", color: "#1c4075" },
  { label: "Soft gray", color: "#f1f2f4" },
  { label: "Deep navy", color: "#173b63" },
  { label: "Ocean", color: "#1680a8" },
  { label: "Sky", color: "#d8edf7" },
  { label: "Mint", color: "#dcefe4" },
  { label: "Sand", color: "#f4ead7" },
  { label: "Blush", color: "#f5e4e1" },
  { label: "Lavender", color: "#e8e2f4" },
  { label: "Charcoal", color: "#303944" },
];
export type BackgroundPage = Pick<
  PageLayout,
  "backgroundColor" | "backgroundGradient" | "backgroundImage"
>;
export function validBackgroundColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : "";
}
export function validBackgroundGradient(value: unknown): Gradient | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("from" in value) ||
    !("to" in value) ||
    !("angle" in value)
  )
    return null;
  const from = validBackgroundColor(value.from);
  const to = validBackgroundColor(value.to);
  const angle = Number(value.angle);
  return from && to && Number.isFinite(angle)
    ? { from, to, angle: Math.max(0, Math.min(360, angle)) }
    : null;
}
export function validBackgroundImage(value: unknown): string {
  return typeof value === "string" &&
    /^(?:data:image\/(?:png|jpe?g|webp|gif|avif|svg\+xml)(?:;base64,|,)|https?:\/\/|\/(?!\/))/i.test(
      value,
    )
    ? value
    : "";
}
function backgroundSource(
  campaign: Partial<Campaign>,
  kind: string,
  page?: BackgroundPage,
) {
  if (
    kind === "product" &&
    page &&
    (validBackgroundColor(page.backgroundColor) ||
      validBackgroundGradient(page.backgroundGradient) ||
      validBackgroundImage(page.backgroundImage))
  )
    return {
      color: page.backgroundColor,
      gradient: page.backgroundGradient,
      image: page.backgroundImage,
    };
  const prefix =
    kind === "cover" ? "cover" : kind === "stores" ? "stores" : "product";
  return {
    color: campaign[`${prefix}BackgroundColor`],
    gradient: campaign[`${prefix}BackgroundGradient`],
    image: campaign[`${prefix}BackgroundImage`],
  };
}
export function pageBackgroundImage(
  campaign: Partial<Campaign>,
  kind: string,
  page?: BackgroundPage,
) {
  return validBackgroundImage(backgroundSource(campaign, kind, page).image);
}
export function pageBackgroundGradient(
  campaign: Partial<Campaign>,
  kind: string,
  page?: BackgroundPage,
) {
  const source = backgroundSource(campaign, kind, page);
  return validBackgroundImage(source.image)
    ? null
    : validBackgroundGradient(source.gradient);
}
export function pageBackgroundColor(
  campaign: Partial<Campaign>,
  kind: string,
  page?: BackgroundPage,
) {
  return (
    validBackgroundColor(backgroundSource(campaign, kind, page).color) ||
    (kind === "cover" ? "#1c4075" : "")
  );
}
export function pageBackgroundFill(
  campaign: Partial<Campaign>,
  kind: string,
  page?: BackgroundPage,
) {
  const image = pageBackgroundImage(campaign, kind, page);
  if (image)
    return `url(${JSON.stringify(image)}) center / cover no-repeat ${pageBackgroundColor(campaign, kind, page) || "#245b89"}`;
  const gradient = pageBackgroundGradient(campaign, kind, page);
  return gradient
    ? `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})`
    : pageBackgroundColor(campaign, kind, page);
}
export function pageBackgroundContrastColor(
  campaign: Partial<Campaign>,
  kind: string,
  page?: BackgroundPage,
) {
  const gradient = pageBackgroundGradient(campaign, kind, page);
  if (!gradient) return pageBackgroundColor(campaign, kind, page);
  const channel = (hex: string, offset: number) =>
    parseInt(hex.slice(offset, offset + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((offset) =>
        Math.round(
          (channel(gradient.from, offset) + channel(gradient.to, offset)) / 2,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function lightBackground(value: unknown) {
  const hex = validBackgroundColor(value);
  if (!hex) return false;
  return readableForeground(hex) !== "#ffffff";
}
export function pageImageBackgroundContext(
  campaign: Partial<Campaign>,
  kind: string,
  page?: BackgroundPage,
): BackgroundContext {
  const color =
    pageBackgroundColor(campaign, kind, page) ||
    (kind === "cover"
      ? "#1c4075"
      : campaign.theme === "light"
        ? kind === "stores"
          ? "#e4e4e4"
          : "#f1f2f4"
        : "#245b89");
  const image = pageBackgroundImage(campaign, kind, page);
  if (image) return { kind: "image", color, image };
  const gradient = pageBackgroundGradient(campaign, kind, page);
  return gradient ? { kind: "gradient", gradient } : { kind: "solid", color };
}
export function pageBackgroundReadability(
  campaign: Partial<Campaign>,
  kind: string,
  page?: BackgroundPage,
) {
  return backgroundReadability(
    pageImageBackgroundContext(campaign, kind, page),
  );
}
export function productImageBackgroundContext(
  campaign: Campaign,
  product: Product,
) {
  if (
    coverProducts(campaign).some(
      (item) => String(item.code) === String(product.code),
    )
  )
    return pageImageBackgroundContext(campaign, "cover");
  const page = splitPages(campaign).find((item) =>
    item.products.some((entry) => String(entry.code) === String(product.code)),
  );
  return pageImageBackgroundContext(campaign, "product", page);
}

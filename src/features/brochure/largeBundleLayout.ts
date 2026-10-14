import type { Artwork, Product } from "../../domain/models";
import { readableForeground } from "./backgroundContrast";

export interface BundlePanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LargeBundleMemberLayout {
  image: BundlePanelRect;
  copy: BundlePanelRect;
}

export interface LargeBundleLayout {
  photoArea: BundlePanelRect;
  members: LargeBundleMemberLayout[];
  separators: Array<{ x: number; y: number }>;
}

export function isLargeBundleOffer(
  product: Partial<Product> | null | undefined,
): boolean {
  return (
    Array.isArray(product?.bundleProducts) && product.bundleProducts.length >= 3
  );
}

/** Coordinates are percentages of one offer card, with image coordinates relative to its photo area. */
export function largeBundleLayout(count: number): LargeBundleLayout | null {
  if (!Number.isInteger(count) || count < 3) return null;
  const photoArea = { x: 0, y: 0, width: 100, height: 68 };
  const imageWidth = (76 / count) * 0.82;
  const step = (76 - imageWidth) / (count - 1);
  const members = Array.from({ length: count }, (_, index) => {
    const x = 2 + index * step;
    return {
      image: { x, y: 17, width: imageWidth, height: 81 },
      copy: { x, y: 74, width: imageWidth, height: 22 },
    };
  });
  const separators = members.slice(0, -1).map((member) => ({
    x: member.image.x + member.image.width + (step - imageWidth) / 2,
    y: photoArea.height * 0.56,
  }));
  return { photoArea, members, separators };
}

/** These defaults are deliberately separate from the two-member oven/hob composite. */
export function defaultLargeBundleImages(product: Partial<Product>): Artwork[] {
  const layout = largeBundleLayout(product.bundleProducts?.length ?? 0);
  if (!layout) return [];
  return (product.bundleProducts ?? []).map((member, index) => ({
    id: `bundle-image-${member.code}`,
    type: "bundle-product",
    memberCode: String(member.code),
    label: member.name || String(member.code),
    image:
      (index === 0 ? product.image : "") ||
      member.image ||
      member.localImage ||
      member.imageUrl ||
      "",
    usesPrimaryImage: index === 0,
    relativeTo: "photo-area",
    zIndex: 2,
    ...layout.members[index]!.image,
  }));
}

function color(value: unknown): string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : "";
}

export function largeBundlePanelColors(
  pageColor?: string,
  override?: string,
): { background: string; foreground: string } {
  const base = color(pageColor) || "#245b89";
  const background =
    color(override) ||
    "#" +
      [1, 3, 5]
        .map((offset) =>
          Math.round(parseInt(base.slice(offset, offset + 2), 16) * 0.88)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  return { background, foreground: readableForeground(background) };
}

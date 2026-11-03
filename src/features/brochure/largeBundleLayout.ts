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
  columns: number;
  rows: number;
  members: LargeBundleMemberLayout[];
  separators: BundleSeparator[];
}
export interface BundleSeparator {
  x: number;
  y: number;
  startsRow?: boolean;
}

export function isLargeBundleOffer(
  product: Partial<Product> | null | undefined,
): boolean {
  return (
    Array.isArray(product?.bundleProducts) && product.bundleProducts.length >= 3
  );
}

export function largeBundleRows(count: number): number {
  return Math.ceil(count / (count === 4 ? 2 : count >= 7 ? 4 : 3));
}

/** Images and copy use card percentages. The right-hand rail holds the shared offer. */
export function largeBundleLayout(count: number): LargeBundleLayout | null {
  if (!Number.isInteger(count) || count < 3) return null;
  // Keep this existing reference area for saved custom photo-area placements.
  // New generated images use product coordinates so they can occupy every row.
  const photoArea = { x: 0, y: 0, width: 100, height: 68 };
  const columns = count === 4 ? 2 : count >= 7 ? 4 : 3;
  const rows = largeBundleRows(count);
  const gapX = 4;
  const gapY = 5;
  const content = { x: 3, y: 4, width: 70, height: 92 };
  const cellWidth = (content.width - gapX * (columns - 1)) / columns;
  const cellHeight = (content.height - gapY * (rows - 1)) / rows;
  const members = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const rowCount = Math.min(columns, count - row * columns);
    const offset = ((columns - rowCount) * (cellWidth + gapX)) / 2;
    const x = content.x + offset + col * (cellWidth + gapX);
    const y = content.y + row * (cellHeight + gapY);
    const imageHeight = cellHeight * (columns === 4 ? 0.45 : 0.52);
    return {
      image: { x, y, width: cellWidth, height: imageHeight },
      copy: {
        x,
        y: y + imageHeight + 1.5,
        width: cellWidth,
        height: cellHeight - imageHeight - 1.5,
      },
    };
  });
  const separators = members.slice(1).map((member, offset) => {
    const index = offset + 1;
    return index % columns
      ? {
          x: member.image.x - gapX / 2,
          y: member.image.y + member.image.height / 2,
        }
      : {
          x: Math.max(1.5, member.image.x - 3),
          y: member.image.y + member.image.height / 2,
          startsRow: true,
        };
  });
  return { photoArea, columns, rows, members, separators };
}

/** The object-fit photograph can be narrower than its editable image frame. */
export function measuredBundleSeparators(
  layout: LargeBundleLayout,
  bounds: Array<BundlePanelRect | null>,
): BundleSeparator[] {
  return layout.separators.map((fallback, index) => {
    const after = bounds[index + 1];
    if (!after) return fallback;
    if (fallback.startsRow)
      return {
        x: Math.max(1.5, after.x - 3),
        y: after.y + after.height / 2,
        startsRow: true,
      };
    const before = bounds[index];
    if (!before) return fallback;
    const overlapTop = Math.max(before.y, after.y);
    const overlapBottom = Math.min(
      before.y + before.height,
      after.y + after.height,
    );
    return {
      x: (before.x + before.width + after.x) / 2,
      y:
        overlapBottom > overlapTop
          ? (overlapTop + overlapBottom) / 2
          : (before.y + before.height / 2 + after.y + after.height / 2) / 2,
    };
  });
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
    relativeTo: "product",
    zIndex: 2,
    ...layout.members[index]!.image,
  }));
}

/** Reflow only untouched legacy defaults. Explicit moves, resizing and deletion stay saved. */
export function reflowDefaultLargeBundleImages(
  product: Partial<Product>,
  artworks: Artwork[],
): Artwork[] {
  const count = product.bundleProducts?.length ?? 0;
  const layout = largeBundleLayout(count);
  if (!layout) return artworks;
  const oldWidth = (76 / count) * 0.82;
  const oldStep = (76 - oldWidth) / (count - 1);
  return artworks.map((artwork) => {
    const index = product.bundleProducts!.findIndex(
      (member) => String(member.code) === String(artwork.memberCode),
    );
    if (
      index < 0 ||
      artwork.type !== "bundle-product" ||
      artwork.id !== `bundle-image-${artwork.memberCode}` ||
      artwork.relativeTo !== "photo-area"
    )
      return artwork;
    const legacy = {
      x: 2 + index * oldStep,
      y: 17,
      width: oldWidth,
      height: 81,
    };
    if (
      !(Object.keys(legacy) as Array<keyof typeof legacy>).every(
        (key) =>
          typeof artwork[key] === "number" &&
          Math.abs(artwork[key]! - legacy[key]) < 0.000001,
      )
    )
      return artwork;
    return {
      ...artwork,
      ...layout.members[index]!.image,
      relativeTo: "product",
    };
  });
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

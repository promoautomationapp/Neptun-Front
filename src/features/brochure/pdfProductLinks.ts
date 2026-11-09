import type { Product } from "../../domain/models";

export interface PdfProductLink {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Use saved product destinations only, never a guessed URL or an executable URI. */
export function neptunProductPdfUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim(), "https://www.neptun-ks.com");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !/(?:^|\.)neptun-ks\.com$/i.test(url.hostname) ||
      url.pathname === "/"
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

type Rect = { left: number; top: number; right: number; bottom: number };

function visibleRect(node: Element, page: HTMLElement): Rect | null {
  const box = node.getBoundingClientRect();
  let { left, top, right, bottom } = box;
  if (![left, top, right, bottom].every(Number.isFinite)) return null;
  const view = page.ownerDocument.defaultView;
  for (
    let parent: Element | null = node;
    parent;
    parent = parent.parentElement
  ) {
    const style = view?.getComputedStyle(parent);
    if (
      parent.hasAttribute("hidden") ||
      parent.getAttribute("data-export-hide") === "true" ||
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.visibility === "collapse" ||
      style?.opacity === "0"
    )
      return null;
    // Match the visible crop, including custom photo frames and output formats.
    if (parent !== node) {
      const clipX =
        parent === page ||
        /^(hidden|clip|scroll|auto)$/.test(
          style?.overflowX || style?.overflow || "",
        );
      const clipY =
        parent === page ||
        /^(hidden|clip|scroll|auto)$/.test(
          style?.overflowY || style?.overflow || "",
        );
      if (clipX || clipY) {
        const clip = parent.getBoundingClientRect();
        if (clipX) {
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
        }
        if (clipY) {
          top = Math.max(top, clip.top);
          bottom = Math.min(bottom, clip.bottom);
        }
      }
    }
    if (parent === page) break;
  }
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

/** Measure the rendered output page so transformed cards and resized formats
 * use exactly the same coordinate system as the rasterized PDF page. */
export function productPdfLinks(
  page: HTMLElement,
  products: readonly Product[],
  widthMm: number,
  heightMm: number,
): PdfProductLink[] {
  const bounds = page.getBoundingClientRect();
  if (
    ![
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
      widthMm,
      heightMm,
    ].every(Number.isFinite) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    widthMm <= 0 ||
    heightMm <= 0
  )
    return [];
  const byCode = new Map<string, Product>();
  const remember = (product: Product) => {
    byCode.set(String(product.code), product);
    product.bundleProducts?.forEach(remember);
  };
  products.forEach(remember);
  const links: PdfProductLink[] = [];
  const add = (node: Element, product?: Product) => {
    const url = neptunProductPdfUrl(product?.url);
    if (!url) return;
    const rect = visibleRect(node, page);
    if (!rect) return;
    links.push({
      url,
      x: ((rect.left - bounds.left) / bounds.width) * widthMm,
      y: ((rect.top - bounds.top) / bounds.height) * heightMm,
      width: ((rect.right - rect.left) / bounds.width) * widthMm,
      height: ((rect.bottom - rect.top) / bounds.height) * heightMm,
    });
  };
  for (const card of page.querySelectorAll("[data-product-code]")) {
    const product = byCode.get(card.getAttribute("data-product-code") || "");
    // A shared bundle price must not open the first member by accident.
    if (!product || product.bundleProducts?.length) continue;
    add(card, product);
    const cardBox = card.getBoundingClientRect();
    for (const artwork of card.querySelectorAll(
      ".brochure-product-image, .product-artwork-item",
    )) {
      const box = artwork.getBoundingClientRect();
      if (
        box.left < cardBox.left ||
        box.top < cardBox.top ||
        box.right > cardBox.right ||
        box.bottom > cardBox.bottom
      )
        add(artwork, product);
    }
  }
  for (const member of page.querySelectorAll(
    "[data-bundle-member-code], [data-bundle-artwork-code]",
  )) {
    const cardCode = member
      .closest("[data-product-code]")
      ?.getAttribute("data-product-code");
    const bundle = cardCode ? byCode.get(cardCode) : undefined;
    const code =
      member.getAttribute("data-bundle-member-code") ||
      member.getAttribute("data-bundle-artwork-code");
    const product = bundle?.bundleProducts?.find(
      (item) => String(item.code) === code,
    );
    add(member, product);
  }
  return links;
}

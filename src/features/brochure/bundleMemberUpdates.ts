import type { Product } from "../../domain/models";

export function bundleMemberByCode(
  product: Partial<Product>,
  code: string | number,
): Product | null {
  for (const member of product.bundleProducts || []) {
    if (String(member.code) === String(code)) return member;
    const nested = bundleMemberByCode(member, code);
    if (nested) return nested;
  }
  return null;
}

// Only the member path is copied. Shared offer prices and unrelated members
// retain their values and identities when a photo label is edited.
export function updateBundleMember(
  product: Partial<Product>,
  code: string | number,
  patch: Partial<Product>,
): Product["bundleProducts"] {
  if (!product.bundleProducts) return product.bundleProducts;
  let changed = false;
  const next = product.bundleProducts.map((member) => {
    if (String(member.code) === String(code)) {
      changed = true;
      return { ...member, ...patch };
    }
    const children = updateBundleMember(member, code, patch);
    if (children === member.bundleProducts) return member;
    changed = true;
    return { ...member, bundleProducts: children };
  });
  return changed ? next : product.bundleProducts;
}

import type { Product } from "../../domain/models";

/** Keep an explicitly supplied monthly amount only while its source price and
 * installment count still apply. Editing either returns to normal calculation. */
export function productInstallmentAmount(
  product: Product,
  installments: number | string = 12,
) {
  const count = Math.min(
    60,
    Math.max(1, Number.parseInt(String(installments), 10) || 12),
  );
  const source = product.brochureInstallment;
  if (
    source &&
    Number.isFinite(source.amount) &&
    source.amount > 0 &&
    source.count === count &&
    Number(source.sale) === Number(product.sale)
  )
    return source.amount;
  return Number(product.sale) / count;
}

import type { Product } from "../../domain/models";
import { productColors } from "./colors";
import "../../styles/bundle-variant-colors.css";

function variantMembers(product: Product): Product[] {
  if (product.hideColors) return [];
  if (product.bundleProducts?.length)
    return product.bundleProducts.flatMap(variantMembers);
  return (product.brochureVariants?.length ?? 0) > 1 ? [product] : [];
}

/** Keep each model's color choices together inside a shared offer. */
export function BundleVariantColors({
  product,
  showNames = true,
}: {
  product: Product;
  showNames?: boolean;
}) {
  const members = variantMembers(product).filter(
    (member) => productColors(member).length > 1,
  );
  if (!members.length) return null;
  return (
    <div className="bundle-variant-colors">
      {members.map((member) => (
        <div
          key={member.code}
          className="bundle-variant-color-group"
          role="group"
          aria-label={`Ngjyrat: ${member.name}`}
        >
          {showNames && (
            <span className="bundle-variant-color-name">{member.name}</span>
          )}
          <span className="bundle-variant-color-dots">
            {productColors(member).map((color) => (
              <i
                key={color.name}
                role="img"
                aria-label={color.name}
                title={color.name}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

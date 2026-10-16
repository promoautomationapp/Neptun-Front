import React, { useRef, type ReactNode } from "react";
import { ProductNameDivider } from "../brochure/ProductNameDivider";

/** Names, codes and prices share the brochure's measured price divider. */
export function SocialOfferFrame({
  className = "",
  copy,
  price,
  savings,
  details,
  manualCopy = false,
  onEdit,
}: {
  className?: string;
  copy?: ReactNode;
  price?: ReactNode;
  savings?: ReactNode;
  details?: ReactNode;
  manualCopy?: boolean;
  onEdit?: () => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  return (
    <div className={`social-offer ${className}`} onDoubleClick={onEdit}>
      <div className="social-product-bottom brochure-product-bottom" ref={row}>
        {copy}
        {price}
        {savings}
        {copy && price && <ProductNameDivider rowRef={row} alignName={!manualCopy} />}
      </div>
      {details}
    </div>
  );
}

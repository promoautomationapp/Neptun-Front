import type { Product } from "../../src/domain/models";
import type { BrochurePage } from "../../src/features/brochure/campaignPages";

export function brochurePage(
  products: Product[],
  changes: Partial<BrochurePage> = {},
): BrochurePage {
  return {
    index: 0,
    layout: "classic8",
    image: "",
    backgroundColor: "",
    backgroundImage: "",
    backgroundGradient: null,
    showFooter: false,
    showFooterPageNumber: true,
    spacing: null,
    title: "Page 2",
    products,
    ...changes,
  };
}

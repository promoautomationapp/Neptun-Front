import type { Product, ScreenArtwork } from "../../domain/models";
import { isTelevision } from "./tvSpecs";

/** Old TV artwork stored contain as its automatic default. Fill the measured
 * display now; a newly saved whole-image choice remains an explicit opt-out. */
export function screenArtworkFit(
  product: Partial<Product>,
  artwork: ScreenArtwork | undefined = product.screenArtwork,
): "contain" | "cover" {
  if (!isTelevision(product)) return artwork?.fit || "contain";
  return artwork?.fit === "contain" && artwork.fitExplicit === true
    ? "contain"
    : "cover";
}

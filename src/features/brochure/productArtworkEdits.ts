import type { Artwork, Product } from "../../domain/models";
import { bundleMemberByCode, updateBundleMember } from "./bundleMemberUpdates";
import { screenArtworkForPhotoChange } from "./screenGeometry";

export type ProductArtworkPatch = Pick<
  Partial<Product>,
  "productArtworks" | "bundleProducts"
>;

// Updating the displayed bundle picture and its nested member is one edit.
// Geometry belongs to the photo source, while offer prices belong to the bundle.
export function patchProductArtwork(
  product: Partial<Product>,
  artworks: Artwork[],
  id: string,
  values: Partial<Artwork>,
): ProductArtworkPatch {
  const previous = artworks.find((item) => item.id === id);
  const productArtworks = artworks.map((item) =>
    item.id === id
      ? {
          ...item,
          ...values,
          ...(values.width != null && item.height != null && item.width > 0
            ? { height: (item.height * values.width) / item.width }
            : {}),
        }
      : item,
  );
  const patch: ProductArtworkPatch = { productArtworks };
  if (
    previous?.type !== "bundle-product" ||
    previous.memberCode == null ||
    typeof values.image !== "string"
  )
    return patch;
  const member = bundleMemberByCode(product, previous.memberCode);
  if (!member) return patch;
  const oldSource =
    previous.image || member.image || member.localImage || member.imageUrl;
  patch.bundleProducts = updateBundleMember(product, previous.memberCode, {
    image: values.image,
    ...(member.screenArtwork
      ? {
          screenArtwork: screenArtworkForPhotoChange(
            member.screenArtwork,
            oldSource,
            values.image,
          ),
        }
      : {}),
  });
  return patch;
}

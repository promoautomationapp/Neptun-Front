# Black Friday November preset

`neptun-black-friday` reproduces the supplied A3 November reference with source fonts, transparent photos, native vector logos, independent marketing artwork, orange prices and charcoal installments. Campaign snapshots carry `brochureReferenceDesign: "black-friday"`, including saved custom copies.

The reference workbook contains 77 unique offer identities and 340 detail facts on 12 product-bearing pages. A separate editable promotional page is page 13. Models with repeated names receive a page/order suffix as an offer identifier; these identifiers are not invented Neptun ERP codes.

- `blackFridayReference.json` stores source page frames and native element geometry.
- `blackFridaySourceManifest.json` stores original product facts and approved static image paths.
- Exact source images are reused on import and are never sent for automatic AI processing.
- Printed savings/monthly discrepancies are preserved only while their original prices and mode/count remain unchanged. Editing those inputs restores ordinary recalculation.
- Every marketing/photo/text/shape layer uses normal canvas controls. The person can be kept, replaced or omitted when selecting the preset. Device annotations use card-relative coordinates.
- Explicitly added banners reserve space beneath them in every design; ordinary floating source artwork preserves its source overlaps.

The approved source fonts/assets are bundled in `public/brochure-presets/black-friday/`. `tools/black_friday_native_svg.py` documents native PDF compound-path extraction; set `BLACK_FRIDAY_SOURCE_PDF` when the reference PDF is outside the original Desktop package. The exporter keeps native glyph holes and fill rules; it does not generate artwork with AI.

Validation covers source membership/counts, editable/persisted frames, independent annotations, trusted-image reuse, source pricing guards, fonts, preset switching, source vectors, banner layout and a 13-page A3 PDF download. The printable comparison should still be reviewed against the supplied source for final production artwork approval.

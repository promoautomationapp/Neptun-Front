# Brochure fixes in the new projects

Historical 8 October report. The editor is now integrated and the complete typecheck/build passes. See [the current implementation check](IMPLEMENTATION_CHECK.md) for the 15 October status.

Updated 8 October 2026. Changes are in the sibling frontend and backend. The original `../neptun-campaign-studio` remains read-only. No paid AI, cutout generation or production deployment was performed.

## Importing offers and sets

- Multiple product codes in one cell retain one offer and one shared price.
- The optional `Pulla`/`Set` column is detected without regard to capitalization. Consecutive rows marked `Set` form one offer; an unmarked or empty row ends that group. Both sales and brochure-position imports use the same grouping rules.
- The first populated shared sale price is used, rather than adding member prices. Conflicting prices, missing prices, repeated member codes and unmatched member codes produce a clear import issue for the whole group. Separate repeated sets retain distinct identities and source-row provenance.
- Two-member sets retain the oven/hob arrangement. Three or more members use a rounded full-width panel, independent product photos, plus signs, each member's complete details and warranty, and one shared brand/savings/price region. Panel color, brand image/visibility and each member's copy are editable in a collapsed settings group.
- Photo replacement updates the nested member and its artwork together in one edit. Existing shared prices and unrelated member positions remain intact.

## Details and original artwork

- The original SkolaSans Light/Bold/Black and TSTAR Bold binaries and font URLs are retained. Reference proportions govern capacity values, labels, feature copy and large warranty numbers. Long text fits its box without dropping actual facts.
- Mobile storage and RAM share a box, with storage above RAM and no redundant Memory label. Rear/front cameras and battery facts are grouped. Android can occupy the first white box. Explicit saved detail lists and structured row keys remain authoritative.
- Power values such as `Fuqia 860W` display as `860W`. Washing-machine capacity, spin, programs, motor and technology are separate factual boxes. AC BTU, energy classes and operating temperatures use their reference structure; inverter, WiFi and energy badges remain editable.
- Imported wording, numbers and separators are preserved unless a supported redundant semantic label is removed. No missing specifications are invented.
- The white line follows the last product-name line and meets the sale/installment boundary. It measures the name rather than mobile color swatches and follows live price movement.
- TV folded inch artwork defaults to 10% smaller and 2 pixels left/down at canonical 1080 width. The same proportions apply in every format. Supported non-Apple phone screens use the same corner treatment. Saved manual positioning, visibility and scale remain intact, including separate members of a set.
- Savings sit farther right. Apple primary, additional and nested bundle photos retain a visible gap from price and savings artwork, including regular-price bands and shadows. Display corrections preserve requested saved coordinates.
- New brochures default MacBooks to two products per row. That option is available for every group, and explicit manual layouts remain honored. Reflow preserves offers, backgrounds, page artwork and review anchors.

## Every chosen background

The same layout, drag/drop, typography, price and Apple clearance rules apply to all chosen colors, gradients and images. Blue is a default, not a condition for these features.

Each cover, product page and stores page keeps its own background. A set panel derives a slightly darker color from its actual page or cover color/gradient, with a manual override. Text and monochrome brand/WiFi ink adapt to light, dark and middle-tone colors. Photos and gradients crossing light/dark tones receive compact local surfaces behind text; product image pixels are not edited. Store/footer groups retain readable backing when moved outside their original band.

## Editing, wallpaper and output geometry

- Upload-first brochure creation and collapsed optional settings are retained. Covers support replaceable/hideable logos, UUU artwork, movable optional text, multiple images, gradient/overlay/shadow layers and independent page backgrounds.
- Uploaded TV wallpaper works without AI, on one or all TVs, including recursive set members. Same-photo manual fits are retained. Changing the photo removes stale screen geometry while retaining the wallpaper, so the local screen fit can refresh for the new photo.
- Four undo and redo steps restore complete layouts and retain the latest server save version/review metadata. Canceled or lost-capture gestures restore page, cover, store, additional-product-image and detail-block positions without saving partial edits.
- The default format remains 1080×1350. All 11 digital/paper formats retain proportional geometry. Optional stores pages, selected-store reflow and a proportionally fitted footer on the last product page are retained.
- SVG and AVIF uploads, including embedded document images, are accepted by the backend and converted to transparent PNGs without AI. Existing raster/font/PDF policies and limits remain intact.

## Verification and remaining integration

**228 frontend tests across 41 files pass.** They cover semantic details, Set imports, three-member panels, all-format geometry, shared prices, nested TV/phone labels, wallpaper replacement, native price weights, Apple clearance, name alignment, four-step history, canceled gestures and background contrast. A 4,096-color audit verifies readable solid/panel ink. Providers are mocked; these checks make no paid AI requests.

New typed helpers and artwork modules have zero diagnostics in the full check, and focused strict TypeScript with `noUncheckedIndexedAccess`, scoped ESLint and formatting pass. Settings typechecking passes. The copied Studio resolves and bundles in memory without emitting files. The backend passes 63 tests, strict typechecking, build and lint; see [the backend report](../../neptun-broshura-backend/docs/BROCHURE_FIXES.md).

**The complete frontend build remains unfinished: 2,508 diagnostics in the broader editor port.** `src/app/App.tsx` currently exposes sign-in, Settings and a workspace placeholder; the copied Studio/brochure editor is not yet routed into that app. Catalog wiring, full editor integration, server exports and visual/browser acceptance remain pending. No browser acceptance was retried during this work. Passing source tests does not establish a launched replacement or 100% visual parity.

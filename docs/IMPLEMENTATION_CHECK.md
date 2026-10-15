# Campaign implementation check

Checked 15 October 2026 against the original `neptun-campaign-studio/src` and the new frontend/backend. The original project was not modified.

| Original area | Current implementation | Verification |
| --- | --- | --- |
| Campaigns and Excel imports | Studio, Modals, brochureImport, excelProducts | Creation/upload, Set grouping, missing-catalog and incomplete-row tests. The supplied workbook has 87 positioned rows without a code/name; these remain editable drafts with their supplied data. |
| Cover and artwork | CoverElement, coverElements, CoverPage | UUU edge backing and decorative-photo clipping; independent logos, text/images, layers, saved placement, overflow reflow and canonical-size thumbnails. |
| Product design and prices | Brochure, detailFacts/detailRows, product artwork, price models | All 11 formats, original fonts, current/reference price cards, Apple clearance, grouped facts, warranty, dividers, bundle members, TV/phone labels and photo replacement tests. |
| Appliance detail selection | brochureDefaultDetailEntries | Restored original washer/dishwasher fact priorities. Imported lists and explicit block edits remain authoritative; original specs are retained. |
| Settings | SettingsPage and nine SettingsEditor tabs | Cover/colors, backgrounds, logos/icons, brands, stores/contacts, prices/savings, categories, formats/layout and campaign types. Defaults match the original except authenticated backend asset URLs. |
| Media and AI | Authenticated R2 assets, durable backend jobs and reuse | Prepared cutouts/logos/text reused; read/print/export do not generate AI. Browser inspection preserves source PNG bytes; server validates alpha. Interrupted billable requests require explicit review. |
| Export and social | BrochureExport, SocialStudio, CanvasLayers | PDF, PNG/JPG, ZIP of pages, saved social posts, text/layers and canvas models. Browser export uses the same artwork; private/source images are resolved through the backend. |
| Persistence and collaboration | Document JSONB, versions, presence | Saves preserve nested settings/artwork. Optimistic conflict protection, four-step undo/redo, review workflow and concurrent editor status. Support identities are anonymized for Neptun users without erasing the audit. |
| Accounts | UsersPage, IdentityService | Both admin types invite Neptun admins/staff/PMs. New users use verified email invitations; the two default admins keep regular verified password login. Support accounts are hidden from Neptun user/member APIs. |
| Catalog and operations | Catalog refresh, worker, Insights | Manual click plus one daily scheduled run; no startup refresh. Upserts retain products and prepared work. Superadmin-only AI/date/cost/token, R2 and DB tabs. |

The comparison covered 367 original named exports and every original stylesheet. Renamed/split helpers were checked against their current equivalents: CoverThumbnail → CampaignCoverThumbnail, repairCoverProductPlacements → repairCoverProductLayout, inspectPreparedImage → image-inspection, screenAnnotationPlacement → screenAnnotationGeometry, and the cutout revision → backend provider metadata. Classic editor code is retained in `features/classic`; its sidebar shortcut is hidden as requested.

Validation: complete frontend typecheck and 373 existing tests passed before the last appliance regression was added; that regression and affected component tests also pass. A clean lockfile build is checked separately. Backend: 189 tests and build pass; production `/health`, `/ready`, default sign-in, SMTP configuration, superadmin-only insights and support-identity visibility were checked without creating AI jobs or sending messages.

This is a source/behavior check, not a claim of pixel-perfect acceptance for every possible brochure or email client. Desktop/mobile preview checks and existing export checks cover representative layouts. New team/privacy copy and appliance-detail improvements are local until the frontend is pushed.

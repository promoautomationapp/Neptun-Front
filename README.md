# Neptun Broshura frontend

This is the new sibling frontend under development. The original `../neptun-campaign-studio` remains read-only. The database/storage import has been verified, but the full brochure, social and classic editors have not completed their strict TypeScript and parity gates. This folder is not ready to replace or deploy the original application.

## Local development

Use Node 22. Run `npm ci`, start the API and worker in `../neptun-broshura-backend`, then run `npm run dev` here. The frontend runs at `http://localhost:5173`; its API is `http://localhost:3000`. `.env.example` contains only a public API URL. Credentials and AI/storage keys belong to the backend.

The active application currently exposes the session/password foundation and the six-tab shared Settings page. Ported editor source lives under `src/features`; it still requires full integration. The original fonts, CSS, art metrics and all output formats are retained for parity checks. Images, fonts, uploads and saved documents resolve through the backend; no catalog image tree is copied into the public frontend.

## Automatic AI reuse

The backend stores results and deduplicates requests across Neptun team sessions. Unchanged cutouts use stored assets; individual text checks survive changed batch order and reuse successful checks with no corrections. Mounting/reopening an AI dialog does not start a job. Print/export read paths do not invoke AI. Existing explicit AI actions start asynchronous jobs and read their saved results. No cache-management UI is added.

Review history is saved with each document. Changes made while AI is running remain unchecked until the actual new text is reviewed. Approved reference cutouts with older missing metadata stay usable without regeneration. See [the detailed backend reuse behavior](../neptun-broshura-backend/docs/AI_REUSE.md).

## Validation and remaining work

The cumulative brochure fixes are ported, including Set-column/shared-price imports, three-member editable panels, grouped factual details, TV/phone corners, Apple clearance, wallpaper refitting and every chosen background color/gradient/image. See [brochure fixes and their integration status](docs/BROCHURE_FIXES.md).

`npm test` passes 228 tests across 41 files. Coverage includes formats, native price artwork, Set grouping, complete member facts, screen annotations, atomic photo replacement, Apple clearance, name alignment, all chosen backgrounds, canceled gestures, stores and four-step history. Providers are mocked; these tests do not make paid OpenAI calls. Settings tests cover independent snapshots, original defaults, store/type management, uploads, category savings, manufacturer logos and draft retention. New typed helpers/artwork modules pass strict TypeScript and scoped lint; Settings typechecking also passes. Prior isolated Settings browser checks were not rerun during this work. To include original font/image delivery checks, set `NEPTUN_REFERENCE_DIR` to the original project folder. See [Settings behavior](../neptun-broshura-backend/docs/SETTINGS.md).

`npm run typecheck` and `npm run build` remain failing for the broader editor port (2,508 diagnostics on 8 October). The Studio/brochure editor is not yet routed into the active app. Finish models/components, paginated catalog and import wiring, classic DB persistence, all existing exports, behavioral/visual/font parity and full frontend lint/build before replacement. The complete acceptance checklist is in `../neptun-broshura-migration-plan.md`; current status is in `../neptun-broshura-backend/docs/MIGRATION_STATUS.md`.

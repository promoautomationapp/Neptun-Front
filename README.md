# Neptun Broshura frontend

The frontend includes the campaign workspace, brochure editor, social and classic editors, catalog and shared settings. Albanian is selected by default; an explicit English selection is remembered. Product photos, saved documents and generated media are provided by the backend.

## Local development

Use Node 22. Run `npm ci`, start the API and worker in `../Neptun-Backend`, then run `npm run dev` here. The frontend runs at `http://localhost:5173`; its API is `http://localhost:3000`. `.env.example` contains only a public API URL. Credentials and AI/storage keys belong to the backend.

The original brochure price artwork and fonts are retained. Product images fit their visible bounds, details use one square row, and full preview fits the viewport in the selected export proportion. The tested PNG export preserves the selected 1080 × 1350 resolution. Images, fonts, uploads and saved documents resolve through the backend; no catalog image tree is copied into the public frontend.

## Automatic AI reuse

The backend stores results and deduplicates requests across Neptun team sessions. Unchanged cutouts use stored assets; individual text checks survive changed batch order and reuse successful checks with no corrections. Mounting/reopening an AI dialog does not start a job. Print/export read paths do not invoke AI. Existing explicit AI actions start asynchronous jobs and read their saved results. No cache-management UI is added.

Review history is saved with each document. Changes made while AI is running remain unchecked until the actual new text is reviewed. Approved reference cutouts with older missing metadata stay usable without regeneration. See [the detailed backend reuse behavior](../neptun-broshura-backend/docs/AI_REUSE.md).

## Saving and team activity

Changes are saved automatically. A status directly above the brochure distinguishes edit and preview modes, reports saving or save errors, and shows other active editors. Version conflicts retain the local draft instead of silently replacing it. Apply backend migration `0013_campaign_presence.sql` with `npm run db:migrate` to enable team activity.

The backend worker performs the daily category/subcategory catalog refresh at 03:00 Europe/Belgrade. Existing products and prepared assets are retained, and saved brochure snapshots are independent of catalog updates.

## Validation

The cumulative brochure fixes are ported, including Set-column/shared-price imports, three-member editable panels, grouped factual details, TV/phone corners, Apple clearance, wallpaper refitting and every chosen background color/gradient/image. See [brochure fixes and their integration status](docs/BROCHURE_FIXES.md).

`npm test` passes 360 tests. Coverage includes formats, native price artwork, Set grouping, complete member facts, screen annotations, atomic photo replacement, name alignment, backgrounds, canceled gestures, stores, edit history, approved asset reuse, saving conflicts and the default language. Providers are mocked; these tests do not make paid OpenAI calls. Strict TypeScript, production build and lint on the changed modules pass. Browser verification covers the actual brochure renderer, full preview, save status and lossless PNG capture. To include original font/image delivery checks, set `NEPTUN_REFERENCE_DIR` to the original project folder.

Deployment still requires the backend environment configuration, database migrations, private production storage, and running both the API and worker. No production deployment was performed by these local checks.

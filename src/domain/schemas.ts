import { z } from "zod";
import {
  pageDecorationSchema,
  pageAppearancesSchema,
  workspaceSettingsSchema,
} from "../features/settings/settings.schema";
import type {
  JsonValue,
  Campaign,
  SocialPost,
  Product,
  Settings,
} from "./models";
export const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);
export const jsonObject = z.record(z.string(), jsonValue);
export const pageArtworkSchema = z
  .object({
    layoutRole: z.literal("banner").optional(),
    bannerOverlay: z
      .object({
        type: z.enum(["color", "gradient", "image"]),
        color: z
          .string()
          .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i)
          .optional(),
        endColor: z
          .string()
          .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i)
          .optional(),
        angle: z.number().min(0).max(360).optional(),
        image: z.string().max(20000000).optional(),
        opacity: z.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
    referenceSource: z.string().max(500).optional(),
    referenceRole: z
      .enum(["person", "wifi", "inverter", "energy", "promotion"])
      .optional(),
    textRuns: z
      .array(
        z
          .object({
            text: z.string().max(2000),
            fontScale: z.number().min(0.1).max(5),
            verticalAlign: z.enum(["baseline", "super", "top"]).optional(),
            fontWeight: z.number().int().min(100).max(1000).optional(),
            fontStyle: z.enum(["normal", "italic"]).optional(),
            color: z
              .string()
              .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i)
              .optional(),
          })
          .strict(),
      )
      .max(200)
      .optional(),
    wordSpacing: z.number().min(-1).max(5).optional(),
    whiteSpace: z.enum(["nowrap", "pre-wrap"]).optional(),
    shapePath: z
      .string()
      .max(20000)
      .regex(/^[MmLlHhVvCcSsQqTtAaZzEe0-9.,+\s-]*$/)
      .optional(),
    fill: z
      .string()
      .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i)
      .optional(),
    stroke: z
      .string()
      .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i)
      .optional(),
    strokeWidth: z.number().min(0).max(10).optional(),
    backgroundColor: z
      .string()
      .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i)
      .optional(),
    textVerticalAlign: z.enum(["top", "center", "bottom"]).optional(),
    padding: z.number().min(0).max(10).optional(),
  })
  .catchall(jsonValue)
  .superRefine((artwork, context) => {
    if (artwork.layoutRole !== "banner") return;
    for (const [key, minimum, maximum] of [
      ["x", 0, 100],
      ["y", 0, 100],
      ["width", 1, 100],
      ["height", 1, 100],
    ] as const) {
      const value = artwork[key];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum
      )
        context.addIssue({
          code: "custom",
          path: [key],
          message: `Banner ${key} must be between ${minimum} and ${maximum}.`,
        });
    }
  });
// Open layouts preserve every reference field; mandatory identity/content fields are validated here.
export const productSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    productArtworks: z.array(pageArtworkSchema).max(200).optional(),
    brochureSavings: z
      .object({
        value: z.number().positive().finite(),
        type: z.enum(["amount", "percentage"]),
        regular: z.number().positive().finite(),
        sale: z.number().positive().finite(),
      })
      .strict()
      .optional(),
    brochureInstallment: z
      .object({
        amount: z.number().positive().finite(),
        count: z.number().int().min(1).max(60),
        sale: z.number().positive().finite(),
      })
      .strict()
      .optional(),
    specs: z.record(z.string(), z.string()).optional(),
    regular: z.union([z.number(), z.string(), z.null()]).optional(),
    image: z.string().optional(),
    imageUrl: z.string().optional(),
    localImage: z.string().optional(),
    thumbnail: z.string().optional(),
    preview: z.string().optional(),
    images: z.array(z.string()).optional(),
  })
  .catchall(jsonValue)
  .transform((value) => value as Product);
export const brochureFooterSchema = z.object({
  style: z.enum(["bar", "reference"]).optional(),
  visible: z.boolean().optional(),
  fadeEnd: z.boolean().optional(),
  showAwards: z.boolean().optional(),
  dateText: z.string().max(2000).optional(),
  bottom: z.number().min(0).max(80).optional(),
  height: z.number().min(2).max(12).optional(),
  dateWidth: z.number().min(15).max(55).optional(),
  dateSize: z.number().min(0.8).max(3.5).optional(),
  paymentSize: z.number().min(0.7).max(3).optional(),
  from: z
    .string()
    .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i)
    .optional(),
  to: z
    .string()
    .regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i)
    .optional(),
});
export const campaignSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    brochureFooter: brochureFooterSchema.optional(),
    brochurePresetId: z.string().max(100).optional(),
    brochureReferenceDesign: z
      .enum(["black-friday", "black-collection"])
      .optional(),
    pageArtworks: z
      .record(z.string(), z.array(pageArtworkSchema).max(200))
      .optional(),
    brandLogoMode: z.enum(["auto", "white", "dark", "original"]).optional(),
    brandLogoColor: z
      .string()
      .regex(/^(?:|#[0-9a-f]{6}(?:[0-9a-f]{2})?)$/i)
      .optional(),
    pageAppearances: pageAppearancesSchema.optional(),
    coverBrandTagline: z.string().max(500).optional(),
    coverRibbonColors: z
      .object({
        from: z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i),
        to: z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i),
      })
      .optional(),
    brochureVisualStyle: z.enum(["current", "october"]).optional(),
    pageDecorationDefaults: pageDecorationSchema.optional(),
    pages: z
      .record(
        z.string(),
        pageDecorationSchema
          .extend({
            headerText: z.string().max(2000).optional(),
            footerNumber: z.string().max(40).optional(),
            showFooter: z.boolean().optional(),
            showFooterPageNumber: z.boolean().optional(),
          })
          .catchall(jsonValue),
      )
      .optional(),
    showFooterPageNumber: z.boolean().optional(),
    products: z.array(productSchema),
    version: z.number().int().positive().optional(),
  })
  .catchall(jsonValue)
  .transform((value) => value as Campaign);
export const postSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    background: z
      .object({
        type: z.string().optional(),
        color: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        angle: z.number().optional(),
        image: z.string().optional(),
      })
      .catchall(jsonValue)
      .default({}),
    products: z.array(productSchema),
    version: z.number().int().positive().optional(),
  })
  .catchall(jsonValue)
  .transform((value) => value as SocialPost);
export const settingsSchema = workspaceSettingsSchema.transform(
  (value) => value as Settings,
);

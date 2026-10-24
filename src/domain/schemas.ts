import { z } from "zod";
import {
  pageDecorationSchema,
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
// Open layouts preserve every reference field; mandatory identity/content fields are validated here.
export const productSchema = z
  .object({
    code: z.string(),
    name: z.string(),
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
  dateText: z.string().max(2000).optional(),
  bottom: z.number().min(0).max(80).optional(),
  height: z.number().min(2).max(12).optional(),
  dateWidth: z.number().min(15).max(55).optional(),
  dateSize: z.number().min(0.8).max(3.5).optional(),
  paymentSize: z.number().min(0.7).max(3).optional(),
  from: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  to: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});
export const campaignSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    brochureFooter: brochureFooterSchema.optional(),
    brochurePresetId: z.string().max(100).optional(),
    coverBrandTagline: z.string().max(500).optional(),
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

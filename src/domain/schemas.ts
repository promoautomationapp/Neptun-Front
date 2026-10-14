import { z } from "zod";
import { workspaceSettingsSchema } from "../features/settings/settings.schema";
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
export const campaignSchema = z
  .object({
    id: z.string(),
    name: z.string(),
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

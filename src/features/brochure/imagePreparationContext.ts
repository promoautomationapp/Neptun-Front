import type {Gradient}from "../../domain/models";
export interface ImageBackgroundContext {kind:string;description?:string;image?:string;color?:string;gradient?:Gradient}
function record(value:unknown):Record<string,unknown>|null{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;}
export const IMAGE_PREPARATION_REVISION = 3;

const color = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "";

// Keep the same canonical context on the client and server. Image URLs identify
// the background; the signature stored on a product never contains image data.
export function normalizeImageBackgroundContext(input:unknown) {
  const value=record(input);
  if (!value) return { kind: "none" };
  const gradient=record(value.gradient);
  const description = String(value.description || "").trim().slice(0, 500);
  const image = typeof value.image === "string" ? value.image : "";
  const from = color(gradient?.from);
  const to = color(gradient?.to);
  const angle = Number(gradient?.angle);
  const solid = color(value.color);
  let result:ImageBackgroundContext;
  if (value.kind === "image" && image) result = { kind: "image", ...(solid ? { color: solid } : {}), image };
  else if (value.kind === "gradient" && from && to && Number.isFinite(angle)) result = { kind: "gradient", gradient: { from, to, angle: Math.max(0, Math.min(360, angle)) } };
  else if (solid) result = { kind: "solid", color: solid };
  else result = { kind: "none" };
  if (description) result.description = description;
  return result;
}

export function imageBackgroundSignature(value:unknown) {
  const canonical = JSON.stringify(normalizeImageBackgroundContext(value));
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `bg-v1:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

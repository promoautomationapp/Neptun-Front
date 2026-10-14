import type { Campaign } from "../../domain/models";
import { request, resolveAsset } from "../../api/client";
import { z } from "zod";
export const BUILTIN_BRAND_LOGOS: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries({
      LG: "/api/assets/legacy/assets/brand-logos/lg.svg",
      BEKO: "/api/assets/legacy/assets/brand-prepared/beko.png",
      FUEGO: "/api/assets/legacy/assets/brand-prepared/fuego.png",
      SAMSUNG: "/api/assets/legacy/assets/brand-prepared/samsung.png",
      CANDY: "/api/assets/legacy/assets/brand-prepared/candy.png",
      LENOVO: "/api/assets/legacy/assets/brand-prepared/lenovo.png",
      PHILIPS: "/api/assets/legacy/assets/brand-prepared/philips.png",
      ROBOROCK: "/api/assets/legacy/assets/brand-logos/roborock.svg",
      TCL: "/api/assets/legacy/assets/brand-prepared/tcl.png",
      APPLE: "/api/assets/legacy/assets/brand-prepared/apple.png",
      BOSCH: "/api/assets/legacy/assets/brand-prepared/bosch.png",
      HP: "/api/assets/legacy/assets/brand-prepared/hp.png",
      XIAOMI: "/api/assets/legacy/assets/brand-prepared/xiaomi.png",
      TEFAL: "/api/assets/legacy/assets/brand-prepared/tefal.png",
      INSTA360: "/api/assets/legacy/assets/brand-prepared/insta360.png",
      LOGITECH: "/api/assets/legacy/assets/brand-prepared/logitech.png",
    }).map(([brand, path]) => [brand, resolveAsset(path)]),
  );
let sharedLogos: Record<string, string> = {};
let loading: Promise<Record<string, string>> | undefined;
export function rememberPreparedBrandLogo(brand: unknown, url: string): void {
  const path = url.startsWith("http") ? new URL(url).pathname : url;
  if (
    brand &&
    /^\/api\/(?:assets\/[a-f0-9-]{36}|brand-logos\/[a-f0-9]{64}\.png)$/.test(
      path,
    )
  )
    sharedLogos[String(brand).trim().toUpperCase()] = url;
}
export function loadPreparedBrandLogos(): Promise<Record<string, string>> {
  loading ??= request("/api/brand-logos", z.record(z.string(), z.string()))
    .then((logos) => {
      sharedLogos = { ...logos, ...sharedLogos };
      return sharedLogos;
    })
    .catch(() => {
      loading = undefined;
      return sharedLogos;
    });
  return loading;
}
export function brandLogoFor(
  campaign: Pick<Campaign, "brandLogos"> | null | undefined,
  brand: unknown,
): string {
  const key = String(brand ?? "")
    .trim()
    .toUpperCase();
  if (campaign?.brandLogos && Object.hasOwn(campaign.brandLogos, key))
    return campaign.brandLogos[key] ?? "";
  return sharedLogos[key] ?? BUILTIN_BRAND_LOGOS[key] ?? "";
}

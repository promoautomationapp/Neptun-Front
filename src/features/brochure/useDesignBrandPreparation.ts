import { useEffect, useRef, useState } from "react";
import type { Campaign, CampaignMutator } from "../../domain/models";
import { requestAi } from "../ai/ai.api";
import {
  brandLogoFor,
  loadPreparedBrandLogos,
  rememberPreparedBrandLogo,
} from "./brandLogos";

const COOLDOWN = 14 * 24 * 60 * 60 * 1000;
const flights = new Map<string, Promise<string>>();
const failures = new Map<string, number>();
export function missingDesignBrands(campaign: Campaign) {
  const brands = new Map<string, string>();
  for (const product of campaign.products) {
    const brand = String(product.brand || "")
      .trim()
      .toUpperCase();
    if (
      !brand ||
      product.brandLogo ||
      brandLogoFor(campaign, brand) ||
      Object.hasOwn(campaign.brandLogos || {}, brand)
    )
      continue;
    const source =
      (product.images || []).find((image) =>
        /[?&]width=80(?:&|$)/i.test(image),
      ) || "";
    if (!brands.has(brand) || (!brands.get(brand) && source))
      brands.set(brand, source);
  }
  return [...brands].map(([brand, source]) => ({ brand, source }));
}
/** The server persists reusable prepared assets. Client guards prevent repeat
 * automatic attempts after failures or interrupted billable work. */
export async function prepareDesignBrands(
  campaign: Campaign,
  update: (mutator: CampaignMutator) => void,
  progress: (remaining: number) => void = () => {},
  now = Date.now(),
) {
  await loadPreparedBrandLogos();
  for (const [brand, receipt] of Object.entries(
    campaign.brandPreparation || {},
  )) {
    if (
      receipt.status === "ready" &&
      receipt.url &&
      !brandLogoFor(campaign, brand)
    ) {
      rememberPreparedBrandLogo(brand, receipt.url);
      campaign.brandLogos ||= {};
      campaign.brandLogos[brand] = receipt.url;
      update((draft) => {
        if (draft.id === campaign.id) {
          draft.brandLogos ||= {};
          draft.brandLogos[brand] = receipt.url!;
        }
      });
    }
  }
  const targets = missingDesignBrands(campaign);
  const unresolved: string[] = [];
  for (const [index, target] of targets.entries()) {
    progress(targets.length - index);
    const { brand, source } = target;
    const recent = campaign.brandPreparation?.[brand];
    const key = `${campaign.id}:${brand}:${source}`;
    if (
      !source ||
      (recent?.source === source &&
        recent.status !== "ready" &&
        now - Date.parse(recent.attemptedAt) < COOLDOWN) ||
      now - (failures.get(key) || 0) < COOLDOWN
    ) {
      unresolved.push(brand);
      continue;
    }
    const attemptedAt = new Date(now).toISOString();
    update((draft) => {
      if (draft.id === campaign.id) {
        draft.brandPreparation ||= {};
        draft.brandPreparation[brand] = {
          source,
          attemptedAt,
          status: "pending",
        };
      }
    });
    try {
      let flight = flights.get(key);
      if (!flight) {
        flight = requestAi("ai-white-brand-logo", {
          image: source,
          brand,
        }).then((result) => result.url);
        flights.set(key, flight);
      }
      const url = await flight;
      rememberPreparedBrandLogo(brand, url);
      update((draft) => {
        if (draft.id === campaign.id) {
          draft.brandLogos ||= {};
          draft.brandLogos[brand] = url;
          draft.brandPreparation ||= {};
          draft.brandPreparation[brand] = {
            source,
            attemptedAt,
            status: "ready",
            url,
          };
        }
      });
    } catch {
      failures.set(key, now);
      // Bound session-only failure entries; persistent campaign receipts remain.
      if (failures.size > 200) failures.delete(failures.keys().next().value!);
      unresolved.push(brand);
      update((draft) => {
        if (draft.id === campaign.id) {
          draft.brandPreparation ||= {};
          draft.brandPreparation[brand] = {
            source,
            attemptedAt,
            status: "failed",
          };
        }
      });
    } finally {
      flights.delete(key);
    }
  }
  progress(0);
  return unresolved;
}
export function useDesignBrandPreparation(
  campaign: Campaign,
  onUpdate: (mutator: CampaignMutator) => void,
) {
  const current = useRef({ campaign, onUpdate });
  current.current = { campaign, onUpdate };
  const alive = useRef(true);
  const running = useRef<Promise<void> | null>(null);
  const [busy, setBusy] = useState(false),
    [remaining, setRemaining] = useState(0),
    [unresolved, setUnresolved] = useState<string[]>([]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setUnresolved([]);
  }, [campaign.id]);
  const prepareMissing = (nextCampaign?: Campaign) => {
    if (running.current) return running.current;
    const snapshot = structuredClone(nextCampaign || current.current.campaign),
      update = current.current.onUpdate;
    const missing = missingDesignBrands(snapshot);
    if (!missing.length) return Promise.resolve();
    if (!missing.some((target) => target.source)) {
      setUnresolved(missing.map((target) => target.brand));
      return Promise.resolve();
    }
    setBusy(true);
    running.current = prepareDesignBrands(snapshot, update, (count) => {
      if (alive.current) setRemaining(count);
    })
      .then((missing) => {
        if (alive.current && current.current.campaign.id === snapshot.id)
          setUnresolved(missing);
      })
      .catch(() => {
        if (alive.current)
          setUnresolved(
            missingDesignBrands(snapshot).map((item) => item.brand),
          );
      })
      .finally(() => {
        running.current = null;
        if (alive.current) {
          setBusy(false);
          setRemaining(0);
        }
      });
    return running.current;
  };
  return { prepareMissing, busy, remaining, unresolved };
}

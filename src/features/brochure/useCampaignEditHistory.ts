import type { Campaign, CampaignMutator } from "../../domain/models";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Dispatch,
  SetStateAction,
  FocusEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  createCampaignEditHistory,
  restoreCampaignEdit,
} from "./campaignEditHistory";
interface HistoryOptions {
  activeId: string | null;
  enabled: boolean;
  persist: (campaign: Campaign) => Promise<Campaign>;
  onError?: (error: unknown) => void;
}
interface Interaction {
  element: Element;
  pointerId?: number;
  campaignId: string;
  key: number;
}
function continuousControl(target: EventTarget | null) {
  const element =
    target instanceof Element
      ? target.closest("input, textarea, [contenteditable=true]")
      : null;
  return !element ||
    element.matches(
      "input[type=file], input[type=checkbox], input[type=radio], input[type=button], input[type=submit]",
    )
    ? null
    : element;
}
function isTextEditing(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "textarea, [contenteditable=true], input:not([type=range]):not([type=color]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])",
      ),
    )
  );
}
export function useCampaignEditHistory({
  activeId,
  enabled,
  persist,
  onError,
}: HistoryOptions) {
  const [campaigns, setCampaignState] = useState<Campaign[]>([]);
  const campaignsRef = useRef<Campaign[]>([]);
  const historyRef = useRef(createCampaignEditHistory());
  const optionsRef = useRef({ activeId, enabled, persist, onError });
  optionsRef.current = { activeId, enabled, persist, onError };
  const interactionRef = useRef<Interaction | null>(null);
  const sequenceRef = useRef(0);
  const setCampaigns: Dispatch<SetStateAction<Campaign[]>> = useCallback(
    (updater) => {
      const next =
        typeof updater === "function" ? updater(campaignsRef.current) : updater;
      const ids = new Set(next.map((campaign) => campaign.id));
      for (const campaign of campaignsRef.current)
        if (!ids.has(campaign.id)) historyRef.current.clear(campaign.id);
      for (const campaign of next) historyRef.current.observe(campaign);
      campaignsRef.current = next;
      setCampaignState(next);
    },
    [],
  );
  const endInteraction = useCallback(() => {
    const interaction = interactionRef.current;
    if (interaction) historyRef.current.endGroup(interaction.campaignId);
    interactionRef.current = null;
  }, []);
  const beginInteraction = useCallback(
    (element: Element, pointerId?: number) => {
      const options = optionsRef.current;
      if (!options.enabled || !options.activeId) return;
      endInteraction();
      interactionRef.current = {
        element,
        pointerId,
        campaignId: options.activeId,
        key: ++sequenceRef.current,
      };
    },
    [endInteraction],
  );
  const save = useCallback((campaign: Campaign) => {
    const saved = Promise.resolve().then(() =>
      optionsRef.current.persist(campaign),
    );
    void saved.catch((error) => optionsRef.current.onError?.(error));
    return saved;
  }, []);
  const updateCampaign = useCallback(
    (
      mutator: CampaignMutator,
      options: { id?: string; group?: string | number | null } = {},
    ) => {
      const id = options.id || optionsRef.current.activeId;
      const before = campaignsRef.current.find(
        (campaign) => campaign.id === id,
      );
      if (!before || before.disabledAt) return null;
      const after = structuredClone(before);
      mutator(after);
      const interaction = interactionRef.current;
      const group = Object.hasOwn(options, "group")
        ? options.group
        : interaction?.campaignId === id
          ? interaction.key
          : null;
      if (!historyRef.current.record(before, after, group))
        return {
          campaign: before,
          saved: Promise.resolve(before),
          changed: false,
        };
      after.updatedAt = new Date().toISOString();
      setCampaigns((current) =>
        current.map((campaign) => (campaign.id === id ? after : campaign)),
      );
      return { campaign: after, saved: save(after), changed: true };
    },
    [save, setCampaigns],
  );
  const restore = useCallback(
    (direction: "undo" | "redo") => {
      endInteraction();
      const id = optionsRef.current.activeId;
      const current = campaignsRef.current.find(
        (campaign) => campaign.id === id,
      );
      if (!current || current.disabledAt) return false;
      const snapshot = historyRef.current[direction](current);
      if (!snapshot) return false;
      const restored = restoreCampaignEdit(snapshot, current);
      restored.updatedAt = new Date().toISOString();
      setCampaigns((items) =>
        items.map((campaign) => (campaign.id === id ? restored : campaign)),
      );
      void save(restored);
      return true;
    },
    [endInteraction, save, setCampaigns],
  );
  const undoCampaign = useCallback(() => restore("undo"), [restore]);
  const redoCampaign = useCallback(() => restore("redo"), [restore]);
  useEffect(() => {
    endInteraction();
  }, [activeId, enabled, endInteraction]);
  useEffect(() => {
    const endPointer = (event: PointerEvent) => {
      if (interactionRef.current?.pointerId === event.pointerId)
        endInteraction();
    };
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    return () => {
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", endPointer);
    };
  }, [endInteraction]);
  useEffect(() => {
    if (!enabled || !activeId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        isTextEditing(event.target) ||
        (event.target instanceof Element &&
          event.target.closest(".cs-modal-backdrop"))
      )
        return;
      const key = event.key.toLowerCase();
      const direction =
        key === "z"
          ? event.shiftKey
            ? "redo"
            : "undo"
          : key === "y" && !event.shiftKey
            ? "redo"
            : null;
      if (!direction) return;
      event.preventDefault();
      restore(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, enabled, restore]);
  return {
    campaigns,
    setCampaigns,
    updateCampaign,
    undoCampaign,
    redoCampaign,
    historyCounts: historyRef.current.counts(activeId),
    interactionHandlers: {
      onFocusCapture: (event: FocusEvent<HTMLElement>) => {
        const element = continuousControl(event.target);
        if (element && interactionRef.current?.element !== element)
          beginInteraction(element);
        else if (!element) endInteraction();
      },
      onBlurCapture: (event: FocusEvent<HTMLElement>) => {
        if (interactionRef.current?.element === event.target) endInteraction();
      },
      onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => {
        const element = continuousControl(event.target);
        if (element)
          beginInteraction(
            element,
            element.matches("input[type=range]") ? event.pointerId : undefined,
          );
        else endInteraction();
      },
    },
  };
}

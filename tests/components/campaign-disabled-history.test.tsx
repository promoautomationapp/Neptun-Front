import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useCampaignEditHistory } from "../../src/features/brochure/useCampaignEditHistory";
import type { Campaign } from "../../src/domain/models";

afterEach(cleanup);

it("ignores late image/AI edits and undo/redo once a campaign is disabled", async () => {
  const original: Campaign = {
    id: "disabled-hook",
    name: "Original",
    products: [],
    version: 1,
  };
  const persist = vi.fn(async (value: Campaign) => value);
  const { result } = renderHook(() =>
    useCampaignEditHistory({ activeId: original.id, enabled: true, persist }),
  );
  act(() => result.current.setCampaigns([original]));
  let save: ReturnType<typeof result.current.updateCampaign>;
  act(() => {
    save = result.current.updateCampaign((draft) => {
      draft.name = "A real edit";
    });
  });
  await act(async () => {
    await save!.saved;
  });
  expect(persist).toHaveBeenCalledOnce();
  const disabled = {
    ...result.current.campaigns[0]!,
    version: 2,
    disabledAt: "2026-10-15T10:00:00Z",
  };
  act(() => result.current.setCampaigns([disabled]));
  let finish!: () => void;
  const delayed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const lateEdit = vi.fn((draft: Campaign) => {
    draft.name = "Late AI result";
  });
  const callback = delayed.then(() =>
    result.current.updateCampaign(lateEdit, { id: original.id }),
  );
  await act(async () => {
    finish();
    await callback;
  });
  expect(lateEdit).not.toHaveBeenCalled();
  expect(result.current.campaigns).toEqual([disabled]);
  expect(result.current.undoCampaign()).toBe(false);
  expect(result.current.redoCampaign()).toBe(false);
  expect(persist).toHaveBeenCalledOnce();
});

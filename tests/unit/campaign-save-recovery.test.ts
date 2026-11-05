import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError, request } from "../../src/api/client";
import { z } from "zod";
import {
  campaignDraft,
  setCampaignSaveOwner,
} from "../../src/features/brochure/campaignDraftRecovery";
import { campaignSaveStatus } from "../../src/features/brochure/campaignSaveStatus";
import {
  getCampaigns,
  retryCampaignSave,
  saveCampaign,
} from "../../src/features/brochure/teamStorage";
import type { Campaign } from "../../src/domain/models";

const owner = {
  id: "editor-a",
  organizationId: "11111111-1111-4111-8111-111111111111",
};
const original: Campaign = {
  id: "save-recovery",
  name: "Saved",
  products: [],
  version: 2,
};
const edited: Campaign = { ...original, name: "My edits" };
const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
beforeEach(() => {
  vi.useFakeTimers();
  setCampaignSaveOwner(null, true);
  sessionStorage.clear();
  setCampaignSaveOwner(owner);
});
afterEach(() => {
  setCampaignSaveOwner(null, true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("brochure save recovery without provider calls", () => {
  test("keeps a rejected draft across list refresh and tab reload, then explicitly retries with readback", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "Invalid request." }, 400));
    vi.stubGlobal("fetch", fetch);
    const failed = saveCampaign(edited).catch((error) => error);
    await vi.advanceTimersByTimeAsync(300);
    expect((await failed).status).toBe(400);
    expect(campaignDraft(edited.id)?.latest.name).toBe("My edits");
    expect(Object.keys(sessionStorage)).toHaveLength(1);
    fetch.mockResolvedValueOnce(json({ campaigns: [original] }));
    expect((await getCampaigns())[0]?.name).toBe("My edits");
    setCampaignSaveOwner(null);
    setCampaignSaveOwner(owner);
    expect(campaignSaveStatus(edited.id).state).toBe("error");
    fetch
      .mockResolvedValueOnce(json({ campaign: original }))
      .mockResolvedValueOnce(json({ campaign: { ...edited, version: 3 } }));
    const saved = retryCampaignSave(edited.id);
    await vi.advanceTimersByTimeAsync(300);
    expect((await saved).version).toBe(3);
    expect(fetch.mock.calls.at(-2)?.[1]?.method).toBe("GET");
    expect(fetch.mock.calls.at(-1)?.[1]?.method).toBe("POST");
    expect(campaignSaveStatus(edited.id).state).toBe("saved");
    expect(campaignDraft(edited.id)).toBeUndefined();
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  test("honors rate cooldown and only repeats the write after unchanged-version readback", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(
          {
            error: "Too many requests.",
            code: "API_RATE_LIMITED",
            retryAfterSeconds: 3,
          },
          429,
          { "Retry-After": "5" },
        ),
      )
      .mockResolvedValueOnce(json({ campaign: original }))
      .mockResolvedValueOnce(json({ campaign: { ...edited, version: 3 } }));
    vi.stubGlobal("fetch", fetch);
    const pending = saveCampaign(edited);
    await vi.advanceTimersByTimeAsync(300);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(campaignSaveStatus(edited.id).retryAt).toBe(Date.now() + 5000);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).version).toBe(3);
    expect(fetch.mock.calls.map((call) => call[1].method)).toEqual([
      "POST",
      "GET",
      "POST",
    ]);
  });

  test("acknowledges a committed write after a lost response without repeating it", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Connection lost"))
      .mockResolvedValueOnce(json({ campaign: { ...edited, version: 3 } }));
    vi.stubGlobal("fetch", fetch);
    const pending = saveCampaign(edited);
    await vi.advanceTimersByTimeAsync(2300);
    expect((await pending).version).toBe(3);
    expect(fetch.mock.calls.map((call) => call[1].method)).toEqual([
      "POST",
      "GET",
    ]);
    expect(campaignSaveStatus(edited.id).state).toBe("saved");
  });

  test("never overwrites another editor after an uncertain response; conflicts survive reload", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Connection lost"))
      .mockResolvedValueOnce(
        json({ campaign: { ...original, name: "Other editor", version: 3 } }),
      );
    vi.stubGlobal("fetch", fetch);
    const pending = saveCampaign(edited).catch((error) => error);
    await vi.advanceTimersByTimeAsync(2300);
    expect((await pending).code).toBe("VERSION_CONFLICT");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(campaignSaveStatus(edited.id).state).toBe("conflict");
    setCampaignSaveOwner(null);
    setCampaignSaveOwner(owner);
    expect(campaignSaveStatus(edited.id).state).toBe("conflict");
    expect(campaignDraft(edited.id)?.latest.name).toBe("My edits");
  });

  test("coalesces newer edits while retrying and preserves the latest snapshot on a terminal failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "Backend error" }, 500))
      .mockResolvedValueOnce(json({ campaign: original }))
      .mockResolvedValueOnce(json({ error: "Invalid request." }, 400));
    vi.stubGlobal("fetch", fetch);
    const pending = saveCampaign(edited).catch((error) => error);
    await vi.advanceTimersByTimeAsync(300);
    const latest = { ...edited, name: "Newest edits" };
    const coalesced = saveCampaign(latest).catch((error) => error);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await pending).status).toBe(400);
    await coalesced;
    expect(JSON.parse(fetch.mock.calls.at(-1)?.[1]?.body).campaign.name).toBe(
      "Newest edits",
    );
    expect(campaignDraft(edited.id)?.latest.name).toBe("Newest edits");
  });

  test("isolates drafts by user/organization and cancels queued writes on owner change", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const pending = saveCampaign(edited).catch((error) => error);
    setCampaignSaveOwner({ ...owner, id: "editor-b" });
    await vi.advanceTimersByTimeAsync(300);
    await pending;
    expect(fetch).not.toHaveBeenCalled();
    expect(campaignDraft(edited.id)).toBeUndefined();
    expect(campaignSaveStatus(edited.id).state).toBe("saved");
    setCampaignSaveOwner(owner);
    expect(campaignDraft(edited.id)?.latest.name).toBe("My edits");
    setCampaignSaveOwner(null, true);
    setCampaignSaveOwner(owner);
    expect(campaignDraft(edited.id)).toBeUndefined();
  });

  test("keeps recovery content when another editor disables the brochure without restoring access", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "Invalid request." }, 400));
    vi.stubGlobal("fetch", fetch);
    const failed = saveCampaign(edited).catch((error) => error);
    await vi.advanceTimersByTimeAsync(300);
    await failed;
    const disabled = {
      ...original,
      version: 3,
      disabledAt: "2026-11-05T10:00:00Z",
    };
    fetch.mockResolvedValueOnce(json({ campaigns: [disabled] }));
    const list = await getCampaigns();
    expect(list[0]?.disabledAt).toBe(disabled.disabledAt);
    expect(campaignDraft(edited.id)?.latest.name).toBe("My edits");
    expect(campaignSaveStatus(edited.id).state).toBe("conflict");
    expect(Object.keys(sessionStorage)).toHaveLength(1);
  });

  test("parses Retry-After HTTP dates without dropping the API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({ error: "Busy", code: "BODY_CAPACITY" }, 429, {
          "Retry-After": new Date(Date.now() + 7000).toUTCString(),
        }),
      ),
    );
    const failure = await request("/api/test", z.object({})).catch(
      (error) => error,
    );
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.code).toBe("BODY_CAPACITY");
    expect(failure.retryAfterSeconds).toBeGreaterThanOrEqual(6);
    expect(failure.retryAfterSeconds).toBeLessThanOrEqual(7);
  });
});

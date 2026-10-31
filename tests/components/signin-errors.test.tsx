import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { SignIn } from "../../src/features/auth/SignIn";
import { ApiError } from "../../src/api/client";
import { authErrorMessage } from "../../src/features/auth/authErrors";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows a failed initial connection as a localized error, never a green success notice or raw fetch error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  const view = render(<App />);
  const error = await view.findByRole("alert");
  expect(error.classList.contains("error")).toBe(true);
  expect(error.textContent).toBe(
    "We couldn’t connect to Neptun. Check your connection and try again.",
  );
  expect(view.queryByText("Failed to fetch")).toBeNull();
  expect(view.container.querySelector(".na-alert.success")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Shqip" }));
  expect(error.textContent).toBe(
    "Nuk u lidhëm dot me Neptun. Kontrolloni lidhjen dhe provoni përsëri.",
  );
  expect(
    view.getByRole("heading", { name: "Mirë se vini në hapësirën tuaj." }),
  ).toBeTruthy();
  expect(document.documentElement.lang).toBe("sq");
});

it("keeps typed credentials after a failed sign-in and lets the user retry without a browser dialog", async () => {
  const api = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Load failed"))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Incorrect email or password." }), {
        status: 401,
      }),
    );
  vi.stubGlobal("fetch", api);
  const signedIn = vi.fn();
  const view = render(<SignIn onSignIn={signedIn} />);
  fireEvent.change(view.getByLabelText("Email"), {
    target: { value: "staff@example.test" },
  });
  fireEvent.change(view.getByLabelText("Password"), {
    target: { value: "Typed password" },
  });
  fireEvent.click(view.getByRole("button", { name: "Sign in to studio →" }));
  await view.findByText(
    "We couldn’t connect to Neptun. Check your connection and try again.",
  );
  expect((view.getByLabelText("Email") as HTMLInputElement).value).toBe(
    "staff@example.test",
  );
  expect((view.getByLabelText("Password") as HTMLInputElement).value).toBe(
    "Typed password",
  );
  fireEvent.click(view.getByRole("button", { name: "Sign in to studio →" }));
  await view.findByText("Incorrect email or password.");
  expect(api).toHaveBeenCalledTimes(2);
  expect(signedIn).not.toHaveBeenCalled();
});

it("maps transport, service and throttling errors without exposing internal backend messages", () => {
  expect(authErrorMessage(new ApiError("database password secret", 500))).toBe(
    "Neptun is temporarily unavailable. Please try again shortly.",
  );
  expect(authErrorMessage(new ApiError("rate limiter table", 429))).toContain(
    "Too many attempts",
  );
  expect(
    authErrorMessage(new ApiError("timeout", 408, "REQUEST_TIMEOUT")),
  ).toContain("longer than expected");
  expect(authErrorMessage(new Error("raw internal problem"))).toBe(
    "Could not complete this request. Please try again.",
  );
});

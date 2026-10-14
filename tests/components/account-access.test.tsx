import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountAccess } from "../../src/features/auth/AccountAccess";
import { PasswordChange } from "../../src/features/auth/PasswordChange";
import { SignIn } from "../../src/features/auth/SignIn";
import { accountLinkToken } from "../../src/app/App";

const token = "a-secure-single-use-token";
const account = {
  purpose: "invite",
  email: "staff@example.test",
  name: "Test Staff",
  expiresAt: "2026-10-14T12:00:00Z",
  codeSent: false,
};
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("invitation-only account access", () => {
  it("sets a password, verifies the emailed code, and only then offers sign in", async () => {
    const calls: { path: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), "http://localhost").pathname;
        calls.push({
          path,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        if (path === "/api/team/account-token") return response(account);
        if (path === "/api/team/accept-invitation")
          return response({ codeSent: true });
        if (path === "/api/team/verify-invitation")
          return response({ activated: true, signInRequired: true });
        return response({}, 404);
      }),
    );
    const completed = vi.fn();
    const view = render(<AccountAccess token={token} onComplete={completed} />);
    await view.findByRole("heading", { name: "Join your team" });
    await view.findByLabelText("New password");
    fireEvent.change(view.getByLabelText("New password"), {
      target: { value: "A long test phrase!" },
    });
    fireEvent.change(view.getByLabelText("Confirm new password"), {
      target: { value: "A long test phrase!" },
    });
    fireEvent.click(
      view.getByRole("button", { name: "Set password and send code" }),
    );
    const code = await view.findByLabelText(/Verification code/);
    expect(
      calls.find((call) => call.path.endsWith("accept-invitation"))?.body,
    ).toEqual({ token, password: "A long test phrase!" });
    expect(view.queryByLabelText("New password")).toBeNull();
    expect(completed).not.toHaveBeenCalled();
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(
      view.getByRole("button", { name: "Verify email and activate account" }),
    );
    await view.findByRole("heading", { name: "Welcome to your team" });
    expect(
      calls.find((call) => call.path.endsWith("verify-invitation"))?.body,
    ).toEqual({ token, code: "123456" });
    fireEvent.click(
      view.getByRole("button", { name: "Continue to sign in →" }),
    );
    expect(completed).toHaveBeenCalledWith(
      "Your account is ready. Sign in with your new password.",
    );
  });

  it("validates matching passwords before requesting a verification code", async () => {
    const api = vi.fn(async () => response(account));
    vi.stubGlobal("fetch", api);
    const view = render(<AccountAccess token={token} onComplete={vi.fn()} />);
    await view.findByLabelText("New password");
    fireEvent.change(view.getByLabelText("New password"), {
      target: { value: "A long test phrase!" },
    });
    fireEvent.change(view.getByLabelText("Confirm new password"), {
      target: { value: "A different test phrase!" },
    });
    fireEvent.click(
      view.getByRole("button", { name: "Set password and send code" }),
    );
    expect(view.getByRole("alert").textContent).toContain("do not match");
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("requests a reset code separately and submits it with the secure token", async () => {
    const calls: { path: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), "http://localhost").pathname;
        calls.push({
          path,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        if (path.endsWith("account-token"))
          return response({ ...account, purpose: "password-reset" });
        if (path.endsWith("request-reset-code"))
          return response({ codeSent: true });
        if (path.endsWith("reset-password"))
          return response({ changed: true, signInRequired: true });
        return response({}, 404);
      }),
    );
    const view = render(<AccountAccess token={token} onComplete={vi.fn()} />);
    fireEvent.click(
      await view.findByRole("button", { name: "Send verification code" }),
    );
    await view.findByLabelText("New password");
    fireEvent.change(view.getByLabelText("New password"), {
      target: { value: "A new long test phrase!" },
    });
    fireEvent.change(view.getByLabelText("Confirm new password"), {
      target: { value: "A new long test phrase!" },
    });
    fireEvent.change(view.getByLabelText(/Verification code/), {
      target: { value: "654321" },
    });
    fireEvent.click(view.getByRole("button", { name: "Reset password" }));
    await view.findByRole("heading", { name: "Password updated" });
    expect(
      calls.find((call) => call.path.endsWith("reset-password"))?.body,
    ).toEqual({ token, code: "654321", password: "A new long test phrase!" });
  });

  it("shows expired-link recovery without exposing an editable account email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ error: "This link has expired." }, 410)),
    );
    const view = render(<AccountAccess token={token} onComplete={vi.fn()} />);
    expect((await view.findByRole("alert")).textContent).toContain("expired");
    expect(view.queryByRole("textbox")).toBeNull();
    expect(view.getByRole("button", { name: "Back to sign in" })).toBeTruthy();
  });

  it("recognizes only dedicated public account routes", () => {
    expect(
      accountLinkToken({
        pathname: "/account/invitation",
        search: "?token=abc",
      }),
    ).toBe("abc");
    expect(
      accountLinkToken({
        pathname: "/account/reset-password",
        search: "?token=abc",
      }),
    ).toBe("abc");
    expect(
      accountLinkToken({ pathname: "/", search: "?token=abc" }),
    ).toBeNull();
    expect(
      accountLinkToken({ pathname: "/account/invitation", search: "" }),
    ).toBe("");
  });
});

it("requires the old password for a signed-in password change and reports queued notification", async () => {
  const api = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    response({
      changed: true,
      signInRequired: true,
      notificationEmail: "queued",
    }),
  );
  vi.stubGlobal("fetch", api);
  const changed = vi.fn();
  const view = render(<PasswordChange onChanged={changed} />);
  fireEvent.change(view.getByLabelText("Current password"), {
    target: { value: "Existing password" },
  });
  fireEvent.change(view.getByLabelText("New password"), {
    target: { value: "A replacement phrase!" },
  });
  fireEvent.change(view.getByLabelText("Confirm new password"), {
    target: { value: "A replacement phrase!" },
  });
  fireEvent.click(view.getByRole("button", { name: "Update password" }));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  expect(JSON.parse(String(api.mock.calls[0]?.[1]?.body))).toEqual({
    currentPassword: "Existing password",
    password: "A replacement phrase!",
  });
  expect(changed.mock.calls[0]?.[1]).toBe(true);
  expect(changed.mock.calls[0]?.[0]).toContain("security notice");
});

it("provides forgot-password email recovery with a neutral response and no signup", async () => {
  const api = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    response({ message: "If eligible, an email will be sent." }),
  );
  vi.stubGlobal("fetch", api);
  const view = render(<SignIn onSignIn={vi.fn()} />);
  fireEvent.click(view.getByRole("button", { name: "Forgot password?" }));
  fireEvent.change(view.getByLabelText("Email"), {
    target: { value: "unknown@example.test" },
  });
  fireEvent.click(view.getByRole("button", { name: "Send secure reset link" }));
  await view.findByText("Check your email");
  expect(view.getByRole("status").textContent).toContain(
    "If your account is eligible",
  );
  expect(String(api.mock.calls[0]?.[0])).toContain("/api/team/forgot-password");
  expect(view.queryByRole("link", { name: /sign up/i })).toBeNull();
});

it("resends an invitation verification code without reusing the password", async () => {
  const api = vi.fn(async (input: RequestInfo | URL) =>
    String(input).includes("account-token")
      ? response({ ...account, codeSent: true })
      : response({ codeSent: true }),
  );
  vi.stubGlobal("fetch", api);
  const view = render(<AccountAccess token={token} onComplete={vi.fn()} />);
  fireEvent.click(
    await view.findByRole("button", { name: "Send a new verification code" }),
  );
  await view.findByText(/A new verification code is on its way/);
  expect(
    api.mock.calls.some(([input]) =>
      String(input).includes("/api/team/request-invitation-code"),
    ),
  ).toBe(true);
  expect(view.queryByLabelText("New password")).toBeNull();
});

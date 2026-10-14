import { useEffect, useState } from "react";
import Studio from "../features/studio/Studio";
import { getSession } from "../features/auth/auth.api";
import type { User } from "../features/auth/auth.api";
import { SignIn } from "../features/auth/SignIn";
import { AccountAccess } from "../features/auth/AccountAccess";
import { AccountFrame } from "../features/auth/AccountFrame";
import { PasswordChange } from "../features/auth/PasswordChange";

export function accountLinkToken(
  location: Pick<Location, "pathname" | "search">,
): string | null {
  if (
    !/^\/(?:account\/(?:invitation|reset-password)|accept-invitation|reset-password)\/?$/.test(
      location.pathname,
    )
  )
    return null;
  return new URLSearchParams(location.search).get("token") || "";
}
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [accountToken, setAccountToken] = useState(() =>
    accountLinkToken(window.location),
  );
  useEffect(() => {
    if (accountToken !== null) {
      setReady(true);
      return;
    }
    const controller = new AbortController();
    void getSession()
      .then((result) => {
        if (!controller.signal.aborted) setUser(result.user);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load your session.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, [accountToken]);
  function authChange(next: User | null, notice = "") {
    setUser(next);
    setMessage(notice);
  }
  if (accountToken !== null)
    return (
      <AccountAccess
        token={accountToken}
        onComplete={(notice) => {
          window.history.replaceState({}, "", "/");
          setAccountToken(null);
          setUser(null);
          setMessage(notice);
        }}
      />
    );
  if (!ready)
    return (
      <AccountFrame>
        <p role="status">Checking session…</p>
      </AccountFrame>
    );
  if (!user)
    return <SignIn onSignIn={(next) => authChange(next)} notice={message} />;
  if (user.mustChangePassword)
    return (
      <AccountFrame>
        <span className="cs-eyebrow">ACCOUNT SECURITY</span>
        <h1>Update your password</h1>
        <p>Choose your own password before continuing to the workspace.</p>
        <div className="na-account-identity">
          <strong>{user.name || "Your account"}</strong>
          <span>{user.email}</span>
        </div>
        <PasswordChange
          onChanged={(notice, signInRequired) => {
            if (signInRequired) authChange(null, notice);
            else setUser({ ...user, mustChangePassword: false });
          }}
        />
      </AccountFrame>
    );
  return <Studio initialUser={user} onAuthChange={authChange} />;
}

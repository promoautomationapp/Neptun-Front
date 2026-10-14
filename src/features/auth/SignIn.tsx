import { useState } from "react";
import { login } from "./auth.api";
import { forgotPassword } from "../../api/users";
import { resolveAsset } from "../../api/client";
import "../../styles/review.css";
import "../../styles/account-management.css";
import type { User } from "./auth.api";
import { PromoAutomationCredit } from "../../shared/PromoAutomationCredit";

export function SignIn({
  onSignIn,
  notice = "",
}: {
  onSignIn: (user: User) => void;
  notice?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="cs-signin">
      <div className="cs-signin-art">
        <img src={resolveAsset("/api/assets/app/logo")} alt="NEPTUN" />
        <div>
          <span className="cs-eyebrow">NEPTUN KOSOVO · CAMPAIGN STUDIO</span>
          <h1>
            Every offer has
            <br />
            <em>a story to tell.</em>
          </h1>
          <p>From product data to a brochure ready to share.</p>
        </div>
      </div>
      <div className="cs-signin-panel">
        <span className="cs-eyebrow">NEPTUN KOSOVO</span>
        <h2>
          {recovery ? (
            "Forgot your password?"
          ) : (
            <>
              Welcome to
              <br />
              your workspace.
            </>
          )}
        </h2>
        <p>
          {recovery
            ? "Enter your work email. If your account is eligible, we will email a secure link to reset your password."
            : "Sign in to create brochures, manage campaigns, and review your team’s work."}
        </p>
        {notice && !recovery && (
          <p className="na-alert success" role="status">
            {notice}
          </p>
        )}
        {sent ? (
          <div className="na-recovery-confirmation" role="status">
            <strong>Check your email</strong>
            <p>
              If your account is eligible, a reset link is on its way. Check
              your inbox and spam folder, then follow the link and verify the
              code.
            </p>
          </div>
        ) : (
          <form
            className="cs-team-login"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              const action = recovery
                ? forgotPassword(email).then(() => setSent(true))
                : login(email, password).then((result) => {
                    setPassword("");
                    onSignIn(result.user);
                  });
              void action
                .catch((reason: unknown) =>
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Could not complete this request.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                disabled={busy}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@neptun-ks.com"
              />
            </label>
            {!recovery && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            {error && (
              <p className="cs-team-auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="cs-button primary" type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : recovery
                  ? "Send secure reset link"
                  : "Sign in to studio →"}
            </button>
          </form>
        )}
        <button
          className="na-text-button"
          type="button"
          disabled={busy}
          onClick={() => {
            setRecovery((value) => !value);
            setSent(false);
            setError("");
            setPassword("");
          }}
        >
          {recovery ? "← Back to sign in" : "Forgot password?"}
        </button>
        <small>
          {recovery
            ? "Reset links expire after 30 minutes."
            : "Access is by invitation. Contact your team admin if you need an account."}
        </small>
        <PromoAutomationCredit />
      </div>
    </div>
  );
}

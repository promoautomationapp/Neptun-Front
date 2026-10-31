import { useState } from "react";
import { login } from "./auth.api";
import { forgotPassword } from "../../api/users";
import "../../styles/review.css";
import "../../styles/account-management.css";
import type { User } from "./auth.api";
import { PromoAutomationCredit } from "../../shared/PromoAutomationCredit";
import { t } from "../brochure/i18n";
import { AuthPreferences, useAuthLanguage } from "./AuthPreferences";
import { authErrorMessage } from "./authErrors";
import "./auth-screen.css";

export function SignIn({
  onSignIn,
  notice = "",
  connectionError = "",
}: {
  onSignIn: (user: User) => void;
  notice?: string;
  connectionError?: string;
}) {
  useAuthLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="cs-signin cs-auth-screen">
      <div className="cs-signin-art">
        <div className="cs-auth-brand">
          <img src="/branding/neptun-logo.png" alt="NEPTUN" />
          <span>{t("Campaign workspace")}</span>
        </div>
        <div className="cs-signin-art-copy">
          <span className="cs-eyebrow">
            {t("NEPTUN KOSOVO · CAMPAIGN STUDIO")}
          </span>
          <h1>{t("Every offer has a story to tell.")}</h1>
          <p>{t("From product data to a brochure ready to share.")}</p>
        </div>
      </div>
      <div className="cs-signin-panel">
        <AuthPreferences />
        <main className="cs-auth-form-content">
          <span className="cs-eyebrow">{t("NEPTUN KOSOVO")}</span>
          <h2>
            {t(
              recovery ? "Forgot your password?" : "Welcome to your workspace.",
            )}
          </h2>
          <p>
            {t(
              recovery
                ? "Enter your work email. If your account is eligible, we will email a secure link to reset your password."
                : "Sign in to create brochures, manage campaigns, and review your team’s work.",
            )}
          </p>
          {notice && !recovery && (
            <p className="na-alert success" role="status">
              {t(notice)}
            </p>
          )}
          {connectionError && !error && !recovery && (
            <p className="na-alert error cs-auth-message" role="alert">
              {t(connectionError)}
            </p>
          )}
          {sent ? (
            <div className="na-recovery-confirmation" role="status">
              <strong>{t("Check your email")}</strong>
              <p>
                {t(
                  "If your account is eligible, a reset link is on its way. Check your inbox and spam folder, then follow the link and verify the code.",
                )}
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
                    setError(authErrorMessage(reason)),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <label>
                {t("Email")}
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
                  {t("Password")}
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
                <p className="na-alert error cs-auth-message" role="alert">
                  {t(error)}
                </p>
              )}
              <button
                className="cs-button primary"
                type="submit"
                disabled={busy}
              >
                {t(
                  busy
                    ? "Please wait…"
                    : recovery
                      ? "Send secure reset link"
                      : "Sign in to studio →",
                )}
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
            {t(recovery ? "← Back to sign in" : "Forgot password?")}
          </button>
          <small>
            {t(
              recovery
                ? "Reset links expire after 30 minutes."
                : "Access is by invitation. Contact your team admin if you need an account.",
            )}
          </small>
          <PromoAutomationCredit />
        </main>
      </div>
    </div>
  );
}

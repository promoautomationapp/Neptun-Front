import { useEffect, useState } from "react";
import type { z } from "zod";
import type { accountTokenSchema } from "../../api/users";
import {
  acceptInvitation,
  getAccountToken,
  requestResetCode,
  requestInvitationCode,
  resetPassword,
  verifyInvitation,
} from "../../api/users";
import { AccountFrame, PasswordFields } from "./AccountFrame";

type AccountToken = z.infer<typeof accountTokenSchema>;
const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Could not complete this request. Please try again.";

export function AccountAccess({
  token,
  onComplete,
}: {
  token: string;
  onComplete: (message: string) => void;
}) {
  const [account, setAccount] = useState<AccountToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void getAccountToken(token, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setAccount(result);
        setCodeSent(result.codeSent);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token]);
  const invitation = account?.purpose === "invite";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!account || busy) return;
    setError("");
    setNotice("");
    if ((invitation && !codeSent) || !invitation) {
      if (password.length < 12) {
        setError("Choose a password with at least 12 characters.");
        return;
      }
      if (password !== confirm) {
        setError("The two passwords do not match.");
        return;
      }
    }
    setBusy(true);
    try {
      if (invitation && !codeSent) {
        await acceptInvitation(token, password);
        setPassword("");
        setConfirm("");
        setCodeSent(true);
        setNotice(
          "A verification code is on its way to your email. Enter it below to finish joining your team.",
        );
      } else if (invitation) {
        await verifyInvitation(token, code);
        setComplete(true);
      } else {
        await resetPassword(token, code, password);
        setPassword("");
        setConfirm("");
        setComplete(true);
      }
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  async function sendVerificationCode() {
    setBusy(true);
    setError("");
    try {
      if (invitation) await requestInvitationCode(token);
      else await requestResetCode(token);
      setCodeSent(true);
      setNotice(
        "A new verification code is on its way. Use the most recent code in your email.",
      );
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountFrame>
      <span className="cs-eyebrow">SECURE ACCOUNT ACCESS</span>
      <h1>
        {complete
          ? invitation
            ? "Welcome to your team"
            : "Password updated"
          : invitation
            ? "Join your team"
            : "Reset your password"}
      </h1>
      {loading ? (
        <p role="status">Checking your secure link…</p>
      ) : complete ? (
        <>
          <p>
            {invitation
              ? "Your email is verified and your account is ready."
              : "Your password has been changed. A security notice will be sent to your email."}
          </p>
          <button
            className="cs-button primary"
            type="button"
            onClick={() =>
              onComplete(
                invitation
                  ? "Your account is ready. Sign in with your new password."
                  : "Password updated. Sign in with your new password.",
              )
            }
          >
            Continue to sign in →
          </button>
        </>
      ) : !account ? (
        <>
          <p role="alert" className="na-alert error">
            {error || "This link is invalid or has expired."}
          </p>
          <p>
            For an invitation, ask your team admin to send a fresh link. For a
            password reset, request a new reset email.
          </p>
          <button
            className="cs-button"
            type="button"
            onClick={() => onComplete("")}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <p>
            {invitation
              ? "Set your password, then verify your email to activate your invitation."
              : "Verify your email and choose a new password to regain access."}
          </p>
          <div className="na-account-identity">
            <strong>{account.name || "Your account"}</strong>
            <span>{account.email}</span>
          </div>
          {notice && (
            <p className="na-alert success" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="na-alert error" role="alert">
              {error}
            </p>
          )}
          {!invitation && !codeSent ? (
            <>
              <p>
                We will send a verification code to the email linked to this
                secure reset request.
              </p>
              <button
                className="cs-button primary"
                type="button"
                disabled={busy}
                onClick={() => void sendVerificationCode()}
              >
                {busy ? "Sending code…" : "Send verification code"}
              </button>
            </>
          ) : (
            <form className="na-form" onSubmit={(event) => void submit(event)}>
              {(!invitation || !codeSent) && (
                <PasswordFields
                  password={password}
                  confirm={confirm}
                  onPassword={setPassword}
                  onConfirm={setConfirm}
                  disabled={busy}
                />
              )}
              {codeSent && (
                <label>
                  Verification code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                    disabled={busy}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                    placeholder="6-digit code"
                  />
                  <small className="na-field-help">
                    Codes expire after 10 minutes. Check your inbox and spam
                    folder.
                  </small>
                </label>
              )}
              <button
                className="cs-button primary"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Please wait…"
                  : invitation
                    ? codeSent
                      ? "Verify email and activate account"
                      : "Set password and send code"
                    : "Reset password"}
              </button>
              {codeSent && (
                <button
                  className="na-text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void sendVerificationCode()}
                >
                  Send a new verification code
                </button>
              )}
            </form>
          )}
        </>
      )}
    </AccountFrame>
  );
}

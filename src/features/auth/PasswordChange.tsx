import { useState } from "react";
import { changePassword } from "./auth.api";
import { PasswordFields } from "./AccountFrame";

export function PasswordChange({
  onChanged,
}: {
  onChanged: (message: string, signInRequired: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    if (password.length < 12) {
      setError("Choose a password with at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await changePassword(currentPassword, password);
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      const message =
        result.notificationEmail === "unavailable"
          ? "Password changed. Email delivery is unavailable; please contact your admin. Sign in with your new password."
          : "Password changed. A security notice will be sent to your email. Sign in with your new password.";
      setNotice(message);
      onChanged(message, result.signInRequired);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not change your password.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="na-form" onSubmit={(event) => void submit(event)}>
      <label>
        Current password
        <input
          type="password"
          autoComplete="current-password"
          required
          disabled={busy}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </label>
      <PasswordFields
        password={password}
        confirm={confirm}
        onPassword={setPassword}
        onConfirm={setConfirm}
        disabled={busy}
      />
      {error && (
        <p className="na-alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="na-alert success" role="status">
          {notice}
        </p>
      )}
      <button className="cs-button primary" type="submit" disabled={busy}>
        {busy ? "Updating password…" : "Update password"}
      </button>
      <small className="na-field-help">
        You will be asked to sign in again after changing your password.
      </small>
    </form>
  );
}

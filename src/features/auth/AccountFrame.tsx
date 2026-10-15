import type { ReactNode } from "react";
import "../../styles/account-management.css";
import { PromoAutomationCredit } from "../../shared/PromoAutomationCredit";

export function AccountFrame({ children }: { children: ReactNode }) {
  return (
    <div className="na-account-screen">
      <div className="na-account-brand">
        <span className="na-account-wordmark">
          <img src="/branding/neptun-logo.png" alt="NEPTUN" />
        </span>
        <span>Brochure workspace</span>
      </div>
      <main className="na-account-card">{children}</main>
      <p className="na-account-footnote">
        Access to your team workspace is by invitation.
      </p>
      <PromoAutomationCredit />
    </div>
  );
}

export function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  disabled = false,
}: {
  password: string;
  confirm: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <label>
        New password
        <input
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          disabled={disabled}
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          aria-describedby="password-guidance"
        />
      </label>
      <small id="password-guidance" className="na-field-help">
        Use at least 12 characters. A memorable phrase works well.
      </small>
      <label>
        Confirm new password
        <input
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          disabled={disabled}
          value={confirm}
          onChange={(event) => onConfirm(event.target.value)}
        />
      </label>
    </>
  );
}

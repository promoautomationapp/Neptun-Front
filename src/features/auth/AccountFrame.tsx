import type { ReactNode } from "react";
import "../../styles/account-management.css";
import { PromoAutomationCredit } from "../../shared/PromoAutomationCredit";
import { AuthPreferences, useAuthLanguage } from "./AuthPreferences";
import { t } from "../brochure/i18n";
import "./auth-screen.css";

export function AccountFrame({ children }: { children: ReactNode }) {
  useAuthLanguage();
  return (
    <div className="na-account-screen na-auth-screen">
      <AuthPreferences />
      <div className="na-account-brand">
        <span className="na-account-wordmark">
          <img src="/branding/neptun-logo.png" alt="NEPTUN" />
        </span>
        <span>{t("Brochure workspace")}</span>
      </div>
      <main className="na-account-card">{children}</main>
      <p className="na-account-footnote">
        {t("Access to your team workspace is by invitation.")}
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
  useAuthLanguage();
  return (
    <>
      <label>
        {t("New password")}
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
        {t("Use at least 12 characters. A memorable phrase works well.")}
      </small>
      <label>
        {t("Confirm new password")}
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

import { useState } from "react";
import type { User } from "../auth/auth.api";
import { roleLabel } from "../auth/auth.api";
import { t } from "../brochure/i18n";
import { PromoAutomationCredit } from "../../shared/PromoAutomationCredit";
import "./sidebar-account.css";

export function SidebarAccount({
  user,
  onProfile,
  onSignOut,
}: {
  user: Pick<User, "name" | "email" | "role">;
  onProfile: () => void;
  onSignOut: () => Promise<unknown> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name =
    user.role === "superadmin"
      ? "Promo Automation"
      : user.name.trim() || user.email.split("@")[0] || t("My account");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSignOut();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cs-sidebar-bottom np-sidebar-footer">
      <button
        type="button"
        className="np-account-profile"
        aria-label={t("Open profile & security")}
        title={user.email}
        onClick={onProfile}
      >
        <span className="np-account-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="np-account-label">
          <strong>{name}</strong>
          <span>{t(roleLabel(user.role))}</span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="m8 5 5 5-5 5" />
        </svg>
      </button>
      <button
        type="button"
        className="np-account-logout"
        disabled={busy}
        aria-label={t(busy ? "Signing out…" : "Sign out")}
        title={t("Sign out")}
        onClick={() => void signOut()}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M8 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M7 10h10m-4-4 4 4-4 4" />
        </svg>
        <span className="np-account-logout-label">
          {t(busy ? "Signing out…" : "Sign out")}
        </span>
      </button>
      {failed && (
        <p className="np-account-error" role="alert">
          {t("Could not sign out. Please try again.")}
        </p>
      )}
      <PromoAutomationCredit />
    </div>
  );
}

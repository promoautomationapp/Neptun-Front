import { PasswordChange } from "../auth/PasswordChange";
import { roleLabel } from "../auth/auth.api";
import type { User } from "../auth/auth.api";
import "../../styles/account-management.css";

export function ProfilePage({
  user,
  onPasswordChanged,
}: {
  user: User;
  onPasswordChanged: (message: string, signInRequired: boolean) => void;
}) {
  return (
    <section className="na-profile-page">
      <header className="na-page-heading">
        <div>
          <span className="cs-eyebrow">YOUR ACCOUNT</span>
          <h1>Profile & security</h1>
          <p>Manage your password and keep your work account secure.</p>
        </div>
      </header>
      <div className="na-profile-grid">
        <section className="na-edit-card">
          <h2>Account details</h2>
          <dl className="na-account-details">
            <dt>Name</dt>
            <dd>{user.name || "—"}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Role</dt>
            <dd>{roleLabel(user.role)}</dd>
          </dl>
          <p>Contact your admin to update your account details or role.</p>
          {user.isSupport && (
            <p className="na-alert success">
              This is a support account for helping Neptun’s team.
            </p>
          )}
        </section>
        <section className="na-edit-card">
          <h2>Change password</h2>
          <p>
            Enter your current password and choose a new one. We will send a
            security notice to your email.
          </p>
          <PasswordChange onChanged={onPasswordChanged} />
        </section>
      </div>
    </section>
  );
}

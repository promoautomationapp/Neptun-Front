import { getLanguage, t } from "../brochure/i18n";
import { TeamMemberDialog } from "./TeamMemberDialog";
import { SearchableSelect } from "../../components/SearchableSelect";
import { confirmDialog } from "../../components/dialogs";
import { useEffect, useId, useMemo, useState } from "react";
import {
  inviteUser,
  listUsers,
  resendInvitation,
  updateUser,
} from "../../api/users";
import type { EditableRole, ManagedUser } from "../../api/users";
import { canManageUsers, roleLabel } from "../auth/auth.api";
import type { User } from "../auth/auth.api";
import {
  defaultWorkspaceAccess,
  effectiveWorkspaceAccess,
  type WorkspaceAccess,
} from "../auth/workspaceAccess";
import {
  WorkspaceAccessEditor,
  workspaceAccessError,
} from "./WorkspaceAccessEditor";
import "../../styles/account-management.css";
import { statusTone } from "../../components/statusPresentation";
import "../../components/status-colors.css";

const errorOf = (reason: unknown) =>
  reason instanceof Error
    ? reason.message
    : "Could not update your team. Please try again.";
const roles: { value: EditableRole; label: string; description: string }[] = [
  {
    value: "staff",
    label: "Staff",
    description: "Create and edit campaigns and brochures.",
  },
  {
    value: "pm",
    label: "PM",
    description: "Review campaigns, add feedback, and approve work.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Manage users, settings, and all campaigns.",
  },
];
function lastSeen(value?: string | null) {
  if (!value) return "Not signed in yet";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : date.toLocaleString(getLanguage() === "sq" ? "sq-AL" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export function UsersPage({
  currentUser,
  onMembersChanged,
}: {
  currentUser: User;
  onMembersChanged?: () => void;
}) {
  const formId = useId();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("current");
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<EditableRole>("staff");
  const [inviteAccess, setInviteAccess] = useState<WorkspaceAccess>(
    defaultWorkspaceAccess,
  );
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<EditableRole>("staff");
  const [editAccess, setEditAccess] = useState<WorkspaceAccess>(
    defaultWorkspaceAccess,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!canManageUsers(currentUser)) return;
    const controller = new AbortController();
    setError("");
    void listUsers(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setUsers(
          currentUser.role === "superadmin"
            ? result.users
            : result.users.filter(
                (user) =>
                  !user.isSupport &&
                  user.role !== "superadmin" &&
                  user.status !== "disabled",
              ),
        );
        setEmailConfigured(result.emailConfigured);
        setLoaded(true);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(errorOf(reason));
          setLoaded(true);
        }
      });
    return () => controller.abort();
  }, [currentUser.id, currentUser.role, revision]);
  const matches = useMemo(
    () =>
      users.filter(
        (user) =>
          (!query ||
            (user.name + " " + user.email)
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (role === "all" || user.role === role) &&
          (status === "all" ||
            (status === "current"
              ? user.status !== "disabled"
              : user.status === status)),
      ),
    [users, query, role, status],
  );
  if (!canManageUsers(currentUser))
    return (
      <section className="na-users-page">
        <h1>{t("Team access")}</h1>
        <p>
          {t("Only admins can manage users. Contact your team admin for help.")}
        </p>
      </section>
    );
  function replaceUser(user: ManagedUser) {
    setUsers((current) =>
      currentUser.role !== "superadmin" &&
      (user.isSupport ||
        user.role === "superadmin" ||
        user.status === "disabled")
        ? current.filter((item) => item.id !== user.id)
        : current.some((item) => item.id === user.id)
          ? current.map((item) => (item.id === user.id ? user : item))
          : [...current, user],
    );
    onMembersChanged?.();
  }
  async function perform(
    key: string,
    action: () => Promise<{ user: ManagedUser }>,
    success: string,
    done?: () => void,
  ) {
    if (busy) return;
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const result = await action();
      replaceUser(result.user);
      setNotice(success);
      done?.();
    } catch (reason) {
      setError(errorOf(reason));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="na-users-page">
      <header className="na-page-heading">
        <div>
          <span className="cs-eyebrow">{t("TEAM & ACCESS")}</span>
          <h1>{t("Manage your team")}</h1>
          <p>
            {t(
              "Invite Neptun admins, staff, and PMs to the brochure workspace. Existing accounts keep their current password access.",
            )}
          </p>
        </div>
        <button
          className="cs-button primary"
          type="button"
          disabled={!loaded || !emailConfigured || !!busy}
          onClick={() => {
            setInviting(true);
            setEditing(null);
            setError("");
          }}
        >
          {t("＋ Invite a user")}
        </button>
      </header>
      <div className="na-team-summary">
        <div>
          <strong>
            {users.filter((user) => user.status === "active").length}
          </strong>
          <span>{t("Active users")}</span>
        </div>
        <div>
          <strong>
            {users.filter((user) => user.status === "invited").length}
          </strong>
          <span>{t("Pending invitations")}</span>
        </div>
        <div>
          <strong>
            {
              users.filter((user) =>
                currentUser.role === "superadmin"
                  ? user.isSupport
                  : user.role === "admin",
              ).length
            }
          </strong>
          <span>
            {t(
              currentUser.role === "superadmin"
                ? "Support superadmins"
                : "Administrators",
            )}
          </span>
        </div>
      </div>
      {!emailConfigured && loaded && (
        <p className="na-alert warning" role="status">
          {t(
            "New invitations are unavailable until email delivery is connected. Existing accounts can still sign in with their current passwords; they do not need another email verification.",
          )}
        </p>
      )}
      {error && !inviting && !editing && (
        <p className="na-alert error" role="alert">
          {t(error)}
        </p>
      )}
      {notice && (
        <p className="na-alert success" role="status">
          {t(notice)}
        </p>
      )}
      {inviting && (
        <TeamMemberDialog
          title={t("Invite a colleague")}
          busy={!!busy}
          onClose={() => setInviting(false)}
        >
          {error && (
            <p className="na-alert error" role="alert">
              {t(error)}
            </p>
          )}
          <p className="na-member-dialog-description">
            {t(
              "Choose their role and enter a working email address. They receive an invitation, choose their own password, then verify the code sent to that address to activate access. Existing users do not repeat this process.",
            )}
          </p>
          <form
            id={`${formId}-invite`}
            className="na-form na-user-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (workspaceAccessError(inviteAccess)) return;
              void perform(
                "invite",
                () =>
                  inviteUser({
                    email: inviteEmail.trim(),
                    name: inviteName.trim(),
                    role: inviteRole,
                    access:
                      inviteRole === "admin"
                        ? defaultWorkspaceAccess()
                        : inviteAccess,
                  }),
                "Invitation queued for email delivery. They become active after verifying their email.",
                () => {
                  setInviting(false);
                  setInviteEmail("");
                  setInviteName("");
                  setInviteRole("staff");
                  setInviteAccess(defaultWorkspaceAccess());
                },
              );
            }}
          >
            <label>
              {t("Full name")}
              <input
                value={inviteName}
                required
                maxLength={120}
                disabled={!!busy}
                onChange={(event) => setInviteName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              {t("Work email")}
              <input
                type="email"
                value={inviteEmail}
                required
                maxLength={254}
                disabled={!!busy}
                onChange={(event) => setInviteEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              {t("Role")}
              <SearchableSelect
                aria-label={t("Invitation role")}
                value={inviteRole}
                disabled={!!busy}
                onChange={(event) => {
                  const nextRole = event.target.value as EditableRole;
                  setInviteRole(nextRole);
                  if (nextRole === "admin")
                    setInviteAccess(defaultWorkspaceAccess());
                }}
              >
                {roles.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.label)}
                  </option>
                ))}
              </SearchableSelect>
              <small className="na-field-help">
                {t(
                  roles.find((item) => item.value === inviteRole)?.description,
                )}
              </small>
            </label>
            <WorkspaceAccessEditor
              role={inviteRole}
              value={inviteAccess}
              onChange={setInviteAccess}
              disabled={!!busy}
            />
          </form>
          <div className="na-form-actions">
            <button
              className="cs-button"
              type="button"
              disabled={!!busy}
              onClick={() => setInviting(false)}
            >
              {t("Cancel")}
            </button>
            <button
              className="cs-button primary"
              type="submit"
              form={`${formId}-invite`}
              disabled={
                !!busy ||
                !emailConfigured ||
                !!workspaceAccessError(inviteAccess)
              }
            >
              {t(busy === "invite" ? "Sending invitation…" : "Send invitation")}
            </button>
          </div>
        </TeamMemberDialog>
      )}
      {editing && (
        <TeamMemberDialog
          title={t("Edit user")}
          description={editing.email}
          busy={!!busy}
          onClose={() => setEditing(null)}
        >
          {error && (
            <p className="na-alert error" role="alert">
              {t(error)}
            </p>
          )}
          <form
            id={`${formId}-edit`}
            className="na-form na-user-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editing) return;
              if (workspaceAccessError(editAccess)) return;
              void perform(
                editing.id,
                () =>
                  updateUser(editing.id, {
                    name: editName.trim(),
                    access:
                      editRole === "admin"
                        ? defaultWorkspaceAccess()
                        : editAccess,
                    ...(editing.id !== currentUser.id
                      ? { role: editRole }
                      : {}),
                  }),
                editing.status === "invited" && editRole !== editing.role
                  ? "Role updated. The previous invitation expired; use Resend invite to send a new link with the updated role."
                  : "User updated.",
                () => setEditing(null),
              );
            }}
          >
            <label>
              {t("Full name")}
              <input
                value={editName}
                required
                maxLength={120}
                disabled={!!busy}
                onChange={(event) => setEditName(event.target.value)}
              />
            </label>
            <label>
              {t("Role")}
              <SearchableSelect
                aria-label={t("User role")}
                value={editRole}
                disabled={!!busy || editing.id === currentUser.id}
                onChange={(event) => {
                  const nextRole = event.target.value as EditableRole;
                  setEditRole(nextRole);
                  if (nextRole === "admin")
                    setEditAccess(defaultWorkspaceAccess());
                }}
              >
                {roles.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.label)}
                  </option>
                ))}
              </SearchableSelect>
              <small className="na-field-help">
                {t(
                  editing.id === currentUser.id
                    ? "Another admin can change your role."
                    : roles.find((item) => item.value === editRole)
                        ?.description,
                )}
              </small>
            </label>
            <WorkspaceAccessEditor
              key={editing.id}
              role={editRole}
              value={editAccess}
              onChange={setEditAccess}
              disabled={!!busy}
            />
          </form>
          <div className="na-form-actions">
            <button
              className="cs-button"
              type="button"
              disabled={!!busy}
              onClick={() => setEditing(null)}
            >
              {t("Cancel")}
            </button>
            <button
              className="cs-button primary"
              type="submit"
              form={`${formId}-edit`}
              disabled={!!busy || !!workspaceAccessError(editAccess)}
            >
              {t(busy === editing.id ? "Saving…" : "Save user")}
            </button>
          </div>
        </TeamMemberDialog>
      )}
      <div className="na-table-card">
        <div className="na-user-filters">
          <label>
            {t("Find a user")}
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Name or email")}
            />
          </label>
          <label>
            {t("Role")}
            <SearchableSelect
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="all">{t("All roles")}</option>
              {roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(item.label)}
                </option>
              ))}
              {currentUser.role === "superadmin" && (
                <option value="superadmin">{t("Support superadmin")}</option>
              )}
            </SearchableSelect>
          </label>
          <label>
            {t("Status")}
            <SearchableSelect
              value={status}
              searchable={false}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="current">{t("Current team")}</option>
              <option value="all">{t("All statuses")}</option>
              <option value="active">{t("Active")}</option>
              <option value="invited">{t("Invited")}</option>
              {currentUser.role === "superadmin" && (
                <option value="disabled">{t("Disabled")}</option>
              )}
            </SearchableSelect>
          </label>
          <button
            className="cs-button"
            type="button"
            disabled={!!busy}
            onClick={() => setRevision((value) => value + 1)}
          >
            {t("Refresh list")}
          </button>
        </div>
        {!loaded ? (
          <p className="na-empty" role="status">
            {t("Loading your team…")}
          </p>
        ) : (
          <div className="na-table-scroll">
            <table className="na-users-table">
              <caption>
                {matches.length} {t(matches.length === 1 ? "user" : "users")}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t("User")}</th>
                  <th scope="col">{t("Role")}</th>
                  <th scope="col">{t("Status")}</th>
                  <th scope="col">{t("Last sign in")}</th>
                  <th scope="col">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.name || t("Team member")}
                        {user.id === currentUser.id && (
                          <span className="na-you">{t("You")}</span>
                        )}
                      </strong>
                      <span>{user.email}</span>
                      {user.isSupport && (
                        <small>
                          {t("Support account · here to help your team")}
                        </small>
                      )}
                    </td>
                    <td>
                      {t(roleLabel(user.role))}
                      {user.access?.mode === "custom" &&
                        user.role !== "admin" &&
                        user.role !== "superadmin" && (
                          <small className="na-user-access-badge">
                            {t("Custom access")}
                          </small>
                        )}
                    </td>
                    <td>
                      <span
                        className={"na-status ns-status-badge " + user.status}
                        data-status-tone={statusTone(user.status)}
                      >
                        {t(
                          user.status === "invited"
                            ? "Invitation pending"
                            : user.status === "disabled"
                              ? user.emailVerified
                                ? "Disabled"
                                : "Invitation cancelled"
                              : "Active",
                        )}
                      </span>
                    </td>
                    <td>{t(lastSeen(user.lastLoginAt))}</td>
                    <td>
                      {user.isSupport || user.role === "superadmin" ? (
                        <span className="na-protected">
                          {t("Support account")}
                        </span>
                      ) : (
                        <div className="na-row-actions">
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => {
                              setError("");
                              setEditing(user);
                              setEditName(user.name);
                              setEditRole(user.role as EditableRole);
                              setEditAccess(effectiveWorkspaceAccess(user));
                              setInviting(false);
                            }}
                          >
                            {t("Edit")}
                          </button>
                          {(user.status === "invited" ||
                            (user.status === "disabled" &&
                              !user.emailVerified)) && (
                            <button
                              type="button"
                              disabled={!!busy || !emailConfigured}
                              onClick={() =>
                                void perform(
                                  user.id,
                                  () => resendInvitation(user.id),
                                  "A fresh invitation is queued for email delivery.",
                                )
                              }
                            >
                              {t(
                                user.status === "disabled"
                                  ? "Invite again"
                                  : "Resend invite",
                              )}
                            </button>
                          )}
                          {user.id !== currentUser.id &&
                            (user.status !== "disabled" ||
                              user.emailVerified) && (
                              <button
                                type="button"
                                disabled={!!busy}
                                onClick={async () => {
                                  if (
                                    user.status !== "disabled" &&
                                    !(await confirmDialog({
                                      title: t(
                                        user.status === "invited"
                                          ? "Cancel invitation?"
                                          : "Disable user access?",
                                      ),
                                      message:
                                        t(
                                          user.status === "invited"
                                            ? "Cancel the invitation for"
                                            : "Disable access for",
                                        ) +
                                        " " +
                                        user.email +
                                        "? " +
                                        t("Their work will be kept."),
                                      confirmLabel: t(
                                        user.status === "invited"
                                          ? "Cancel invitation"
                                          : "Disable access",
                                      ),
                                      cancelLabel: t("Keep access"),
                                      danger: true,
                                    }))
                                  )
                                    return;
                                  void perform(
                                    user.id,
                                    () =>
                                      updateUser(user.id, {
                                        status:
                                          user.status === "disabled"
                                            ? "active"
                                            : "disabled",
                                      }),
                                    user.status === "disabled"
                                      ? "User access restored."
                                      : user.status === "invited"
                                        ? "Invitation cancelled."
                                        : "User access disabled. Their work is kept.",
                                  );
                                }}
                              >
                                {t(
                                  user.status === "disabled"
                                    ? "Restore access"
                                    : user.status === "invited"
                                      ? "Cancel invitation"
                                      : "Disable",
                                )}
                              </button>
                            )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {matches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="na-empty">
                      {t(
                        users.length
                          ? "No users match these filters."
                          : "No users found. Refresh the list or invite a colleague.",
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {currentUser.role === "superadmin" && (
        <p className="na-support-note">
          {t(
            "Cancelled invitations and disabled users are hidden from the Neptun team. Select Disabled to manage these records as support.",
          )}{" "}
          {t(
            "Support accounts are visible only to Promo Automation superadmins and are managed separately from the Neptun team.",
          )}
        </p>
      )}
    </section>
  );
}

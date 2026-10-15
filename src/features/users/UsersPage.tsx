import { useEffect, useMemo, useState } from "react";
import {
  inviteUser,
  listUsers,
  resendInvitation,
  updateUser,
} from "../../api/users";
import type { EditableRole, ManagedUser } from "../../api/users";
import { canManageUsers, roleLabel } from "../auth/auth.api";
import type { User } from "../auth/auth.api";
import "../../styles/account-management.css";

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
    : date.toLocaleString(undefined, {
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
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<EditableRole>("staff");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<EditableRole>("staff");
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
                (user) => !user.isSupport && user.role !== "superadmin",
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
          (status === "all" || user.status === status),
      ),
    [users, query, role, status],
  );
  if (!canManageUsers(currentUser))
    return (
      <section className="na-users-page">
        <h1>Team access</h1>
        <p>Only admins can manage users. Contact your team admin for help.</p>
      </section>
    );
  function replaceUser(user: ManagedUser) {
    setUsers((current) =>
      current.some((item) => item.id === user.id)
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
          <span className="cs-eyebrow">TEAM & ACCESS</span>
          <h1>Manage your team</h1>
          <p>
            Invite Neptun admins, staff, and PMs to the brochure workspace.
            Existing accounts keep their current password access.
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
          ＋ Invite a user
        </button>
      </header>
      <div className="na-team-summary">
        <div>
          <strong>
            {users.filter((user) => user.status === "active").length}
          </strong>
          <span>Active users</span>
        </div>
        <div>
          <strong>
            {users.filter((user) => user.status === "invited").length}
          </strong>
          <span>Pending invitations</span>
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
            {currentUser.role === "superadmin"
              ? "Support superadmins"
              : "Administrators"}
          </span>
        </div>
      </div>
      {!emailConfigured && loaded && (
        <p className="na-alert warning" role="status">
          New invitations are unavailable until email delivery is connected.
          Existing accounts can still sign in with their current passwords; they
          do not need another email verification.
        </p>
      )}
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
      {inviting && (
        <div className="na-edit-card">
          <h2>Invite a colleague</h2>
          <p>
            Choose their role and enter a working email address. They receive an
            invitation, choose their own password, then verify the code sent to
            that address to activate access. Existing users do not repeat this
            process.
          </p>
          <form
            className="na-form na-user-form"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(
                "invite",
                () =>
                  inviteUser({
                    email: inviteEmail.trim(),
                    name: inviteName.trim(),
                    role: inviteRole,
                  }),
                "Invitation queued for email delivery. They become active after verifying their email.",
                () => {
                  setInviting(false);
                  setInviteEmail("");
                  setInviteName("");
                  setInviteRole("staff");
                },
              );
            }}
          >
            <label>
              Full name
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
              Work email
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
              Role
              <select
                aria-label="Invitation role"
                value={inviteRole}
                disabled={!!busy}
                onChange={(event) =>
                  setInviteRole(event.target.value as EditableRole)
                }
              >
                {roles.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <small className="na-field-help">
                {roles.find((item) => item.value === inviteRole)?.description}
              </small>
            </label>
            <div className="na-form-actions">
              <button
                className="cs-button"
                type="button"
                disabled={!!busy}
                onClick={() => setInviting(false)}
              >
                Cancel
              </button>
              <button
                className="cs-button primary"
                type="submit"
                disabled={!!busy || !emailConfigured}
              >
                {busy === "invite" ? "Sending invitation…" : "Send invitation"}
              </button>
            </div>
          </form>
        </div>
      )}
      {editing && (
        <div className="na-edit-card">
          <h2>Edit user</h2>
          <p>{editing.email}</p>
          <form
            className="na-form na-user-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editing) return;
              void perform(
                editing.id,
                () =>
                  updateUser(editing.id, {
                    name: editName.trim(),
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
              Full name
              <input
                value={editName}
                required
                maxLength={120}
                disabled={!!busy}
                onChange={(event) => setEditName(event.target.value)}
              />
            </label>
            <label>
              Role
              <select
                aria-label="User role"
                value={editRole}
                disabled={!!busy || editing.id === currentUser.id}
                onChange={(event) =>
                  setEditRole(event.target.value as EditableRole)
                }
              >
                {roles.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <small className="na-field-help">
                {editing.id === currentUser.id
                  ? "Another admin can change your role."
                  : roles.find((item) => item.value === editRole)?.description}
              </small>
            </label>
            <div className="na-form-actions">
              <button
                className="cs-button"
                type="button"
                disabled={!!busy}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="cs-button primary"
                type="submit"
                disabled={!!busy}
              >
                {busy === editing.id ? "Saving…" : "Save user"}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="na-table-card">
        <div className="na-user-filters">
          <label>
            Find a user
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or email"
            />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="all">All roles</option>
              {roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              {currentUser.role === "superadmin" && (
                <option value="superadmin">Support superadmin</option>
              )}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <button
            className="cs-button"
            type="button"
            disabled={!!busy}
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh list
          </button>
        </div>
        {!loaded ? (
          <p className="na-empty" role="status">
            Loading your team…
          </p>
        ) : (
          <div className="na-table-scroll">
            <table className="na-users-table">
              <caption>
                {matches.length} {matches.length === 1 ? "user" : "users"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last sign in</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.name || "Team member"}
                        {user.id === currentUser.id && (
                          <span className="na-you">You</span>
                        )}
                      </strong>
                      <span>{user.email}</span>
                      {user.isSupport && (
                        <small>Support account · here to help your team</small>
                      )}
                    </td>
                    <td>{roleLabel(user.role)}</td>
                    <td>
                      <span className={"na-status " + user.status}>
                        {user.status === "invited"
                          ? "Invitation pending"
                          : user.status === "disabled"
                            ? "Disabled"
                            : "Active"}
                      </span>
                    </td>
                    <td>{lastSeen(user.lastLoginAt)}</td>
                    <td>
                      {user.isSupport || user.role === "superadmin" ? (
                        <span className="na-protected">Support account</span>
                      ) : (
                        <div className="na-row-actions">
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => {
                              setEditing(user);
                              setEditName(user.name);
                              setEditRole(user.role as EditableRole);
                              setInviting(false);
                            }}
                          >
                            Edit
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
                              {user.status === "disabled"
                                ? "Invite again"
                                : "Resend invite"}
                            </button>
                          )}
                          {user.id !== currentUser.id &&
                            (user.status !== "disabled" ||
                              user.emailVerified) && (
                              <button
                                type="button"
                                disabled={!!busy}
                                onClick={() => {
                                  if (
                                    user.status !== "disabled" &&
                                    !window.confirm(
                                      (user.status === "invited"
                                        ? "Cancel the invitation for "
                                        : "Disable access for ") +
                                        user.email +
                                        "? Their work will be kept.",
                                    )
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
                                {user.status === "disabled"
                                  ? "Restore access"
                                  : user.status === "invited"
                                    ? "Cancel invitation"
                                    : "Disable"}
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
                      {users.length
                        ? "No users match these filters."
                        : "No users found. Refresh the list or invite a colleague."}
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
          Support accounts are visible only to Promo Automation superadmins and
          are managed separately from the Neptun team.
        </p>
      )}
    </section>
  );
}

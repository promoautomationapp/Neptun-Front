import { SearchableSelect } from "../../components/SearchableSelect";
import React, { useEffect, useState } from "react";
import type { User } from "../auth/auth.api";
import { getLanguage } from "../brochure/i18n";
import { getActivity } from "./activity.api";
import type { Activity } from "./activity.api";
import "../../styles/activity.css";

const messages: Record<string, string> = {
  "Activity log": "Historiku i veprimeve",
  "Workspace activity": "Veprimet në hapësirën e punës",
  "See who changed the workspace, when it happened, and the request outcome.":
    "Shihni kush bëri ndryshime, kur u kryen dhe rezultatin e kërkesës.",
  "Refresh activity": "Përditëso historikun",
  Period: "Periudha",
  "All time": "Gjithë kohën",
  Today: "Sot",
  "Specific date": "Datë e caktuar",
  "Date range": "Interval datash",
  Date: "Data",
  From: "Nga",
  To: "Deri",
  User: "Përdoruesi",
  "All users": "Të gjithë përdoruesit",
  Action: "Veprimi",
  "All actions": "Të gjitha veprimet",
  Outcome: "Rezultati",
  "All outcomes": "Të gjitha rezultatet",
  Successful: "I suksesshëm",
  Unsuccessful: "I pasuksesshëm",
  "Search activity": "Kërko në historik",
  "Name, email, target or IP": "Emri, emaili, objekti ose IP-ja",
  Search: "Kërko",
  "Loading activity…": "Po ngarkohet historiku…",
  "Activity is temporarily unavailable. Try refreshing.":
    "Historiku është përkohësisht i padisponueshëm. Provoni ta përditësoni.",
  "Choose a valid start and end date.":
    "Zgjidhni një datë fillimi dhe mbarimi të vlefshme.",
  "No activity matches these filters.":
    "Asnjë veprim nuk përputhet me filtrat.",
  Time: "Koha",
  Target: "Objekti",
  "Request IP": "IP-ja e kërkesës",
  Unknown: "E panjohur",
  "Account history": "Historiku i llogarisë",
  "Request details": "Detajet e kërkesës",
  "Request ID": "ID-ja e kërkesës",
  Duration: "Kohëzgjatja",
  "HTTP status": "Statusi HTTP",
  Previous: "Mëparshëm",
  Next: "Tjetri",
  Page: "Faqja",
  of: "nga",
  events: "veprime",
  "Dates use Europe/Belgrade. IP addresses are observed by the server and may identify a hosting proxy.":
    "Datat përdorin zonën Europe/Belgrade. IP-të lexohen nga serveri dhe mund t'i përkasin ndërmjetësit të hostimit.",
  "New activity is recorded from the time logging is enabled. Older account history has no original IP or request details.":
    "Veprimet e reja regjistrohen nga aktivizimi i historikut. Historiku i vjetër i llogarive nuk ka IP-në origjinale ose detajet e kërkesës.",
  "AI entries record requests, including reuse of prepared results. Background completion and spending are shown in AI usage.":
    "Veprimet AI regjistrojnë kërkesat, përfshirë ripërdorimin e rezultateve. Përfundimi në sfond dhe shpenzimi shfaqen te përdorimi i AI.",
  Campaign: "Fushata",
  "Social post": "Postimi",
  Settings: "Cilësimet",
  Catalog: "Katalogu",
  Products: "Produktet",
  "Image upload": "Ngarkimi i imazhit",
  Account: "Llogaria",
  Workspace: "Hapësira e punës",
  "Campaign saved": "U ruajt fushata",
  "Campaign deleted": "U fshi fushata",
  "Campaign reviewed": "U rishikua fushata",
  "Comment added": "U shtua koment",
  "Reply added": "U shtua përgjigje",
  "Comment resolved": "U zgjidh komenti",
  "Sent for review": "U dërgua për rishikim",
  "Campaign completed": "U përfundua fushata",
  "Campaign reopened": "U rihap fushata",
  "Social post saved": "U ruajt postimi",
  "Social post deleted": "U fshi postimi",
  "Settings saved": "U ruajtën cilësimet",
  "Catalog refresh requested": "U kërkua përditësimi i katalogut",
  "Products loaded": "U ngarkuan produktet",
  "Image upload started": "Filloi ngarkimi i imazhit",
  "Image uploaded": "U ngarkua imazhi",
  "Image upload confirmed": "U konfirmua imazhi",
  "User invited": "U ftua përdoruesi",
  "User updated": "U ndryshua përdoruesi",
  "Invitation resent": "U ridërgua ftesa",
  "Signed in": "Hyrje në llogari",
  "Signed out": "Dalje nga llogaria",
  "Password changed": "U ndryshua fjalëkalimi",
  "Password reset": "U rivendos fjalëkalimi",
  "Password reset requested": "U kërkua rivendosja e fjalëkalimit",
  "Invitation accepted": "U pranua ftesa",
  "Email verified": "U verifikua emaili",
  "Initial account configured": "U konfigurua llogaria fillestare",
  "Product cutout requested": "U kërkua heqja e sfondit",
  "Brand image requested": "U kërkua imazhi i brendit",
  "Background image requested": "U kërkua imazhi i sfondit",
  "Lifestyle image requested": "U kërkua imazhi lifestyle",
  "Text proofreading requested": "U kërkua kontrollimi i tekstit",
  "Text generation requested": "U kërkua gjenerimi i tekstit",
  "AI placement requested": "U kërkua vendosja me AI",
  "TV screen detection requested": "U kërkua identifikimi i ekranit TV",
  "Product photo search requested": "U kërkua fotografia e produktit",
  "Lifestyle image accepted": "U pranua imazhi lifestyle",
  "AI requested": "U dërgua kërkesë AI",
  "Workspace changed": "U ndryshua hapësira e punës",
};
const text = (value: string) =>
  getLanguage() === "sq" ? (messages[value] ?? value) : value;
const actionNames: Record<string, string> = {
  "campaign.save": "Campaign saved",
  "campaign.delete": "Campaign deleted",
  "campaign.review": "Campaign reviewed",
  "campaign.comment": "Comment added",
  "campaign.reply": "Reply added",
  "campaign.fix": "Comment resolved",
  "campaign.submit": "Sent for review",
  "campaign.complete": "Campaign completed",
  "campaign.reopen": "Campaign reopened",
  "post.save": "Social post saved",
  "post.delete": "Social post deleted",
  "settings.save": "Settings saved",
  "catalog.refresh": "Catalog refresh requested",
  "products.load": "Products loaded",
  "image.upload-request": "Image upload started",
  "image.upload": "Image uploaded",
  "image.upload-confirm": "Image upload confirmed",
  "user.invite": "User invited",
  "user.update": "User updated",
  "user.resend-invite": "Invitation resent",
  "account.login": "Signed in",
  "account.logout": "Signed out",
  "account.change-password": "Password changed",
  "user.invited": "User invited",
  "user.updated": "User updated",
  "user.invitation-resent": "Invitation resent",
  "user.invitation-accepted": "Invitation accepted",
  "user.email-verified": "Email verified",
  "user.password-reset": "Password reset",
  "user.password-changed": "Password changed",
  "user.invitation_resent": "Invitation resent",
  "user.activated": "Email verified",
  "password.reset_requested": "Password reset requested",
  "password.reset": "Password reset",
  "password.changed": "Password changed",
  "user.bootstrap-password": "Initial account configured",
  "ai.cutout": "Product cutout requested",
  "ai.brand_prep": "Brand image requested",
  "ai.background": "Background image requested",
  "ai.lifestyle": "Lifestyle image requested",
  "ai.proofread": "Text proofreading requested",
  "ai.text_generate": "Text generation requested",
  "ai.placement": "AI placement requested",
  "ai.detect_screen": "TV screen detection requested",
  "ai.product_image_search": "Product photo search requested",
  "ai.lifestyle-accept": "Lifestyle image accepted",
  "ai.request": "AI requested",
};
const targetNames: Record<string, string> = {
  campaign: "Campaign",
  post: "Social post",
  settings: "Settings",
  catalog: "Catalog",
  products: "Products",
  upload: "Image upload",
  user: "User",
  account: "Account",
  ai: "AI",
  workspace: "Workspace",
};
export const activityActionLabel = (value: string) =>
  text(actionNames[value] ?? "Workspace changed");
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const stamp = (value: string) =>
  new Intl.DateTimeFormat(getLanguage() === "sq" ? "sq-AL" : "en-GB", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));

export function ActivityPage({ user }: { user: Pick<User, "role"> }) {
  const allowed = user.role === "admin" || user.role === "superadmin";
  const [period, setPeriod] = useState("all"),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [actor, setActor] = useState(""),
    [action, setAction] = useState(""),
    [outcome, setOutcome] = useState(""),
    [searchInput, setSearchInput] = useState(""),
    [search, setSearch] = useState("");
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<Activity | null>(null),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const rangeFrom = period === "today" ? today() : from,
    rangeTo = period === "today" ? today() : period === "date" ? from : to;
  const invalid =
    period !== "all" && (!rangeFrom || !rangeTo || rangeFrom > rangeTo);
  useEffect(() => {
    setPage(1);
  }, [period, from, to, actor, action, outcome, search]);
  useEffect(() => {
    if (!allowed || invalid) return;
    const abort = new AbortController(),
      params = new URLSearchParams({
        action,
        outcome,
        search,
        page: String(page),
        limit: "25",
      });
    if (period !== "all") {
      params.set("from", rangeFrom);
      params.set("to", rangeTo);
    }
    if (actor) params.set("actor", actor);
    setLoading(true);
    setFailed(false);
    getActivity(params, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [
    allowed,
    invalid,
    period,
    rangeFrom,
    rangeTo,
    actor,
    action,
    outcome,
    search,
    page,
    revision,
  ]);
  if (!allowed) return null;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 25));
  return (
    <section className="cs-activity" aria-label={text("Activity log")}>
      <header className="cs-activity-heading">
        <div>
          <h1>{text("Workspace activity")}</h1>
          <p>
            {text(
              "See who changed the workspace, when it happened, and the request outcome.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          {text("Refresh activity")}
        </button>
      </header>
      <div className="cs-activity-filters">
        <label>
          {text("Period")}
          <SearchableSelect
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="all">{text("All time")}</option>
            <option value="today">{text("Today")}</option>
            <option value="date">{text("Specific date")}</option>
            <option value="range">{text("Date range")}</option>
          </SearchableSelect>
        </label>
        {(period === "date" || period === "range") && (
          <label>
            {text(period === "date" ? "Date" : "From")}
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
        )}
        {period === "range" && (
          <label>
            {text("To")}
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        )}
        <label>
          {text("User")}
          <SearchableSelect
            value={actor}
            onChange={(event) => setActor(event.target.value)}
          >
            <option value="">{text("All users")}</option>
            {data?.users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.email}
              </option>
            ))}
          </SearchableSelect>
        </label>
        <label>
          {text("Action")}
          <SearchableSelect
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            <option value="">{text("All actions")}</option>
            {data?.actions.map((value) => (
              <option key={value} value={value}>
                {activityActionLabel(value)}
              </option>
            ))}
          </SearchableSelect>
        </label>
        <label>
          {text("Outcome")}
          <SearchableSelect
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="">{text("All outcomes")}</option>
            <option value="success">{text("Successful")}</option>
            <option value="failure">{text("Unsuccessful")}</option>
          </SearchableSelect>
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <label>
            {text("Search activity")}
            <input
              type="search"
              value={searchInput}
              maxLength={150}
              placeholder={text("Name, email, target or IP")}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <button type="submit">{text("Search")}</button>
        </form>
      </div>
      {invalid && (
        <p role="status">{text("Choose a valid start and end date.")}</p>
      )}
      {failed && (
        <p role="status" className="cs-activity-notice">
          {text("Activity is temporarily unavailable. Try refreshing.")}
        </p>
      )}
      {loading && <p role="status">{text("Loading activity…")}</p>}
      {data && !invalid && (
        <>
          <div className="cs-activity-summary">
            <strong>
              {data.total.toLocaleString()} {text("events")}
            </strong>
            <span>
              {text(
                "Dates use Europe/Belgrade. IP addresses are observed by the server and may identify a hosting proxy.",
              )}
            </span>
          </div>
          <div className="cs-activity-table" aria-busy={loading}>
            <table>
              <thead>
                <tr>
                  {[
                    "Time",
                    "User",
                    "Action",
                    "Target",
                    "Request IP",
                    "Outcome",
                  ].map((label) => (
                    <th key={label}>{text(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.records.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <time dateTime={row.createdAt}>
                        {stamp(row.createdAt)}
                      </time>
                      {row.source === "account-history" && (
                        <small>{text("Account history")}</small>
                      )}
                    </td>
                    <td>
                      <strong>
                        {row.actor.name || row.actor.email || text("Account")}
                      </strong>
                      {row.actor.name && <small>{row.actor.email}</small>}
                    </td>
                    <td>
                      {activityActionLabel(row.action)}
                      {row.route && (
                        <details>
                          <summary>{text("Request details")}</summary>
                          <p>
                            <code>
                              {row.method} {row.route}
                            </code>
                          </p>
                          <p>
                            {text("Request ID")}: <code>{row.requestId}</code>
                          </p>
                          <p>
                            {text("HTTP status")}: {row.statusCode} ·{" "}
                            {text("Duration")}: {row.durationMs} ms
                          </p>
                        </details>
                      )}
                    </td>
                    <td>
                      {text(targetNames[row.targetType] ?? "Workspace")}
                      {row.targetId && (
                        <code className="cs-activity-target">
                          {row.targetId}
                        </code>
                      )}
                    </td>
                    <td>
                      <code>{row.ip ?? text("Unknown")}</code>
                    </td>
                    <td>
                      <span className={`cs-activity-outcome is-${row.outcome}`}>
                        {text(
                          row.outcome === "success"
                            ? "Successful"
                            : "Unsuccessful",
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data.records.length && (
                  <tr>
                    <td colSpan={6} className="cs-activity-empty">
                      {text("No activity matches these filters.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <nav className="cs-activity-pages" aria-label={text("Activity log")}>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              {text("Previous")}
            </button>
            <span>
              {text("Page")} {page} {text("of")} {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              {text("Next")}
            </button>
          </nav>
        </>
      )}
      <p className="cs-activity-note">
        {text(
          "New activity is recorded from the time logging is enabled. Older account history has no original IP or request details.",
        )}
      </p>
      <p className="cs-activity-note">
        {text(
          "AI entries record requests, including reuse of prepared results. Background completion and spending are shown in AI usage.",
        )}
      </p>
    </section>
  );
}

import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {z} from "zod";
import {request, apiFetch} from "../../api/client";
import {campaignSaveStatus, subscribeCampaignSaveStatus} from "./campaignSaveStatus";
import {t} from "./i18n";
import "../../styles/campaign-activity-status.css";

const presence = z.object({participants: z.array(z.object({sessionId: z.string(), userId: z.string(), email: z.string(), name: z.string().default(""), mode: z.enum(["edit", "preview"]), pageLabel: z.string()}))});
type Participant = z.infer<typeof presence>["participants"][number];

export function CampaignActivityStatus({campaignId, mode, pageLabel}: {campaignId: string; mode: "edit" | "preview"; pageLabel: string}) {
  const sessionId = useRef(crypto.randomUUID());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connected, setConnected] = useState(true);
  const save = useSyncExternalStore(subscribeCampaignSaveStatus, () => campaignSaveStatus(campaignId), () => campaignSaveStatus(campaignId));
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const heartbeat = async () => {
      if (busy) return; busy = true;
      try {
        const result = await request(`/api/team/campaigns/${encodeURIComponent(campaignId)}/presence`, presence, {method: "POST", body: {sessionId: sessionId.current, mode, pageLabel}, signal: controller.signal});
        if (!controller.signal.aborted) {setParticipants(result.participants.filter(person => person.sessionId !== sessionId.current)); setConnected(true);}
      } catch { if (!controller.signal.aborted) setConnected(false); }
      finally {busy = false;}
    };
    void heartbeat(); const timer = setInterval(() => void heartbeat(), 10_000);
    return () => {controller.abort(); clearInterval(timer);};
  }, [campaignId, mode, pageLabel]);
  useEffect(() => {
    const leave = () => {void apiFetch(`/api/team/campaigns/${encodeURIComponent(campaignId)}/presence/${sessionId.current}`, {method: "DELETE", keepalive: true}).catch(() => {});};
    window.addEventListener("pagehide", leave);
    return () => {window.removeEventListener("pagehide", leave); leave();};
  }, [campaignId]);
  const others = [...new Map(participants.filter(person => person.mode === "edit").map(person => [person.userId, person])).values()];
  return <div className="cs-brochure-status-bar" data-export-hide="true" role="status" aria-live="polite">
    <strong className="cs-brochure-mode">{mode === "edit" ? "✎ " : "◉ "}{t(mode === "edit" ? "Editing brochure" : "Preview only")}</strong>
    <span className={`cs-save-status state-${save.state}`}>{t(save.state === "saving" ? "Saving changes…" : save.state === "conflict" ? "Another editor saved changes. Your edits are kept in this tab." : save.state === "error" ? "Changes could not be saved. Your edits are kept in this tab." : "All changes saved")}</span>
    {others.length > 0 && <span className="cs-collaboration-status">{others.map(person => person.name || person.email).join(", ")} · {t("also editing this brochure")}</span>}
    {!connected && <span className="cs-presence-unavailable">{t("Live team status unavailable")}</span>}
  </div>;
}

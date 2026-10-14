import { createPortal } from "react-dom";
import React from "react";
import { Button, Modal } from "./Modals";
import { readImage } from "./utils";
import { t } from "./i18n";
import { lifestyleQuota, generateLifestyle, acceptLifestyle } from "./lifestyleImageApi";
import type { LifestyleQuota } from "./lifestyleImageApi";
import type { Product } from "../../domain/models";
import "../../styles/lifestyle-image-editor.css";
interface Version { image: string; prompt: string; resultId?: string; }
interface Props { source?: string; context: "brochure" | "tv"; products?: Product[]; onApply: (image: string) => void; onClose: () => void; }
export function LifestyleImageEditor({ source = "", context, products = [], onApply, onClose }: Props) {
  const [mode, setMode] = React.useState<"upload" | "ai">("upload");
  const [versions, setVersions] = React.useState<Version[]>(source ? [{ image: source, prompt: "" }] : []);
  const [index, setIndex] = React.useState(0);
  const [prompt, setPrompt] = React.useState("");
  const [quota, setQuota] = React.useState<LifestyleQuota | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const current = versions[index];
  React.useEffect(() => { let active = true; lifestyleQuota().then((value) => { if (active) setQuota(value); }).catch(() => { if (active) setError(t("Could not load the AI image limit. Upload is still available.")); }); return () => { active = false; }; }, []);
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) { setError(t("Choose an image under 12 MB.")); return; }
    try { const image = await readImage(file); setVersions((items) => [...items, { image, prompt: "" }]); setIndex(versions.length); setError(""); }
    catch { setError(t("Could not read this image.")); }
  }
  async function generate() {
    if (busy || !prompt.trim() || !quota) return;
    setBusy(true); setError("");
    try {
      const result = await generateLifestyle({ prompt, ...(current?.image ? { image: current.image } : {}), context, orientation: context === "tv" ? "landscape" : "portrait", products, regenerate: true });
      if (!result.resultId) throw new Error(t("The image could not be saved. Please try again."));
      setVersions((items) => [...items, { image: result.image, resultId: result.resultId, prompt }]); setIndex(versions.length); setPrompt("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not generate the image.")); }
    finally { setBusy(false); lifestyleQuota().then(setQuota).catch(() => {}); }
  }
  async function apply() {
    if (!current || busy) return;
    setBusy(true); setError("");
    try { if (current.resultId) await acceptLifestyle(current.resultId); onApply(current.image); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not use this image.")); setBusy(false); }
  }
  const exhausted = quota && (quota.used >= quota.limit || quota.attempts >= quota.attemptLimit);
  const dialog = <Modal wide title={t(context === "tv" ? "TV wallpaper studio" : "Cover image studio")} kicker={t("IMAGE & LIFESTYLE")} onClose={busy ? () => {} : onClose}>
    <div className="cs-lifestyle-studio">
      <div className="cs-lifestyle-preview">{current ? <img src={current.image} alt={t("Full image preview")} /> : <p>{t("Upload an image or create one with AI.")}</p>}</div>
      <div className="cs-lifestyle-panel">
        <div className="cs-lifestyle-tabs" role="group" aria-label={t("Image source")}><button type="button" aria-pressed={mode === "upload"} onClick={() => setMode("upload")}>{t("Upload image")}</button><button type="button" aria-pressed={mode === "ai"} onClick={() => setMode("ai")}>{t("Create / refine with AI")}</button></div>
        {mode === "upload" ? <><p>{t("See the whole image before applying it. You can move, resize, replace or remove it in the brochure.")}</p><label className="cs-upload-button">↑ {t("Choose image")}<input type="file" accept="image/*" aria-label={t("Upload lifestyle image")} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} /></label><small>PNG, JPG, WebP · 12 MB</small></> : <>
          <p>{t("Describe your scene. To refine it, select a version and tell AI what to change.")}</p>
          <label>{t("Your direction")}<textarea rows={5} maxLength={1000} value={prompt} aria-label={t("AI image direction")} onChange={(event) => setPrompt(event.target.value)} placeholder={t("A bright living room, softer lighting, more space around the products…")} /></label>
          <div className="cs-lifestyle-quota" role="status">{quota ? `${quota.used} / ${quota.limit} ${t("AI images used this month")} · ${quota.attempts} / ${quota.attemptLimit} ${t("attempts")}` : t("Loading image limit…")}</div>
          {exhausted && <p>{t("Monthly AI image limit reached. You can still upload an image.")}</p>}
          <Button tone="primary" disabled={busy || !prompt.trim() || !quota || Boolean(exhausted)} onClick={generate}>{busy ? t("Preparing image…") : current ? t("Refine this image") : t("Generate image")}</Button>
        </>}
        {versions.length > 0 && <div className="cs-lifestyle-versions"><strong>{t("Versions")}</strong><div>{versions.map((version, number) => <button type="button" key={number} aria-label={`${t("Image version")} ${number + 1}`} aria-pressed={number === index} onClick={() => setIndex(number)}><img src={version.image} alt="" /><span>{number + 1}</span></button>)}</div></div>}
        {current?.prompt && <p className="cs-lifestyle-direction">{current.prompt}</p>}
        {error && <p role="alert" className="cs-error">{error}</p>}
      </div>
    </div>
    <div className="cs-modal-actions"><Button disabled={busy} onClick={onClose}>{t("Back")}</Button><Button tone="primary" disabled={!current || busy} onClick={apply}>{t("Use this image")}</Button></div>
  </Modal>;
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}

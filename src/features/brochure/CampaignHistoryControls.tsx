import React from "react";
import "../../styles/campaign-history.css";

export function CampaignHistoryControls({ undoCount, redoCount, onUndo, onRedo, language = "en" }:{undoCount:number;redoCount:number;onUndo:()=>void;onRedo:()=>void;language?:string}) {
  const labels = language === "sq"
    ? { undo: "Zhbëj", redo: "Ribëj", undoLast: "Zhbëj ndryshimin e fundit", redoLast: "Ribëj ndryshimin e fundit", four: "4 ndryshimet e fundit" }
    : { undo: "Undo", redo: "Redo", undoLast: "Undo last change", redoLast: "Redo last change", four: "Last 4 changes" };
  return <div className="cs-campaign-history" role="group" aria-label={labels.four} data-export-hide>
    <span className="cs-history-limit">{labels.four}</span>
    <button type="button" disabled={!undoCount} onClick={onUndo} title={`${labels.undoLast} (⌘Z / Ctrl+Z)`} aria-label={`${labels.undoLast} (${undoCount})`}>
      <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4 3 8l4 4M3 8h8a5 5 0 0 1 0 10" /></svg>
      {labels.undo}
    </button>
    <button type="button" disabled={!redoCount} onClick={onRedo} title={`${labels.redoLast} (⇧⌘Z / Ctrl+Y)`} aria-label={`${labels.redoLast} (${redoCount})`}>
      <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m13 4 4 4-4 4M17 8H9a5 5 0 0 0 0 10" /></svg>
      {labels.redo}
    </button>
  </div>;
}

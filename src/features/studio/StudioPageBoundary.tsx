import { Component } from "react";
import type { ReactNode } from "react";
import { getLanguage } from "../brochure/i18n";

/** A page module failure must not remove the workspace navigation or account controls. */
export class StudioPageBoundary extends Component<
  {
    children: ReactNode;
    onReturn: () => void;
  },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    console.error("Could not open workspace page:", error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const albanian = getLanguage() === "sq";
    return (
      <section className="cs-main-panel cs-page-loading" role="alert">
        <h1>
          {albanian ? "Faqja nuk u hap" : "This page could not be opened"}
        </h1>
        <p>
          {albanian
            ? "Mund të vazhdoni me faqet e tjera të hapësirës së punës."
            : "You can continue using the other workspace pages."}
        </p>
        <button
          className="cs-button primary"
          type="button"
          onClick={this.props.onReturn}
        >
          {albanian ? "Kthehu te fushatat" : "Back to campaigns"}
        </button>
      </section>
    );
  }
}

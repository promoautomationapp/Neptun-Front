import React, { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Campaign, CampaignMutator } from "../../src/domain/models";
import { CoverDesignControls } from "../../src/features/brochure/CoverDesignControls";
import { CoverPage } from "../../src/features/brochure/Brochure";
import { setLanguage } from "../../src/features/brochure/i18n";
afterEach(cleanup);

it("updates the visible cover message from color input events and leaves the band opt-in", () => {
  setLanguage("en");
  function Cover() {
    const [campaign, setCampaign] = useState<Campaign>({ id: "color", name: "Cover", tagline: "The offer", showCoverMessage: true, products: [] });
    const update = (mutate: CampaignMutator) => setCampaign((current) => {
      const next = structuredClone(current);
      mutate(next);
      return next;
    });
    return <><CoverDesignControls campaign={campaign} onUpdate={update} /><CoverPage campaign={campaign} /></>;
  }
  const view = render(<Cover />);
  expect((view.getByRole("checkbox", { name: "UUU / hajde!" }) as HTMLInputElement).checked).toBe(false);
  const message = view.container.querySelector<HTMLElement>(".cover-element-message p")!;
  expect(message.style.color).toBe("rgb(255, 255, 255)");
  fireEvent.input(view.getByLabelText("Message color"), { target: { value: "#aaffaa" } });
  expect(message.style.color).toBe("rgb(170, 255, 170)");
  expect(view.container.querySelector(".cover-element-band")).toBeNull();
});

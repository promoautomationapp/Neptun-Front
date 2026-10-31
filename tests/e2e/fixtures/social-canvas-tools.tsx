import React from "react";
import { createRoot } from "react-dom/client";
import { SocialStudio } from "../../../src/features/social/SocialStudio";
import { setLanguage } from "../../../src/features/brochure/i18n";
import { resolveSettings } from "../../../src/features/settings/settings.schema";
import "../../../src/styles/campaign.css";
import "../../../src/features/appearance/dark-mode.css";
setLanguage("en");
const user = {
  email: "staff@example.test",
  name: "Social editor",
  role: "staff" as const,
};
createRoot(document.getElementById("root")!).render(
  <div className="campaign-app">
    <main className="cs-content" style={{ padding: 24 }}>
      <SocialStudio
        catalog={[]}
        campaigns={[]}
        settings={resolveSettings(null)}
        user={user}
        members={[user, { email: "pm@example.test", name: "PM", role: "pm" }]}
      />
    </main>
  </div>,
);

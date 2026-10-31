import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { UsersPage } from "../../../src/features/users/UsersPage";
import { CatalogNavigator } from "../../../src/features/products/CatalogNavigator";
import { setLanguage } from "../../../src/features/brochure/i18n";
import "../../../src/styles/campaign.css";
import "../../../src/features/appearance/dark-mode.css";

setLanguage("en");
const admin = {
  id: "admin",
  email: "admin@example.test",
  name: "Admin",
  role: "admin",
  permissions: "admin",
  organizationId: "organization-test",
  isSupport: false,
  mustChangePassword: false,
} as const;
function Fixture() {
  const [language, setLocale] = useState("en");
  const [selection, setSelection] = useState({
    categoryPath: "GIFT CARD",
    brand: "",
    availability: "all",
  });
  return (
    <div className="campaign-app" style={{ display: "block", padding: 20 }}>
      <div style={{ display: "flex", gap: 20, marginBottom: 15 }}>
        <label>
          Fixture language{" "}
          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              setLocale(event.target.value);
            }}
          >
            <option value="en">English</option>
            <option value="sq">Shqip</option>
          </select>
        </label>
        <label>
          Fixture dark{" "}
          <input
            type="checkbox"
            onChange={(event) => {
              document.documentElement.dataset.theme = event.target.checked
                ? "dark"
                : "light";
            }}
          />
        </label>
      </div>
      <CatalogNavigator
        products={[
          {
            code: "gift",
            name: "Gift card",
            brand: "OTHER",
            categoryPath: "GIFT CARD",
          },
          {
            code: "phone",
            name: "Phone",
            brand: "SAMSUNG",
            categoryPath: "PHONES",
          },
        ]}
        selection={selection}
        onChange={setSelection}
      />
      <UsersPage currentUser={admin} />
    </div>
  );
}
createRoot(document.getElementById("team-dialogs-fixture")!).render(
  <Fixture />,
);

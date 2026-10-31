import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SearchableSelect } from "../../src/components/SearchableSelect";
import { FilterSelect } from "../../src/features/brochure/FilterControls";
import { CampaignStatus } from "../../src/features/campaigns/CampaignStatus";
import { setLanguage, t } from "../../src/features/brochure/i18n";
afterEach(cleanup);
it.each(["en", "sq"] as const)(
  "keeps status text accessible alongside colors in %s",
  (language) => {
    setLanguage(language);
    const view = render(
      <>
        <SearchableSelect
          aria-label={t("Status")}
          value="invited"
          onChange={() => {}}
        >
          <option value="all">{t("All statuses")}</option>
          <option value="active">{t("Active")}</option>
          <option value="invited">{t("Invited")}</option>
          <option value="disabled">{t("Disabled")}</option>
        </SearchableSelect>
        <FilterSelect
          label={t("Workflow status")}
          value="in_review"
          options={[
            { value: "all", label: t("All statuses") },
            { value: "in_review", label: t("In review") },
            { value: "completed", label: t("Completed") },
          ]}
          onChange={() => {}}
        />
        <CampaignStatus campaign={{ status: "changes_requested" }} />
      </>,
    );
    const trigger = view.getByRole("combobox", { name: t("Status") });
    expect(trigger.textContent).toContain(t("Invited"));
    expect(trigger.getAttribute("data-status-tone")).toBe("pending");
    fireEvent.click(trigger);
    expect(
      view
        .getByRole("option", { name: t("Active") })
        .getAttribute("data-status-tone"),
    ).toBe("success");
    fireEvent.keyDown(view.getByRole("searchbox"), { key: "Escape" });
    const workflow = view.getByRole("button", { name: t("Workflow status") });
    expect(workflow.getAttribute("data-status-tone")).toBe("review");
    fireEvent.click(workflow);
    expect(
      view
        .getByRole("option", { name: t("Completed") })
        .getAttribute("data-status-tone"),
    ).toBe("success");
    expect(
      view
        .getByLabelText(`${t("Workflow status")}: ${t("Changes requested")}`)
        .getAttribute("data-status-tone"),
    ).toBe("attention");
  },
);
it("keeps ordinary dropdowns free of status decoration", () => {
  const view = render(
    <SearchableSelect aria-label="Store" value="all">
      <option value="all">All stores</option>
      <option value="prishtine">Prishtinë</option>
    </SearchableSelect>,
  );
  expect(view.getByRole("combobox").hasAttribute("data-status-tone")).toBe(
    false,
  );
});

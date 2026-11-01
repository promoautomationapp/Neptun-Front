import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
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
    expect(view.queryByRole("searchbox")).toBeNull();
    fireEvent.keyDown(view.getByRole("option", { name: t("Active") }), {
      key: "Escape",
    });
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
it.each([
  ["en", "filter"],
  ["sq", "filter"],
  ["en", "select"],
  ["sq", "select"],
] as const)(
  "uses compact status pills without search and keeps keyboard selection working (%s / %s)",
  async (language, control) => {
    setLanguage(language);
    function Fixture() {
      const [status, setStatus] = useState("in_review");
      const options = [
        { value: "all", label: t("All statuses") },
        { value: "in_progress", label: t("In progress") },
        { value: "in_review", label: t("In review") },
        {
          value: "changes_requested",
          label: t("Changes requested"),
          disabled: true,
        },
        { value: "completed", label: t("Completed") },
        { value: "expired", label: t("Offer period ended") },
      ];
      return control === "filter" ? (
        <FilterSelect
          label={t("Status")}
          value={status}
          options={options}
          onChange={setStatus}
        />
      ) : (
        <SearchableSelect
          aria-label={t("Status")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </SearchableSelect>
      );
    }
    const view = render(<Fixture />);
    const trigger = view.getByRole(
      control === "filter" ? "button" : "combobox",
      { name: t("Status") },
    );
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const selected = view.getByRole("option", { name: t("In review") });
    await waitFor(() => expect(document.activeElement).toBe(selected));
    expect(view.queryByRole("searchbox")).toBeNull();
    expect(view.getAllByRole("option")).toHaveLength(6);
    const badge = selected.querySelector<HTMLElement>(
      ".ns-status-select-label",
    );
    expect(badge?.getAttribute("data-status-tone")).toBe("review");
    expect(selected.classList.contains("ns-status-option-row")).toBe(true);
    expect(within(selected).getByText("✓")).toBeTruthy();
    fireEvent.keyDown(selected, { key: "ArrowDown" });
    const completed = view.getByRole("option", { name: t("Completed") });
    expect(document.activeElement).toBe(completed);
    fireEvent.keyDown(completed, { key: "Enter" });
    expect(view.queryByRole("listbox")).toBeNull();
    expect(trigger.textContent).toContain(t("Completed"));
    expect(trigger.getAttribute("data-status-tone")).toBe("success");
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.keyDown(view.getByRole("option", { name: t("Completed") }), {
      key: "End",
    });
    const expired = view.getByRole("option", { name: t("Offer period ended") });
    expect(document.activeElement).toBe(expired);
    fireEvent.keyDown(expired, { key: "Escape" });
    expect(view.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  },
);

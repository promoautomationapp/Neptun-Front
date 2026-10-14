import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReviewPanel } from "../../src/features/brochure/ReviewPanel";
import { setLanguage } from "../../src/features/brochure/i18n";
afterEach(cleanup);

it.each(["admin", "superadmin"] as const)(
  "allows %s to review and resolve brochure comments",
  async (role) => {
    setLanguage("en");
    const action = vi.fn(async () => true);
    const view = render(
      <ReviewPanel
        user={{ email: "admin@example.test", role }}
        members={[]}
        campaign={{
          status: "changes_requested",
          reviewComments: [
            {
              id: "comment",
              pageIndex: 0,
              pageLabel: "Cover",
              text: "Please adjust the logo.",
              authorEmail: "pm@example.test",
              fixed: false,
              createdAt: "2026-10-12T12:00:00Z",
            },
          ],
        }}
        pageIndex={0}
        pageLabel="Cover"
        onAction={action}
      />,
    );
    expect(view.getByLabelText("Add a comment for this page")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Mark resolved" }));
    expect(action).toHaveBeenCalledWith("fix", { commentId: "comment" });
  },
);

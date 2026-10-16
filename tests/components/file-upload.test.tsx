import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FileUpload } from "../../src/components/FileUpload";
import { setLanguage } from "../../src/features/brochure/i18n";
afterEach(cleanup);

it("opens the native picker from a real button, accepts multiple files, and shows busy state without another upload", async () => {
  setLanguage("en");
  let finish!: () => void;
  const received: File[][] = [];
  const view = render(
    <FileUpload
      multiple
      accept="image/*"
      aria-label="Add pictures"
      onChange={(event) => {
        received.push([...(event.target.files || [])]);
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      }}
    >
      Add images
    </FileUpload>,
  );
  const input = view.getByLabelText("Add pictures") as HTMLInputElement;
  expect(input.hidden).toBe(true);
  const picker = vi.spyOn(input, "click");
  fireEvent.click(view.getByRole("button", { name: "Add images" }));
  expect(picker).toHaveBeenCalledOnce();
  const files = [
    new File(["one"], "one.png", { type: "image/png" }),
    new File(["two"], "two.png", { type: "image/png" }),
  ];
  fireEvent.change(input, { target: { files } });
  expect(received[0]).toEqual(files);
  expect(
    (view.getByRole("button", { name: "Uploading…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  finish();
  await waitFor(() =>
    expect(
      (view.getByRole("button", { name: "Add images" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  expect(input.value).toBe("");
});

it("keeps the chooser available to retry a failed upload", async () => {
  const upload = vi
    .fn()
    .mockRejectedValueOnce(new Error("Upload interrupted"))
    .mockResolvedValueOnce(undefined);
  const view = render(
    <FileUpload aria-label="Upload logo" onChange={upload}>
      Upload
    </FileUpload>,
  );
  const input = view.getByLabelText("Upload logo");
  const files = [new File(["logo"], "logo.png", { type: "image/png" })];
  fireEvent.change(input, { target: { files } });
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toBe("Upload interrupted"),
  );
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(view.queryByRole("alert")).toBeNull());
  expect(upload).toHaveBeenCalledTimes(2);
});

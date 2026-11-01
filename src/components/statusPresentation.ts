const tones: Record<string, string> = {
  active: "success",
  completed: "success",
  invited: "pending",
  in_progress: "pending",
  in_review: "review",
  changes_requested: "attention",
  disabled: "inactive",
  deleted: "inactive",
  expired: "inactive",
};
/** Only known status option sets gain decoration; ordinary selects remain unchanged. */
export function isStatusOptions(values: readonly (string | number)[]): boolean {
  return (
    values.some((value) => Boolean(tones[String(value)])) &&
    values.every(
      (value) =>
        value === "all" || value === "current" || Boolean(tones[String(value)]),
    )
  );
}
export function statusTone(value: string | number): string | undefined {
  return tones[String(value)];
}

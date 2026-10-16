// Restore the last explicitly chosen mode before the application paints.
try {
  document.documentElement.dataset.theme = localStorage.getItem("neptun.appearance.last") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}

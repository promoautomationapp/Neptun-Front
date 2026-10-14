(() => {
  "use strict";
  const key = "neptun-presentation-demo-signed-in",
    gate = document.getElementById("demo-signin"),
    form = document.getElementById("demo-signin-form");
  if (!gate || !(form instanceof HTMLFormElement)) return;
  const loginRequested =
    new URLSearchParams(location.search).get("login") === "1";
  let isSignedIn = false;
  try {
    if (loginRequested) sessionStorage.removeItem(key);
    isSignedIn = sessionStorage.getItem(key) === "yes";
  } catch {}
  if (isSignedIn) {
    document.body.classList.remove("signed-out");
    gate.hidden = true;
  }
  const enter = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    try {
      sessionStorage.setItem(key, "yes");
    } catch {}
    if (loginRequested)
      history.replaceState(null, "", location.pathname + "#studio");
    document.body.classList.remove("signed-out");
    gate.hidden = true;
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
  };
  form.addEventListener("submit", enter);
  form.querySelector("button[type=submit]")?.addEventListener("click", enter);
  document.getElementById("demo-logout")?.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
    gate.hidden = false;
    document.body.classList.add("signed-out");
    gate.scrollIntoView({ behavior: "auto" });
  });
})();

export {};

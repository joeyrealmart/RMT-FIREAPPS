const buttons = [...document.querySelectorAll("[data-view]")];
const screens = [...document.querySelectorAll("[data-screen]")];

function showView(view) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === view));
  buttons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const url = new URL(location.href);
  url.searchParams.set("view", view);
  history.replaceState({}, "", url);
}

buttons.forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
showView(new URL(location.href).searchParams.get("view") || "desktop");

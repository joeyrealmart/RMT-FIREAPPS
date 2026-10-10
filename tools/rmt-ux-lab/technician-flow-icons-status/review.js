(() => {
  const titles = {
    summary: "Design Direction",
    desktop: "Technician Desktop",
    "mobile-home": "Technician Mobile Home",
    inspection: "Technician Mobile Inspection",
    mimic: "Technician Mimic",
  };
  const buttons = [...document.querySelectorAll("[data-page]")];
  const pages = [...document.querySelectorAll("[data-view]")];
  const title = document.querySelector("#pageTitle");

  function show(requested) {
    const id = titles[requested] ? requested : "summary";
    pages.forEach((page) => page.classList.toggle("active", page.dataset.view === id));
    buttons.forEach((button) => button.classList.toggle("active", button.dataset.page === id));
    title.textContent = titles[id];
    sessionStorage.setItem("rmtTechFlowReviewPage", id);
  }

  buttons.forEach((button) => button.addEventListener("click", () => show(button.dataset.page)));
  show(sessionStorage.getItem("rmtTechFlowReviewPage") || "summary");
})();

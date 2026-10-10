(() => {
  const titles = {
    summary: "Executive Summary",
    desktop: "Technician Desktop",
    "mobile-home": "Technician Mobile Home",
    inspection: "Technician Mobile Inspection",
    mimic: "Technician Mimic",
    admin: "Admin Control Desk",
    checklist: "Checklist Simplification",
    autofill: "Autofill Opportunities",
    integrity: "Multi-tech / Offline / Linked",
    flows: "Recommended V1 Flows",
  };
  const buttons = [...document.querySelectorAll("[data-page]")];
  const pages = [...document.querySelectorAll("[data-view]")];
  const title = document.querySelector("#pageTitle");

  function show(id) {
    const page = titles[id] ? id : "summary";
    pages.forEach((item) => item.classList.toggle("active", item.dataset.view === page));
    buttons.forEach((item) => item.classList.toggle("active", item.dataset.page === page));
    title.textContent = titles[page];
    localStorage.setItem("rmtVisualReviewV3Page", page);
    if (location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
  }

  buttons.forEach((button) => button.addEventListener("click", () => show(button.dataset.page)));
  show(location.hash.slice(1) || localStorage.getItem("rmtVisualReviewV3Page") || "summary");
})();

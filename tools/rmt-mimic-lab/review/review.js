(() => {
  const data = window.RMT_MIMIC_LAB_DATA;
  const elements = Object.fromEntries(["floorSelect", "viewSelect", "summary", "title", "status", "reviewImage", "pngLink", "svgLink", "dxfLink"].map((id) => [id, document.getElementById(id)]));
  data.floors.forEach((floor) => elements.floorSelect.add(new Option(floor.displayName, floor.slug)));
  const current = () => data.floors.find((floor) => floor.slug === elements.floorSelect.value) || data.floors[0];
  function render() {
    const floor = current();
    const view = elements.viewSelect.value;
    const images = {
      cadComparison: floor.cadComparison,
      cadOverlay: floor.cadOverlay,
      cad: floor.cadBackground,
      pinAlignment: floor.pinAlignment,
      revisionComparison: floor.revisionComparison,
      overlay: floor.overlayReview,
      clean: floor.background.replace(/\.svg$/, ".png"),
      source: floor.source
    };
    elements.title.textContent = floor.displayName;
    elements.status.textContent = floor.status;
    elements.reviewImage.src = images[view];
    elements.reviewImage.alt = `${floor.displayName} ${view} review`;
    elements.summary.textContent = `Clean CAD reconstruction\n${floor.cadEntityCount} editable entities\nRevision 3 input: ${floor.segmentCount} entities\nIdentity canvas transform\nAuthoritative LTK pin registry: pending\nRuntime pins: excluded\nStatus: ${floor.status}`;
    const base = `../${floor.slug}/background-cad-redraw`;
    Object.assign(elements.pngLink, { href: `${base}.png`, download: `${floor.slug}-background-cad-redraw.png` });
    Object.assign(elements.svgLink, { href: `${base}.svg`, download: `${floor.slug}-background-cad-redraw.svg` });
    Object.assign(elements.dxfLink, { href: `${base}.dxf`, download: `${floor.slug}-background-cad-redraw.dxf` });
  }
  elements.floorSelect.addEventListener("change", render);
  elements.viewSelect.addEventListener("change", render);
  render();
})();

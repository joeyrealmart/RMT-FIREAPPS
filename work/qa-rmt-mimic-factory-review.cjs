const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "outputs", "rmt-mimic-factory", "factory-index.json");
const baseUrl = process.env.RMT_MIMIC_FACTORY_URL || "http://127.0.0.1:8031";
const screenshotDir = path.join(root, "outputs", "rmt-mimic-lab", "review-all", "screenshots");
const edge = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(fs.existsSync);

function localFile(urlPath) {
  assert.ok(urlPath.startsWith("/factory/"), `Unexpected candidate URL: ${urlPath}`);
  return path.join(root, "outputs", "rmt-mimic-factory", ...urlPath.slice("/factory/".length).split("/"));
}

async function assertHttpAsset(request, urlPath) {
  const response = await request.get(`${baseUrl}${urlPath}`);
  assert.equal(response.status(), 200, `${urlPath} did not return HTTP 200`);
  assert.ok((await response.body()).length > 0, `${urlPath} returned an empty response`);
}

(async () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const candidates = index.clients.flatMap((client) => client.candidates);
  const readyClients = index.clients.filter((client) => client.status === "REVIEW_REQUIRED");
  const blockedClients = index.clients.filter((client) => client.status === "BLOCKED_SOURCE_MISSING");
  assert.equal(candidates.length, 31, "Expected 31 source-backed candidates");
  assert.equal(readyClients.length, 4, "Expected four source-backed clients");
  assert.equal(blockedClients.length, 7, "Expected seven source-missing clients");

  for (const item of candidates) {
    assert.equal(item.status, "REVIEW_REQUIRED", `${item.client}/${item.candidate} has an unexpected status`);
    assert.equal(item.qa.runtimePinsIncluded, false, `${item.client}/${item.candidate} contains runtime pins`);
    assert.ok((item.qa.entityCount ?? item.qa.outputCadEntities) > 0, `${item.client}/${item.candidate} has no CAD entities`);
    const transformPath = path.join(root, "outputs", "rmt-mimic-factory", item.client, item.candidate, "manifest", "transform.json");
    assert.ok(fs.existsSync(transformPath), `${item.client}/${item.candidate} has no transform manifest`);
    assert.ok(fs.statSync(transformPath).size > 0, `${item.client}/${item.candidate} has an empty transform manifest`);
    assert.notEqual(item.qa.transformPreserved, false, `${item.client}/${item.candidate} does not preserve its declared transform`);
    for (const asset of [item.source, item.clean, item.comparison, item.overlay]) {
      const file = localFile(asset);
      assert.ok(fs.existsSync(file), `Missing file: ${file}`);
      assert.ok(fs.statSync(file).size > 0, `Empty file: ${file}`);
    }
    for (const file of [item.dxf, item.png, item.svg]) {
      const absolute = path.join(root, file);
      assert.ok(fs.existsSync(absolute), `Missing editable asset: ${absolute}`);
      assert.ok(fs.statSync(absolute).size > 0, `Empty editable asset: ${absolute}`);
    }
  }

  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch(edge ? { executablePath: edge, headless: true } : { headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const failed = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => response.status() >= 400 && failed.push(`${response.status()} ${response.url()}`));

    for (const item of candidates) {
      for (const asset of [item.source, item.clean, item.comparison, item.overlay]) {
        await assertHttpAsset(page.request, asset);
      }
      await assertHttpAsset(page.request, `/factory/${item.client}/${item.candidate}/clean/mimic-clean.dxf`);
      await assertHttpAsset(page.request, `/factory/${item.client}/${item.candidate}/clean/mimic-clean.svg`);
    }

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    assert.ok(page.url().endsWith("/review-all/"), "Root did not route to the unified review portal");
    assert.equal(await page.locator("#client option").count(), 11, "Not all clients are listed");

    for (const client of readyClients) {
      await page.locator("#client").selectOption(client.name);
      await page.waitForFunction(() => {
        const image = document.querySelector("#image");
        return image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
      });
      assert.equal(await page.locator("#candidate option").count(), client.candidates.length, `${client.name} candidate count mismatch`);
      const box = await page.locator("#image").boundingBox();
      assert.ok(box && box.width > 0 && box.height > 0, `${client.name} review image is not visible`);
      await page.screenshot({ path: path.join(screenshotDir, `${client.name.toLowerCase()}-review.png`), fullPage: true });
    }

    for (const client of blockedClients) {
      await page.locator("#client").selectOption(client.name);
      assert.match(await page.locator("#status").innerText(), /BLOCKED_SOURCE_MISSING/);
      assert.match(await page.locator("#meta").innerText(), /Geometry was not invented/);
      assert.equal(await page.locator("#image").getAttribute("src"), null, `${client.name} should not have a fallback image`);
    }

    await page.locator("#client").selectOption("MTB");
    await page.locator("#candidate").selectOption("level-01");
    await page.locator("#view").selectOption("clean");
    await page.waitForFunction(() => document.querySelector("#image")?.naturalWidth > 0);
    assert.match(await page.locator("#meta").innerText(), /Runtime pins: excluded/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    assert.equal(overflow, false, "Review portal has horizontal overflow");
    assert.deepEqual(errors, [], `Console errors: ${errors.join(" | ")}`);
    assert.deepEqual(failed, [], `Failed requests: ${failed.join(" | ")}`);

    console.log(JSON.stringify({
      ok: true,
      url: page.url(),
      candidateCount: candidates.length,
      readyClients: readyClients.map((client) => client.name),
      blockedClients: blockedClients.map((client) => client.name),
      httpAssetsChecked: candidates.length * 6,
      screenshots: readyClients.map((client) => path.join(screenshotDir, `${client.name.toLowerCase()}-review.png`)),
      consoleErrors: errors,
      failedRequests: failed,
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});

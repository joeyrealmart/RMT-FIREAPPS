import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";

const labRoot = resolve("outputs/rmt-mimic-lab");
const factoryRoot = resolve("outputs/rmt-mimic-factory");
const host = process.env.RMT_MIMIC_LAB_HOST || "127.0.0.1";
const port = Number(process.env.RMT_MIMIC_LAB_PORT || 8031);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".dxf": "application/dxf" };
const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/") {
    response.writeHead(302, { Location: "/review-all/", "Cache-Control": "no-store" }).end();
    return;
  }
  const requestPath = decodeURIComponent(
    url.pathname === "/LTK/review/"
      ? "/LTK/review/index.html"
      : url.pathname === "/review-all/"
        ? "/review-all/index.html"
        : url.pathname,
  );
  const isFactoryAsset = requestPath === "/factory" || requestPath.startsWith("/factory/");
  const root = isFactoryAsset ? factoryRoot : labRoot;
  const relativePath = isFactoryAsset ? requestPath.slice("/factory".length) || "/" : requestPath;
  const candidate = resolve(root, `.${normalize(relativePath)}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(candidate);
    response.writeHead(200, { "Content-Type": mime[extname(candidate).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : body);
  }
  catch { response.writeHead(404).end("Not found"); }
});
server.listen(port, host, () => console.log(`RMT-MIMIC-LAB review listening on http://${host}:${port}/`));

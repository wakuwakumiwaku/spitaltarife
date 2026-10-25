import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runtimeFiles } from "./files.mjs";
const project = fileURLToPath(new URL("../", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const headers = {
  "cache-control": "no-cache",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
export function createAppServer({
  root = path.join(project, "dist"),
  basePath = "/",
} = {}) {
  if (
    typeof basePath !== "string" ||
    !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)
  )
    throw Error("Invalid basePath");
  return http.createServer(async (req, res) => {
    const send = (status, text) => {
      res.writeHead(status, {
        ...headers,
        "content-type": "text/plain; charset=utf-8",
      });
      res.end(req.method === "HEAD" ? undefined : text);
    };
    if (!["GET", "HEAD"].includes(req.method)) {
      res.setHeader("Allow", "GET, HEAD");
      send(405, "Method not allowed");
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://127.0.0.1").pathname,
      );
    } catch {
      send(400, "Bad URL");
      return;
    }
    if (!pathname.startsWith(basePath)) {
      send(404, "Not found");
      return;
    }
    const relative = pathname.slice(basePath.length) || "index.html";
    if (!Object.hasOwn(runtimeFiles, relative)) {
      send(404, "Not found");
      return;
    }
    try {
      const resolvedRoot = await realpath(root),
        target = await realpath(path.join(root, relative));
      if (!target.startsWith(resolvedRoot + path.sep)) {
        send(404, "Not found");
        return;
      }
      const bytes = await readFile(target);
      res.writeHead(200, {
        ...headers,
        "content-type":
          types[path.extname(relative)] || "application/octet-stream",
        "content-length": bytes.length,
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch {
      send(404, "Not found");
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const port = Number(process.env.PORT || 3019);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("Invalid port");
  createAppServer({ basePath: process.env.BASE_PATH || "/" }).listen(
    port,
    "127.0.0.1",
    () =>
      console.log(
        `Spitaltarife: http://127.0.0.1:${port}${process.env.BASE_PATH || "/"}`,
      ),
  );
}

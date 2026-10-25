import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  rm,
  readdir,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runtimeFiles } from "../scripts/files.mjs";
import { build, project } from "../scripts/build.mjs";
import { createAppServer } from "../scripts/serve.mjs";
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "spitaltarife-test-"));
  for (const source of Object.values(runtimeFiles)) {
    const target = path.join(root, source);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(project, source), target);
  }
  return root;
}
async function tree(root, prefix = "") {
  let out = [];
  for (const d of await readdir(root, { withFileTypes: true })) {
    const r = prefix + d.name;
    if (d.isDirectory())
      out.push(...(await tree(path.join(root, d.name), r + "/")));
    else out.push(r);
  }
  return out.sort();
}
async function snapshot(root) {
  return Object.fromEntries(
    await Promise.all(
      (await tree(root)).map(async (f) => [
        f,
        (await readFile(path.join(root, f))).toString("base64"),
      ]),
    ),
  );
}
test("explicit nine-file build; private/source/public canaries never copied", async () => {
  const root = await fixture();
  try {
    for (const file of [
      "sources/private.txt",
      "sources/raw-catalog.xlsx",
      ".local/catalogs/private-main.json",
      ".local/secret.txt",
      "public/canary.txt",
    ]) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), "PRIVATE CANARY");
    }
    const files = await build({ root });
    assert.equal(files.length, 9);
    assert.deepEqual(
      await tree(path.join(root, "dist")),
      Object.keys(runtimeFiles).sort(),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("missing, malformed, schema-invalid or symlinked input preserves last good build", async () => {
  const root = await fixture();
  try {
    await build({ root });
    const before = await snapshot(path.join(root, "dist"));
    const file = path.join(root, "public/data/catalog.json"),
      original = await readFile(file);
    for (const content of ["{broken", JSON.stringify({ schema: 1 })]) {
      await writeFile(file, content);
      await assert.rejects(build({ root }));
      assert.deepEqual(await snapshot(path.join(root, "dist")), before);
    }
    await rm(file);
    await assert.rejects(build({ root }));
    assert.deepEqual(await snapshot(path.join(root, "dist")), before);
    await writeFile(file, original);
    const js = path.join(root, "src/app.js");
    await rm(js);
    await symlink(path.join(project, "src/app.js"), js);
    await assert.rejects(build({ root }));
    assert.deepEqual(await snapshot(path.join(root, "dist")), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("server supports repository base path, bytes, HEAD, deny private/traversal and writes", async () => {
  const root = await fixture();
  let server;
  try {
    await build({ root });
    await writeFile(path.join(root, "dist", "private.txt"), "PRIVATE");
    server = createAppServer({
      root: path.join(root, "dist"),
      basePath: "/spitaltarife/",
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    for (const dest of Object.keys(runtimeFiles)) {
      const r = await fetch(base + "/spitaltarife/" + dest);
      assert.equal(r.status, 200, dest);
      assert.deepEqual(
        Buffer.from(await r.arrayBuffer()),
        await readFile(path.join(root, "dist", dest)),
      );
      assert.match(
        r.headers.get("content-security-policy"),
        /object-src 'none'/,
      );
    }
    const head = await fetch(base + "/spitaltarife/", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    for (const url of [
      "/",
      "/spitaltarife/private.txt",
      "/spitaltarife/.local/secret",
      "/spitaltarife/../package.json",
      "/spitaltarife/%2e%2e/package.json",
      "/spitaltarife/src/%2e%2e/%2e%2e/package.json",
    ])
      assert.equal((await fetch(base + url)).status, 404, url);
    assert.equal(
      (await fetch(base + "/spitaltarife/", { method: "POST" })).status,
      405,
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

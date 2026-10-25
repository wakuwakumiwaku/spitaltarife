import {
  readFile,
  lstat,
  realpath,
  mkdir,
  mkdtemp,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runtimeFiles } from "./files.mjs";
import { validateLocalSchema } from "./validate-local-schema.mjs";
import { validatePublicData } from "../src/domain.js";
export const project = fileURLToPath(new URL("../", import.meta.url));
export async function validateInputs(root = project) {
  const base = await realpath(root),
    buffers = new Map();
  for (const [destination, source] of Object.entries(runtimeFiles)) {
    if (destination.startsWith("/") || destination.split("/").includes(".."))
      throw Error("Unsafe runtime destination");
    const file = path.join(root, source),
      stat = await lstat(file),
      resolved = await realpath(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      !resolved.startsWith(base + path.sep)
    )
      throw Error("Unsafe runtime source: " + source);
    buffers.set(destination, await readFile(file));
  }
  const read = (n) => JSON.parse(buffers.get("data/" + n + ".json").toString());
  validatePublicData(
    read("catalog"),
    read("provenance"),
    read("import-report"),
  );
  const schema = read("local-catalog.schema");
  validateLocalSchema(schema);
  if (
    schema?.$id !==
      "https://wakuwakumiwaku.github.io/spitaltarife/data/local-catalog.schema.json" ||
    schema.type !== "object"
  )
    throw Error("Local schema missing");
  const html = buffers.get("index.html").toString();
  if (
    !html.includes('id="search"') ||
    !html.includes('id="results"') ||
    !html.includes("./src/app.js")
  )
    throw Error("Runtime hooks missing");
  return buffers;
}
export async function build({ root = project } = {}) {
  const buffers = await validateInputs(root); // Every read and schema check BEFORE touching the old output.
  const scratch = path.join(root, ".local");
  await mkdir(scratch, { recursive: true });
  const stage = await mkdtemp(path.join(scratch, "build-")),
    dist = path.join(root, "dist"),
    backup = stage + "-previous";
  let hadOld = false;
  try {
    for (const [file, content] of buffers) {
      const target = path.join(stage, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    try {
      await rename(dist, backup);
      hadOld = true;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    try {
      await rename(stage, dist);
    } catch (e) {
      if (hadOld) await rename(backup, dist);
      throw e;
    }
    if (hadOld) await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  return [...buffers.keys()];
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const files = await build();
  console.log(`Build validiert: ${files.length} explizite Runtime-Dateien.`);
}

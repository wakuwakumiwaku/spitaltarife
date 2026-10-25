// Project-supported JSON Schema subset, not a full Draft 2020-12 meta-validator.
// Validate definitions only; src/domain.js remains the catalog-instance validator.
const types = new Set(["null", "boolean", "object", "array", "number", "integer", "string"]);
const strings = ["$id", "title", "description", "$comment"];
const counts = ["minLength", "maxLength", "minItems", "maxItems", "minProperties", "maxProperties"];
const numbers = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"];
const children = ["items", "additionalProperties", "not", "if", "then", "else"];
const combinators = ["allOf", "anyOf", "oneOf"];
const keywords = new Set([
  "$schema", ...strings, "type", "required", "properties", "enum", "const",
  "pattern", "format", "uniqueItems", ...counts, ...numbers, ...children, ...combinators,
]);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const scalar = (v) => v === null || ["string", "boolean"].includes(typeof v) || (typeof v === "number" && Number.isFinite(v));
const own = (o, k) => Object.hasOwn(o, k);
function fail(at, reason) { throw Error(`Invalid local schema at ${at}: ${reason}`); }
function uniqueArray(value, at, member) {
  if (!Array.isArray(value) || !value.every(member)) fail(at, "invalid array or member type");
  const keys = value.map((v) => JSON.stringify(v));
  if (new Set(keys).size !== keys.length) fail(at, "duplicate array member");
}
export function validateLocalSchema(schema) {
  function visit(node, at, depth) {
    if (depth > 100) fail(at, "supported schema nesting limit (100) exceeded");
    if (typeof node === "boolean") return;
    if (!object(node)) fail(at, "expected schema object or boolean");
    for (const k of Object.keys(node)) if (!keywords.has(k)) fail(`${at}/${k}`, "unsupported keyword");
    for (const k of strings) if (own(node, k) && typeof node[k] !== "string") fail(`${at}/${k}`, "expected primitive string");
    if (own(node, "$schema") && node.$schema !== "https://json-schema.org/draft/2020-12/schema") fail(`${at}/$schema`, "unsupported dialect");
    if (own(node, "type")) {
      const names = Array.isArray(node.type) ? node.type : [node.type];
      uniqueArray(names, `${at}/type`, (v) => typeof v === "string" && types.has(v));
      if (!names.length) fail(`${at}/type`, "type array must be nonempty");
    }
    if (own(node, "required")) uniqueArray(node.required, `${at}/required`, (v) => typeof v === "string");
    if (own(node, "enum")) {
      uniqueArray(node.enum, `${at}/enum`, scalar);
      if (!node.enum.length) fail(`${at}/enum`, "enum must be nonempty; only primitive JSON members supported");
    }
    if (own(node, "const") && !scalar(node.const)) fail(`${at}/const`, "only primitive JSON const supported");
    if (own(node, "pattern")) {
      if (typeof node.pattern !== "string") fail(`${at}/pattern`, "expected primitive string, no regex coercion");
      try { new RegExp(node.pattern); } catch { fail(`${at}/pattern`, "pattern does not compile as an ECMAScript RegExp"); }
    }
    if (own(node, "format") && (typeof node.format !== "string" || !["date", "uri"].includes(node.format))) fail(`${at}/format`, "only date and uri annotations supported");
    if (own(node, "uniqueItems") && typeof node.uniqueItems !== "boolean") fail(`${at}/uniqueItems`, "expected boolean");
    for (const k of counts) if (own(node, k) && (!Number.isSafeInteger(node[k]) || node[k] < 0)) fail(`${at}/${k}`, "expected nonnegative safe integer");
    for (const [lo, hi] of [["minLength", "maxLength"], ["minItems", "maxItems"], ["minProperties", "maxProperties"]]) {
      if (own(node, lo) && own(node, hi) && node[lo] > node[hi]) fail(at, `${lo} exceeds ${hi}`);
    }
    for (const k of numbers) if (own(node, k) && (typeof node[k] !== "number" || !Number.isFinite(node[k]))) fail(`${at}/${k}`, "expected finite primitive number");
    if (own(node, "multipleOf") && node.multipleOf <= 0) fail(`${at}/multipleOf`, "expected positive number");
    for (const lo of ["minimum", "exclusiveMinimum"]) for (const hi of ["maximum", "exclusiveMaximum"]) {
      if (own(node, lo) && own(node, hi) && (node[lo] > node[hi] || (node[lo] === node[hi] && (lo === "exclusiveMinimum" || hi === "exclusiveMaximum")))) fail(at, `${lo}/${hi} leave no numeric interval`);
    }
    if (own(node, "properties")) {
      if (!object(node.properties)) fail(`${at}/properties`, "expected property-to-schema object");
      for (const [key, value] of Object.entries(node.properties)) visit(value, `${at}/properties/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, depth + 1);
    }
    for (const k of children) if (own(node, k)) visit(node[k], `${at}/${k}`, depth + 1);
    for (const k of combinators) if (own(node, k)) {
      if (!Array.isArray(node[k]) || !node[k].length) fail(`${at}/${k}`, "expected nonempty schema array");
      node[k].forEach((value, i) => visit(value, `${at}/${k}/${i}`, depth + 1));
    }
  }
  if (!object(schema)) fail("#", "shipped root must be an object schema");
  visit(schema, "#", 0);
}

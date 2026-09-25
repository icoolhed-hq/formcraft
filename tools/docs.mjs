/**
 * Prints a Markdown catalogue of every registered element, generated from the
 * registry itself so documentation can never drift from the code.
 *
 *   node docs.mjs            # grouped tables
 *   node docs.mjs --counts   # one-line summary
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFormBuilder } from "./test/env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const M = loadFormBuilder({
  core: path.join(here, "..", "FormBuilder.jsx"),
  exports: ["TYPES", "TYPE_ORDER", "GROUPS", "TEMPLATES", "createField", "emptyValueFor"],
});

const describeValue = (def, field) => {
  if (def.kind === "static") return "—";
  if (def.kind === "action") return "—";
  const empty = M.emptyValueFor(field);
  if (empty === null) return def.settings.some((s) => s.prop === "accept") || /file|image|drop/i.test(def.type) ? "File" : "value or `null`";
  if (Array.isArray(empty)) return "array";
  if (typeof empty === "boolean") return "boolean";
  if (typeof empty === "number") return "number";
  if (typeof empty === "object") return "`{ " + Object.keys(empty).join(", ") + " }`";
  return "string";
};

const defs = M.TYPE_ORDER.map((t) => M.TYPES[t]);
if (process.argv.includes("--counts")) {
  const groups = M.GROUPS.filter((g) => defs.some((d) => d.group === g));
  console.log(defs.length + " elements in " + groups.length + " groups, " + M.TEMPLATES.length + " templates");
  process.exit(0);
}

for (const group of M.GROUPS) {
  const items = defs.filter((d) => d.group === group);
  if (!items.length) continue;
  console.log("#### " + group + " (" + items.length + ")\n");
  console.log("| Element | What it is | Value | Settings |");
  console.log("| --- | --- | --- | --- |");
  items.forEach((def) => {
    const field = M.createField(def.type, []);
    const settings = def.settings.map((s) => s.label).join(", ") || "—";
    console.log("| **" + def.name + "** `" + def.type + "` | " + def.blurb + " | " + describeValue(def, field) + " | " + settings + " |");
  });
  console.log("");
}

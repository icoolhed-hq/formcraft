/**
 * Prints the exported React component for a set of element types — handy for
 * reading generated code while building or reviewing an element.
 *
 *   node test/export.mjs --only rating,nps [--theme dark|light|auto]
 *                        [--core ../FormBuilder.jsx] [--types file.jsx] [--schema]
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { assembleSource } from "../assemble.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Babel = require("@babel/standalone");

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? null : argv[i + 1];
};
const list = (value) => (value ? value.split(",").map((s) => s.trim()).filter(Boolean) : []);

const core = path.resolve(arg("core") || path.join(here, "..", "..", "FormBuilder.jsx"));
const types = list(arg("types")).map((p) => path.resolve(p));
const { source, problems } = assembleSource({ core, types });
if (problems.length) {
  console.error("assemble problems:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
const code = Babel.transform(source + "\nexport { TYPES, TYPE_ORDER, createField, generateReactCode, buildSchema };", {
  babelrc: false,
  configFile: false,
  sourceType: "module",
  presets: [["react", { runtime: "classic" }]],
  plugins: ["transform-modules-commonjs"],
}).code;
const module = { exports: {} };
const modules = { react: require("react"), "react-dom": require("react-dom"), "lucide-react": require("lucide-react") };
new Function("require", "module", "exports", code)((n) => modules[n], module, module.exports);
const M = module.exports;

const wanted = list(arg("only"));
const unknown = wanted.filter((t) => !M.TYPES[t]);
if (unknown.length) {
  console.error("unknown types: " + unknown.join(", ") + "\nknown: " + M.TYPE_ORDER.join(", "));
  process.exit(1);
}
const fields = [];
(wanted.length ? wanted : M.TYPE_ORDER).forEach((type) => {
  const f = M.createField(type, fields);
  if (M.TYPES[type].common.indexOf("required") !== -1) f.required = true;
  fields.push(f);
});
if (!fields.some((f) => f.type === "submit")) fields.push(M.createField("submit", fields));
const meta = { title: "Preview export", description: "", theme: arg("theme") || "dark" };
console.log(argv.includes("--schema") ? JSON.stringify(M.buildSchema(meta, fields), null, 2) : M.generateReactCode(meta, fields));

/**
 * assemble.mjs — builds the single-file FormBuilder.jsx.
 *
 *  - Splices element-definition files in front of the
 *    "end of element definitions" marker, and builder components in front of
 *    the "end of builder components" marker.
 *  - Recomputes the lucide-react and react named imports from the identifiers
 *    the file actually references (Babel scope analysis, not regex).
 *  - Reports free identifiers that are neither imported nor known globals, and
 *    lucide icon names that would shadow a browser global (File, Image, Map…).
 *
 * CLI:
 *   node assemble.mjs --out ../FormBuilder.jsx [--core ../FormBuilder.jsx]
 *                     [--types a.jsx,b.jsx] [--components c.jsx] [--merge]
 *   --merge omits the per-file banners (use it for the permanent merge).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Babel = require("@babel/standalone");
const lucideReact = require("lucide-react");

export const TYPES_MARKER = "/* ---- end of element definitions ---- */";
export const COMPONENTS_MARKER = "/* ---- end of builder components ---- */";

const REACT_EXPORTS = new Set([
  "useCallback",
  "useContext",
  "useDeferredValue",
  "useEffect",
  "useId",
  "useImperativeHandle",
  "useLayoutEffect",
  "useMemo",
  "useReducer",
  "useRef",
  "useState",
  "useSyncExternalStore",
  "useTransition",
  "forwardRef",
  "memo",
  "Fragment",
  "createContext",
]);

/** Names a browser page can reference without importing. */
const BROWSER_GLOBALS = new Set([
  ...Object.getOwnPropertyNames(globalThis),
  "window", "document", "navigator", "localStorage", "sessionStorage", "location", "history",
  "File", "FileList", "FileReader", "Blob", "Image", "Option", "Audio", "URL", "URLSearchParams",
  "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "PointerEvent", "DragEvent", "InputEvent",
  "HTMLElement", "HTMLInputElement", "HTMLCanvasElement", "Node", "Element", "DataTransfer",
  "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia",
  "ResizeObserver", "IntersectionObserver", "MutationObserver", "CSS", "Intl", "alert", "confirm",
  "prompt", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask",
  "structuredClone", "fetch", "crypto", "performance", "screen", "devicePixelRatio", "React",
]);

const LUCIDE_BLOCK = /import\s*\{[^}]*\}\s*from\s*["']lucide-react["'];?/;
const REACT_LINE = /import\s+React\s*,\s*\{[^}]*\}\s*from\s*["']react["'];?/;

function splice(source, marker, files, what, merge) {
  if (!files.length) return source;
  if (!source.includes(marker)) throw new Error("assemble: " + what + " marker not found: " + marker);
  const chunks = files.map((file) => {
    const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "").trim();
    return (merge ? "" : "/* ---- from " + path.basename(file) + " ---- */\n\n") + text + "\n";
  });
  return source.replace(marker, chunks.join("\n") + "\n" + marker);
}

/**
 * Free (unbound) identifiers referenced anywhere in the source. Names used as
 * JSX tags are also collected separately: <File /> means the icon, while
 * `value instanceof File` means the browser global.
 */
export function freeIdentifiers(source, jsxTags = new Set()) {
  const free = new Set();
  const collector = () => ({
    visitor: {
      ReferencedIdentifier(p) {
        const name = p.node.name;
        if (p.scope.hasBinding(name, true)) return;
        free.add(name);
        if (p.isJSXIdentifier()) jsxTags.add(name);
      },
    },
  });
  Babel.transform(source, {
    code: false,
    ast: false,
    babelrc: false,
    configFile: false,
    sourceType: "module",
    parserOpts: { plugins: ["jsx"] },
    plugins: [collector],
  });
  return free;
}

/**
 * Returns { source, icons, reactNames, problems }.
 * `problems` lists unknown identifiers and icon/global collisions.
 */
export function assembleSource({ core, types = [], components = [], merge = false }) {
  let source = fs.readFileSync(core, "utf8").replace(/^﻿/, "");
  source = splice(source, TYPES_MARKER, types, "types", merge);
  source = splice(source, COMPONENTS_MARKER, components, "components", merge);

  if (!LUCIDE_BLOCK.test(source)) throw new Error("assemble: lucide-react import block not found");
  if (!REACT_LINE.test(source)) throw new Error("assemble: `import React, { … } from \"react\"` line not found");

  /* Analyse with both imports emptied, so every icon/hook shows up as free. */
  const probe = source.replace(LUCIDE_BLOCK, "").replace(REACT_LINE, 'import React from "react";');
  const jsxTags = new Set();
  const free = freeIdentifiers(probe, jsxTags);

  const icons = [];
  const reactNames = [];
  const problems = [];
  Array.from(free)
    .sort()
    .forEach((name) => {
      if (REACT_EXPORTS.has(name)) reactNames.push(name);
      else if (lucideReact[name] && /^[A-Z]/.test(name)) {
        if (BROWSER_GLOBALS.has(name) && !jsxTags.has(name)) return; // the global, not the icon
        if (BROWSER_GLOBALS.has(name)) {
          problems.push(
            "'" + name + "' is both a lucide icon and a browser global — importing it would shadow the global. " +
              "Use the '" + name + "Icon' alias for the icon, or rename the local usage."
          );
        } else icons.push(name);
      } else if (!BROWSER_GLOBALS.has(name)) {
        problems.push("'" + name + "' is referenced but never defined or imported");
      }
    });

  const iconBlock = icons.length
    ? "import {\n" + icons.map((n) => "  " + n + ",").join("\n") + '\n} from "lucide-react";'
    : "";
  source = source.replace(LUCIDE_BLOCK, iconBlock);
  source = source.replace(REACT_LINE, "import React, { " + reactNames.join(", ") + ' } from "react";');
  return { source, icons, reactNames, problems };
}

/* ---- CLI ---- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => {
    const i = process.argv.indexOf("--" + name);
    return i === -1 ? null : process.argv[i + 1];
  };
  const list = (value) => (value ? value.split(",").map((p) => path.resolve(p.trim())).filter(Boolean) : []);
  const core = path.resolve(arg("core") || path.join(here, "..", "FormBuilder.jsx"));
  const out = path.resolve(arg("out") || core);
  const merge = process.argv.includes("--merge");
  const result = assembleSource({ core, types: list(arg("types")), components: list(arg("components")), merge });
  if (result.problems.length) {
    console.error("assemble: problems found:\n  - " + result.problems.join("\n  - "));
    process.exit(1);
  }
  fs.writeFileSync(out, result.source, "utf8");
  console.log(
    "assembled " + path.relative(process.cwd(), out) + ": " + result.source.split("\n").length + " lines, " +
      result.icons.length + " icons, react { " + result.reactNames.join(", ") + " }"
  );
}

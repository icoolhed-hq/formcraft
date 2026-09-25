/**
 * build-preview.mjs
 * Wraps the canonical FormBuilder.jsx into a standalone HTML page:
 *  - React 18 UMD, with the JSX compiled here at build time (visitors never
 *    download Babel)
 *  - Tailwind Play CDN
 *  - a lucide-react stand-in built from the real lucide icon data (installed
 *    `lucide` package), for exactly the icons the component imports
 * The component source itself is copied verbatim; only the import statements
 * are swapped for globals, so the preview can never drift from the source.
 *
 * Requires the tooling install:  npm --prefix tools install
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const require = createRequire(import.meta.url);
const lucide = require("lucide");
const Babel = require("@babel/standalone");

const source = fs.readFileSync(path.join(root, "FormBuilder.jsx"), "utf8");

const lucideBlock = source.match(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["'];?/);
const reactLine = source.match(/import\s+React\s*,\s*\{([^}]*)\}\s*from\s*["']react["'];?/);
if (!reactLine) throw new Error("build-preview: React import line not found");

const names = (list) => list.split(",").map((s) => s.trim()).filter(Boolean);
const iconNames = lucideBlock ? names(lucideBlock[1]) : [];
const hookNames = names(reactLine[1]);
const typeCount = (source.match(/^defineType\(\{/gm) || []).length;

/* lucide-react aliases (FooIcon, LucideFoo) resolve to the same vanilla node. */
const ICONS = {};
iconNames.forEach((name) => {
  const node = lucide[name] || lucide[name.replace(/Icon$/, "")] || lucide[name.replace(/^Lucide/, "")];
  if (!Array.isArray(node)) throw new Error("build-preview: no lucide icon data for '" + name + "'");
  ICONS[name] = node;
});

const kebab = (name) =>
  name
    .replace(/Icon$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

const body = source
  .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
  .replace("export default function FormBuilder", "function FormBuilder")
  .trim();

const appSource = [
  "const { " + hookNames.join(", ") + " } = React;",
  "const { " + iconNames.join(", ") + " } = LucideShim;",
  "",
  body,
  "",
  'ReactDOM.createRoot(document.getElementById("root")).render(<FormBuilder />);',
].join("\n");

/* JSX → plain JS. Only the JSX transform runs, exactly what the browser build used to do. */
const compiled = Babel.transform(appSource, {
  babelrc: false,
  configFile: false,
  sourceType: "script",
  presets: [["react", { runtime: "classic" }]],
}).code.replace(/<\/script/gi, "<\\/script");

/**
 * Pinned CDN scripts with Subresource Integrity, so a compromised CDN cannot
 * swap the code. Regenerate a hash after changing a version:
 *   curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
 * The Tailwind Play CDN is unversioned by design, so it cannot carry a hash.
 */
const CDN = [
  {
    src: "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
    integrity: "sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z",
  },
  {
    src: "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
    integrity: "sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1",
  },
];
const scriptTag = ({ src, integrity }) => `<script src="${src}" integrity="${integrity}" crossorigin="anonymous"></script>`;

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#818CF8"/><stop offset="1" stop-color="#4F46E5"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M9 11h14M9 16h9M9 21h5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>'
  );

const html = `<meta charset="utf-8">
<title>Formcraft Builder</title>
<meta name="description" content="Build forms visually from ${typeCount} elements, test them live, and export clean React + Tailwind code.">
<meta name="theme-color" content="#0A0C12">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Sans:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root { color-scheme: dark; }
  html, body { background: #0A0C12; }
  body { margin: 0; font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; color: #E6E9F2; overflow-x: hidden; }
  #root { min-height: 100vh; }
  .fc-boot { display: flex; min-height: 100vh; align-items: center; justify-content: center; color: #4b5670; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
</style>

<div id="root"><div class="fc-boot">Loading Formcraft…</div></div>
<noscript><p style="padding:2rem;text-align:center;color:#8B93A7">Formcraft needs JavaScript to run.</p></noscript>

${CDN.map(scriptTag).join("\n")}
<script src="https://cdn.tailwindcss.com"></script>
<script>
  /* lucide-react stand-in: same props, same markup, same classes. */
  var ICON_NODES = ${JSON.stringify(ICONS)};
  var ICON_CLASSES = ${JSON.stringify(Object.fromEntries(iconNames.map((n) => [n, "lucide lucide-" + kebab(n)])))};
  var LucideShim = {};
  Object.keys(ICON_NODES).forEach(function (name) {
    var nodes = ICON_NODES[name];
    var Icon = React.forwardRef(function (props, ref) {
      props = props || {};
      var size = props.size == null ? 24 : props.size;
      var rest = {};
      Object.keys(props).forEach(function (k) {
        if (["size", "color", "strokeWidth", "absoluteStrokeWidth", "className", "children"].indexOf(k) === -1) rest[k] = props[k];
      });
      var stroke = props.strokeWidth == null ? 2 : props.strokeWidth;
      var attrs = Object.assign(
        {
          ref: ref,
          xmlns: "http://www.w3.org/2000/svg",
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: props.color || "currentColor",
          strokeWidth: props.absoluteStrokeWidth ? (Number(stroke) * 24) / Number(size) : stroke,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          className: [ICON_CLASSES[name], props.className].filter(Boolean).join(" ")
        },
        rest
      );
      return React.createElement(
        "svg",
        attrs,
        nodes.map(function (node, i) {
          return React.createElement(node[0], Object.assign({ key: i }, node[1]));
        }),
        props.children
      );
    });
    Icon.displayName = name;
    LucideShim[name] = Icon;
  });
</script>

<script>
${compiled}
</script>
`;

fs.writeFileSync(path.join(root, "preview.html"), html, "utf8");
console.log("preview.html written: " + Math.round(html.length / 1024) + " KB, " + iconNames.length + " icons");

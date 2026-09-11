/**
 * build-preview.mjs
 * Wraps the canonical FormBuilder.jsx into a standalone HTML page:
 *  - React 18 UMD + Babel standalone (JSX compiled in the browser)
 *  - Tailwind Play CDN
 *  - a lucide-react shim built from lucide's own icon path data
 * The component source itself is copied verbatim; only the import statements
 * are swapped for globals, so the preview can never drift from the source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const source = fs.readFileSync(path.join(root, "FormBuilder.jsx"), "utf8");

const body = source
  .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
  .replace("export default function FormBuilder", "function FormBuilder")
  .trim();

const ICONS = {
  AlignLeft: [["path", { d: "M21 6H3" }], ["path", { d: "M15 12H3" }], ["path", { d: "M17 18H3" }]],
  ArrowDown: [["path", { d: "M12 5v14" }], ["path", { d: "m19 12-7 7-7-7" }]],
  ArrowUp: [["path", { d: "m5 12 7-7 7 7" }], ["path", { d: "M12 19V5" }]],
  Braces: [
    ["path", { d: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" }],
    ["path", { d: "M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" }],
  ],
  CalendarDays: [
    ["path", { d: "M8 2v4" }],
    ["path", { d: "M16 2v4" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }],
    ["path", { d: "M3 10h18" }],
    ["path", { d: "M8 14h.01" }],
    ["path", { d: "M12 14h.01" }],
    ["path", { d: "M16 14h.01" }],
    ["path", { d: "M8 18h.01" }],
    ["path", { d: "M12 18h.01" }],
  ],
  Check: [["path", { d: "M20 6 9 17l-5-5" }]],
  Clock: [["circle", { cx: "12", cy: "12", r: "10" }], ["path", { d: "M12 6v6l4 2" }]],
  Contrast: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 18a6 6 0 0 0 0-12v12z", fill: "currentColor" }],
  ],
  Heading: [["path", { d: "M6 12h12" }], ["path", { d: "M6 20V4" }], ["path", { d: "M18 20V4" }]],
  KeyRound: [
    [
      "path",
      {
        d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
      },
    ],
    ["circle", { cx: "16.5", cy: "7.5", r: ".5", fill: "currentColor" }],
  ],
  Link2: [
    ["path", { d: "M9 17H7A5 5 0 0 1 7 7h2" }],
    ["path", { d: "M15 7h2a5 5 0 1 1 0 10h-2" }],
    ["path", { d: "M8 12h8" }],
  ],
  ListChecks: [
    ["path", { d: "m3 17 2 2 4-4" }],
    ["path", { d: "m3 7 2 2 4-4" }],
    ["path", { d: "M13 6h8" }],
    ["path", { d: "M13 12h8" }],
    ["path", { d: "M13 18h8" }],
  ],
  Minus: [["path", { d: "M5 12h14" }]],
  Phone: [
    [
      "path",
      {
        d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
      },
    ],
  ],
  SlidersHorizontal: [
    ["path", { d: "M21 4h-7" }],
    ["path", { d: "M10 4H3" }],
    ["path", { d: "M21 12h-9" }],
    ["path", { d: "M8 12H3" }],
    ["path", { d: "M21 20h-5" }],
    ["path", { d: "M12 20H3" }],
    ["path", { d: "M14 2v4" }],
    ["path", { d: "M8 10v4" }],
    ["path", { d: "M16 18v4" }],
  ],
  Undo2: [
    ["path", { d: "M9 14 4 9l5-5" }],
    ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" }],
  ],
  Upload: [
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["path", { d: "M17 8l-5-5-5 5" }],
    ["path", { d: "M12 3v12" }],
  ],
  ChevronDown: [["path", { d: "m6 9 6 6 6-6" }]],
  ChevronUp: [["path", { d: "m18 15-6-6-6 6" }]],
  CircleDot: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["circle", { cx: "12", cy: "12", r: "1" }],
  ],
  Code2: [
    ["path", { d: "m18 16 4-4-4-4" }],
    ["path", { d: "m6 8-4 4 4 4" }],
    ["path", { d: "m14.5 4-5 16" }],
  ],
  Copy: [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }],
  ],
  Eye: [
    ["path", { d: "M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" }],
    ["circle", { cx: "12", cy: "12", r: "3" }],
  ],
  GripVertical: [
    ["circle", { cx: "9", cy: "12", r: "1" }],
    ["circle", { cx: "9", cy: "5", r: "1" }],
    ["circle", { cx: "9", cy: "19", r: "1" }],
    ["circle", { cx: "15", cy: "12", r: "1" }],
    ["circle", { cx: "15", cy: "5", r: "1" }],
    ["circle", { cx: "15", cy: "19", r: "1" }],
  ],
  Hash: [
    ["path", { d: "M4 9h16" }],
    ["path", { d: "M4 15h16" }],
    ["path", { d: "M10 3 8 21" }],
    ["path", { d: "m16 3-2 18" }],
  ],
  LayoutGrid: [
    ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1" }],
    ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1" }],
    ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1" }],
    ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1" }],
  ],
  Mail: [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" }],
  ],
  Plus: [["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }]],
  RotateCcw: [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
    ["path", { d: "M3 3v5h5" }],
  ],
  Send: [["path", { d: "m22 2-7 20-4-9-9-4Z" }], ["path", { d: "M22 2 11 13" }]],
  Settings2: [
    ["path", { d: "M20 7h-9" }],
    ["path", { d: "M14 17H5" }],
    ["circle", { cx: "17", cy: "17", r: "3" }],
    ["circle", { cx: "7", cy: "7", r: "3" }],
  ],
  Sparkles: [
    [
      "path",
      {
        d: "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z",
      },
    ],
    ["path", { d: "M5 3v4" }],
    ["path", { d: "M19 17v4" }],
    ["path", { d: "M3 5h4" }],
    ["path", { d: "M17 19h4" }],
  ],
  ToggleRight: [
    ["rect", { width: "20", height: "12", x: "2", y: "6", rx: "6", ry: "6" }],
    ["circle", { cx: "16", cy: "12", r: "2" }],
  ],
  Trash2: [
    ["path", { d: "M3 6h18" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }],
    ["path", { d: "M10 11v6" }],
    ["path", { d: "M14 11v6" }],
  ],
  Type: [
    ["path", { d: "M12 4v16" }],
    ["path", { d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" }],
    ["path", { d: "M9 20h6" }],
  ],
  X: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
};

const html = `<meta charset="utf-8">
<title>Formcraft Builder</title>
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

<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.4/babel.min.js"></script>
<script>
  window.tailwind && tailwind.config && (tailwind.config = { theme: { extend: {} } });
  var ICON_PATHS = ${JSON.stringify(ICONS)};
  var LucideShim = {};
  Object.keys(ICON_PATHS).forEach(function (name) {
    var nodes = ICON_PATHS[name];
    function Icon(props) {
      props = props || {};
      return React.createElement(
        "svg",
        {
          xmlns: "http://www.w3.org/2000/svg",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: props.strokeWidth || 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          className: props.className,
          "aria-hidden": props["aria-hidden"]
        },
        nodes.map(function (node, i) {
          return React.createElement(node[0], Object.assign({ key: i }, node[1]));
        })
      );
    }
    Icon.displayName = name;
    LucideShim[name] = Icon;
  });
</script>

<script type="text/babel" data-presets="react">
const { useCallback, useEffect, useMemo, useRef, useState } = React;
const {
  AlignLeft, ArrowDown, ArrowUp, Braces, CalendarDays, Check, ChevronDown, ChevronUp,
  CircleDot, Clock, Code2, Contrast, Copy, Eye, GripVertical, Hash, Heading, KeyRound,
  LayoutGrid, Link2, ListChecks, Mail, Minus, Phone, Plus, RotateCcw, Send, Settings2,
  SlidersHorizontal, Sparkles, ToggleRight, Trash2, Type, Undo2, Upload, X
} = LucideShim;

${body}

ReactDOM.createRoot(document.getElementById("root")).render(<FormBuilder />);
</script>
`;

fs.writeFileSync(path.join(root, "preview.html"), html, "utf8");
console.log("preview.html written:", html.length, "bytes");

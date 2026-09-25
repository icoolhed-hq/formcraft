/**
 * Shared headless environment for the Formcraft test suites: a jsdom window
 * with the browser APIs jsdom lacks, React 18 in act() mode, console capture,
 * and helpers to load FormBuilder.jsx and drive the DOM like a user.
 */
import { createRequire } from "node:module";
import { JSDOM, VirtualConsole } from "jsdom";
import { assembleSource } from "../assemble.mjs";

const require = createRequire(import.meta.url);
const Babel = require("@babel/standalone");

/* ---- console capture: every React warning lands in the active log ---- */
let currentLog = null;
export const stray = [];
export const capture = (message) => {
  if (currentLog) currentLog.push(message);
  else stray.push(message);
};
/** Sends warnings to `log` (or back to the unattributed pile with null). */
export function setLog(log) {
  currentLog = log;
}
export const getLog = () => currentLog;

export const withLog = async (log, fn) => {
  const previous = currentLog;
  currentLog = log;
  try {
    return await fn();
  } finally {
    currentLog = previous;
  }
};

/* ---- DOM ---- */
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => capture("jsdom: " + (e && e.message ? e.message : String(e))));
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
  virtualConsole,
});
export const window = dom.window;

const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
[
  "window", "document", "navigator", "localStorage", "sessionStorage", "HTMLElement", "HTMLInputElement",
  "HTMLTextAreaElement", "HTMLSelectElement", "HTMLCanvasElement", "Node", "Element", "Event", "CustomEvent",
  "KeyboardEvent", "MouseEvent", "FocusEvent", "InputEvent", "File", "FileList", "Blob", "FileReader",
  "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "DocumentFragment", "MutationObserver",
  "DOMParser", "Image", "Option", "CSS",
].forEach((name) => {
  if (name === "window") define("window", window);
  else if (window[name] !== undefined) define(name, window[name]);
});
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends window.MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId || 1;
      this.pointerType = init.pointerType || "mouse";
      this.pressure = init.pressure || 0.5;
    }
  };
}
define("PointerEvent", window.PointerEvent);
if (!window.DragEvent) window.DragEvent = window.MouseEvent;
define("DragEvent", window.DragEvent);

const fake2d = () =>
  new Proxy(
    { canvas: null, lineWidth: 1, strokeStyle: "#000", fillStyle: "#000", lineCap: "round", lineJoin: "round" },
    { get: (target, prop) => (prop in target ? target[prop] : () => {}) }
  );
window.HTMLCanvasElement.prototype.getContext = function getContext() {
  return fake2d();
};
window.HTMLCanvasElement.prototype.toDataURL = () =>
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
window.URL.createObjectURL = () => "blob:http://localhost/fake";
window.URL.revokeObjectURL = () => {};
window.Element.prototype.scrollIntoView = function scrollIntoView() {};
window.Element.prototype.setPointerCapture = function setPointerCapture() {};
window.Element.prototype.releasePointerCapture = function releasePointerCapture() {};
window.Element.prototype.hasPointerCapture = () => false;
window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
define("ResizeObserver", window.ResizeObserver);

/** Clipboard stub that remembers what was written. */
export const clipboard = { text: null, fail: false };
Object.defineProperty(window.navigator, "clipboard", {
  value: {
    writeText: async (text) => {
      if (clipboard.fail) throw new Error("denied");
      clipboard.text = text;
    },
    readText: async () => clipboard.text || "",
  },
  configurable: true,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export const React = require("react");
export const ReactDOM = require("react-dom");
const ReactDOMClient = require("react-dom/client");
export const lucide = require("lucide-react");
export const act = React.act || require("react-dom/test-utils").act;

const format = (args) =>
  args
    .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : JSON.stringify(a)))
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 400);
console.error = (...a) => capture("console.error: " + format(a));
console.warn = (...a) => capture("console.warn: " + format(a));

/* ---- module loading ---- */

/**
 * FormBuilder.jsx imports React explicitly (classic runtime); exported forms
 * rely on the automatic runtime every modern toolchain (Vite, Next) uses.
 */
export function compile(source, filename, runtime = "classic") {
  return Babel.transform(source, {
    filename,
    babelrc: false,
    configFile: false,
    sourceType: "module",
    presets: [["react", { runtime }]],
    plugins: ["transform-modules-commonjs"],
  }).code;
}

export function evaluate(code, modules) {
  const module = { exports: {} };
  const req = (name) => {
    if (name in modules) return modules[name];
    throw new Error("unexpected import '" + name + "'");
  };
  new Function("require", "module", "exports", code)(req, module, module.exports);
  return module.exports;
}

/** Assembles and loads FormBuilder.jsx, exposing the listed internals. */
export function loadFormBuilder({ core, types = [], components = [], exports = [] }) {
  const assembled = assembleSource({ core, types, components });
  if (assembled.problems.length) throw new Error("assemble problems:\n  - " + assembled.problems.join("\n  - "));
  const tail = exports.length ? "\nexport { " + exports.join(", ") + " };" : "";
  return evaluate(compile(assembled.source + tail, "FormBuilder.jsx"), { react: React, "react-dom": ReactDOM, "lucide-react": lucide });
}

export function mountGeneratedCode(code, onSubmit) {
  const mod = evaluate(compile(code, "GeneratedForm.jsx", "automatic"), {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "lucide-react": lucide,
  });
  return mount(React.createElement(mod.default, { onSubmit }));
}

/* ---- rendering + user events ---- */

export async function mount(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function fileList(files) {
  const listLike = { length: files.length, item: (i) => files[i] || null, [Symbol.iterator]: () => files[Symbol.iterator]() };
  files.forEach((f, i) => {
    listLike[i] = f;
  });
  return listLike;
}

const valueSetter = (el) =>
  Object.getOwnPropertyDescriptor(
    el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype,
    "value"
  ).set;

export const t = {
  window,
  act,
  async type(el, text) {
    await act(async () => {
      valueSetter(el).call(el, text);
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
  },
  async select(el, values) {
    const wanted = Array.isArray(values) ? values : [values];
    await act(async () => {
      Array.from(el.options).forEach((o) => {
        o.selected = wanted.indexOf(o.value) !== -1;
      });
      if (!el.multiple) valueSetter(el).call(el, wanted[0]);
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
  },
  async click(el) {
    await act(async () => {
      el.click();
    });
  },
  async dblclick(el) {
    await act(async () => {
      el.dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
    });
  },
  async key(el, key, init = {}) {
    await act(async () => {
      el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
    });
  },
  async setFiles(el, files) {
    await act(async () => {
      Object.defineProperty(el, "files", { value: fileList(files), configurable: true });
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
  },
  file(name = "sample.pdf", type = "application/pdf") {
    return new window.File(["hello"], name, { type });
  },
  async dispatch(el, event) {
    await act(async () => {
      el.dispatchEvent(event);
    });
  },
  async pointer(el, type, init = {}) {
    await act(async () => {
      el.dispatchEvent(new window.PointerEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10, buttons: 1, ...init }));
    });
  },
  async wait(ms) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  },
};

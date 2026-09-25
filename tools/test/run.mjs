/**
 * Formcraft element suite.
 *
 * Headless (jsdom) verification of every registered element type:
 *   lint · save/load round-trip · schema round-trip · render (both themes + canvas)
 *   · export compiles (dark/light/auto) · exported form: required blocks submit,
 *   filled value reaches onSubmit · markup parity preview⇄export (normal + error)
 *   · a11y wiring (label/aria-describedby/aria-labelledby) · hostile text (quotes,
 *   entities, markup, line breaks survive the export) · the real app's Live preview
 *   · Inspector controls · and zero React warnings throughout.
 *
 *   node test/run.mjs [--only a,b] [--types f1.jsx,f2.jsx] [--components c.jsx]
 *                     [--core ../FormBuilder.jsx] [--skip-app] [--verbose]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assembleSource } from "../assemble.mjs";
import {
  window, React, ReactDOM, lucide, t, mount, compile, evaluate, mountGeneratedCode, setLog, getLog, stray,
} from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/* ---------------------------------------------------------------- args ---- */
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? null : argv[i + 1];
};
const flag = (name) => argv.includes("--" + name);
const list = (value) => (value ? value.split(",").map((s) => s.trim()).filter(Boolean) : []);
const CORE = path.resolve(arg("core") || path.join(here, "..", "..", "FormBuilder.jsx"));
const EXTRA_TYPES = list(arg("types")).map((p) => path.resolve(p));
const EXTRA_COMPONENTS = list(arg("components")).map((p) => path.resolve(p));
const ONLY = new Set(list(arg("only")));
const SKIP_APP = flag("skip-app");
const VERBOSE = flag("verbose");

/* -------------------------------------------------------- module loading ---- */
const EXPORTS = [
  "TYPES", "TYPE_ORDER", "GROUPS", "STYLES", "TOKENS", "CODE_HELPERS", "createField", "normalizeField",
  "normalizeDocument", "buildSchema", "generateReactCode", "FieldCell", "FieldBody", "isBlankValue", "fieldError",
  "emptyValueFor", "cellClass", "defOf", "STORAGE_KEY", "coerceSetting", "toDisplay", "requiredMessage",
];

const assembled = assembleSource({ core: CORE, types: EXTRA_TYPES, components: EXTRA_COMPONENTS });
if (assembled.problems.length) {
  console.log("✗ assemble problems:\n  - " + assembled.problems.join("\n  - "));
  process.exit(1);
}
let M;
try {
  M = evaluate(compile(assembled.source + "\nexport { " + EXPORTS.join(", ") + " };", "FormBuilder.jsx"), {
    react: React,
    "react-dom": ReactDOM,
    "lucide-react": lucide,
  });
} catch (err) {
  console.log("✗ FormBuilder failed to load:\n  " + (err && err.stack ? err.stack.split("\n").slice(0, 6).join("\n  ") : err));
  process.exit(1);
}
const FormBuilder = M.default;

/* Test specs: per-type fill overrides, loaded from test/specs/*.mjs */
const SPECS = {};
const specDir = path.join(here, "specs");
if (fs.existsSync(specDir)) {
  for (const file of fs.readdirSync(specDir).filter((f) => f.endsWith(".mjs")).sort()) {
    const mod = await import(pathToFileURL(path.join(specDir, file)).href);
    Object.assign(SPECS, mod.default || {});
  }
}

/* ---------------------------------------------------------------- utils ---- */
function sampleFor(el, type) {
  if (el.maxLength === 1) return "7";
  const inputMode = (el.getAttribute("inputmode") || "").toLowerCase();
  switch (type) {
    case "email":
      return "ada@example.com";
    case "url":
      return "https://example.com";
    case "tel":
      return "+46 70 123 45 67";
    case "number":
      return el.min !== "" ? String(Number(el.min)) : "5";
    case "date":
      return "2026-10-01";
    case "time":
      return "09:30";
    case "datetime-local":
      return "2026-10-01T09:30";
    case "month":
      return "2026-10";
    case "week":
      return "2026-W40";
    case "password":
      return "correct-horse-battery-staple";
    default:
      if (inputMode === "numeric" || inputMode === "decimal") return "42";
      return "Sample value";
  }
}

/** Fills whatever controls a cell contains. Returns true if it touched anything. */
async function genericFill(cell) {
  let touched = false;
  const radiosByName = new Map();
  let checkboxDone = false;
  for (const el of Array.from(cell.querySelectorAll("input, textarea, select"))) {
    if (el.disabled || el.readOnly) continue;
    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? (el.getAttribute("type") || "text").toLowerCase() : tag;
    if (["hidden", "submit", "button", "reset", "image"].indexOf(type) !== -1) continue;
    if (type === "radio") {
      const name = el.name || "_";
      if (!radiosByName.has(name)) radiosByName.set(name, el);
      continue;
    }
    if (type === "checkbox") {
      if (!checkboxDone) {
        checkboxDone = true;
        if (!el.checked) await t.click(el);
        touched = true;
      }
      continue;
    }
    if (type === "select") {
      const options = Array.from(el.options).filter((o) => o.value !== "");
      if (options.length) {
        await t.select(el, el.multiple ? [options[0].value] : options[options.length - 1].value);
        touched = true;
      }
      continue;
    }
    if (type === "file") {
      await t.setFiles(el, el.multiple ? [t.file("a.pdf"), t.file("b.pdf")] : [t.file()]);
      touched = true;
      continue;
    }
    if (type === "range") {
      await t.type(el, el.max || "10");
      touched = true;
      continue;
    }
    if (type === "color") {
      await t.type(el, "#6366f1");
      touched = true;
      continue;
    }
    await t.type(el, sampleFor(el, type));
    touched = true;
  }
  for (const radio of radiosByName.values()) {
    await t.click(radio);
    touched = true;
  }
  if (!touched) {
    const pressables = Array.from(cell.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"], button[aria-pressed]'));
    if (pressables.length) {
      await t.click(pressables[pressables.length - 1]);
      touched = true;
    }
  }
  return touched;
}

function classTokens(root) {
  const tokens = new Set();
  const visit = (el) => {
    const cls = el.getAttribute && el.getAttribute("class");
    if (cls) cls.split(/\s+/).filter(Boolean).forEach((c) => !/^lucide/.test(c) && tokens.add(c));
  };
  visit(root);
  root.querySelectorAll("*").forEach(visit);
  return tokens;
}

function tagCounts(root) {
  const counts = {};
  root.querySelectorAll("*").forEach((el) => {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") return;
    const tag = el.tagName.toLowerCase();
    counts[tag] = (counts[tag] || 0) + 1;
  });
  return counts;
}

function sloppyClasses(root) {
  const bad = [];
  [root, ...root.querySelectorAll("*")].forEach((el) => {
    const cls = el.getAttribute && el.getAttribute("class");
    if (cls != null && (cls !== cls.trim() || /\s{2,}/.test(cls))) bad.push(JSON.stringify(cls));
  });
  return bad;
}

const diff = (a, b) => Array.from(a).filter((x) => !b.has(x));
const clone = (v) => JSON.parse(JSON.stringify(v));
const equalJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const mountGenerated = mountGeneratedCode;

const gridCell = (container) => {
  const grid = container.querySelector("form .grid");
  return grid ? grid.firstElementChild : null;
};

/* ------------------------------------------------------------ the checks ---- */
const { TYPES, TYPE_ORDER, STYLES, createField, normalizeField, normalizeDocument, buildSchema, generateReactCode, FieldCell } = M;
const META = (theme = "dark") => ({ title: "Test form", description: "", theme });

function canRequire(def) {
  return def.kind === "input" && def.common.indexOf("required") !== -1;
}

function testField(type) {
  const def = TYPES[type];
  const field = createField(type, []);
  if (def.kind === "input") {
    field.helper = "Helper text";
    if (canRequire(def)) field.required = true;
  }
  field.width = "full";
  return field;
}

const submitField = () => {
  const f = createField("submit", [{ key: "zz" }]);
  f.key = "zz_submit";
  return f;
};

async function checkType(type, fails, count) {
  const def = TYPES[type];
  const spec = SPECS[type] || {};
  const ok = (cond, message) => {
    count.n++;
    if (!cond) fails.push(message);
    return cond;
  };

  /* 1. lint */
  ok(typeof def.name === "string" && def.name.length <= 22, "name should be ≤ 22 chars for the toolbox");
  ok(typeof def.blurb === "string" && def.blurb.length > 0 && def.blurb.length <= 28, "blurb should be 1–28 chars");
  ok(Array.isArray(def.keywords) && def.keywords.length >= 2, "give at least 2 search keywords");
  def.settings.forEach((st) => {
    ok(equalJSON(M.coerceSetting(st, clone(st.default === undefined ? null : st.default)), st.default === undefined ? null : st.default),
      "setting '" + st.prop + "': default does not survive coercion");
    ok(typeof st.label === "string" && st.label.length > 0, "setting '" + st.prop + "' needs a label");
  });

  /* 2. create + storage round-trip */
  const field = createField(type, []);
  def.settings.forEach((st) => ok(Object.prototype.hasOwnProperty.call(field, st.prop), "createField is missing setting '" + st.prop + "'"));
  if (def.kind === "input") {
    let serial = true;
    try {
      JSON.stringify(M.emptyValueFor(field));
    } catch (err) {
      serial = false;
    }
    ok(serial, "empty() must be JSON-serialisable");
  }
  const restored = normalizeField(clone(field), []);
  ok(equalJSON(restored, field), "storage round-trip changed the field: " + JSON.stringify(field) + " → " + JSON.stringify(restored));

  /* 3. schema round-trip */
  const schema = buildSchema(META(), [field]);
  const back = normalizeDocument(clone(schema));
  const expected = { ...field };
  ok(back && back.fields.length === 1 && equalJSON({ ...back.fields[0], autoKey: expected.autoKey }, expected), "schema round-trip changed the field");

  /* 4. app render (preview + canvas, both themes) */
  const tf = testField(type);
  for (const theme of ["dark", "light"]) {
    const m = await mount(
      React.createElement(FieldCell, { field: tf, value: M.emptyValueFor(tf), onChange() {}, error: null, idPrefix: "", s: STYLES[theme], onReset() {} })
    );
    const sloppy = sloppyClasses(m.container);
    ok(!sloppy.length, "classes with stray whitespace (" + theme + "): " + sloppy.slice(0, 3).join(", "));
    await m.unmount();
  }
  const canvas = await mount(
    React.createElement(M.FieldBody, { field: field, value: M.emptyValueFor(field), onChange() {}, idPrefix: "canvas-x-", s: STYLES.dark })
  );
  await canvas.unmount();

  /* 5. export compiles in every theme */
  const codes = {};
  for (const theme of ["dark", "light", "auto"]) {
    let code = "";
    try {
      code = generateReactCode(META(theme), [tf, submitField()]);
      compile(code, "GeneratedForm.jsx", "automatic");
      codes[theme] = code;
    } catch (err) {
      ok(false, "export (" + theme + ") does not compile: " + String(err.message).split("\n")[0]);
    }
    if (code) {
      ok(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(code.replace(/=== undefined|!== undefined|: undefined|, undefined/g, "")),
        "export (" + theme + ") contains undefined/NaN/[object Object]");
    }
  }
  if (!codes.dark) return;

  /* 6. a11y + markup parity (dark and light) */
  for (const theme of ["dark", "light"]) {
    const app = await mount(
      React.createElement(FieldCell, { field: tf, value: M.emptyValueFor(tf), onChange() {}, error: null, idPrefix: "", s: STYLES[theme], onReset() {} })
    );
    const gen = await mountGenerated(generateReactCode(META(theme), [tf]), () => {});
    const appCell = app.container.firstElementChild;
    const genCell = gridCell(gen.container);
    if (ok(appCell && genCell, "could not locate the rendered cell (" + theme + ")")) {
      const ignore = new Set(def.parityIgnore || []);
      const a = classTokens(appCell);
      const g = classTokens(genCell);
      const onlyApp = diff(a, g).filter((c) => !ignore.has(c));
      const onlyGen = diff(g, a).filter((c) => !ignore.has(c));
      ok(!onlyApp.length && !onlyGen.length,
        "class parity (" + theme + "): only in preview [" + onlyApp.join(" ") + "], only in export [" + onlyGen.join(" ") + "]");
      const ta = tagCounts(appCell);
      const tg = tagCounts(genCell);
      ok(equalJSON(Object.keys(ta).sort().map((k) => k + ta[k]), Object.keys(tg).sort().map((k) => k + tg[k])),
        "element parity (" + theme + "): preview " + JSON.stringify(ta) + " vs export " + JSON.stringify(tg));
      const sloppy = sloppyClasses(genCell);
      ok(!sloppy.length, "export has classes with stray whitespace: " + sloppy.slice(0, 3).join(", "));

      if (theme === "dark" && def.kind === "input") {
        const k = tf.key;
        if (def.labelMode === "outer") {
          const target = appCell.querySelector("#" + window.CSS.escape(k));
          ok(target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName), "labelMode 'outer' needs a control with id=ctx.id (preview)");
          const gt = genCell.querySelector("#" + window.CSS.escape(k));
          ok(gt && /^(INPUT|SELECT|TEXTAREA)$/.test(gt.tagName), "labelMode 'outer' needs a control with id={key} (export)");
        }
        if (def.labelMode === "group") {
          ok(appCell.querySelector('[aria-labelledby~="' + k + '-label"]'), "labelMode 'group' needs aria-labelledby=ctx.labelId (preview)");
          ok(genCell.querySelector('[aria-labelledby~="' + k + '-label"]'), "labelMode 'group' needs ctx.labelledAttr (export)");
        }
        if (def.labelMode !== "none") {
          ok(appCell.querySelector('[aria-describedby~="' + k + '-help"]'), "helper text is not wired: use aria-describedby={ctx.describedBy} (preview)");
          ok(genCell.querySelector('[aria-describedby~="' + k + '-help"]'), "helper text is not wired: emit ctx.describedAttr (export)");
        }
      }
    }
    await app.unmount();
    await gen.unmount();
  }

  /* 7. exported form behaviour */
  if (def.kind === "input") {
    let submitted = [];
    const gen = await mountGenerated(codes.dark, (v) => submitted.push(v));
    const cell = gridCell(gen.container);
    const button = gen.container.querySelector('button[type="submit"]');
    await t.click(button);
    if (canRequire(def)) {
      ok(submitted.length === 0, "export: empty required field did not block submit");
      ok(cell.textContent.indexOf(M.requiredMessage(tf)) !== -1, "export: required message not shown");

      /* error-state parity */
      const app = await mount(
        React.createElement(FieldCell, {
          field: tf, value: M.emptyValueFor(tf), onChange() {}, error: M.requiredMessage(tf), idPrefix: "", s: STYLES.dark, onReset() {},
        })
      );
      const a = classTokens(app.container.firstElementChild);
      const g = classTokens(cell);
      const ignore = new Set(def.parityIgnore || []);
      const onlyApp = diff(a, g).filter((c) => !ignore.has(c));
      const onlyGen = diff(g, a).filter((c) => !ignore.has(c));
      ok(!onlyApp.length && !onlyGen.length, "error-state parity: only in preview [" + onlyApp.join(" ") + "], only in export [" + onlyGen.join(" ") + "]");
      await app.unmount();
    } else {
      ok(submitted.length === 1, "export: an always-filled field should submit untouched");
    }

    submitted = [];
    if (spec.skipFill) {
      count.skipped = "fill: " + spec.skipFill;
    } else {
      const touched = spec.fill ? (await spec.fill(cell, t), true) : await genericFill(cell);
      ok(touched, "export: the generic filler found nothing to fill — add a spec in test/specs/");
      await t.click(button);
      if (ok(submitted.length === 1, "export: filled form did not submit (" + cell.textContent.slice(0, 120) + ")")) {
        const value = submitted[0][tf.key];
        const blank = def.blank ? def.blank.test(tf, value) : M.isBlankValue(value);
        ok(!blank, "export: submitted value is blank: " + JSON.stringify(M.toDisplay(value)));
        if (spec.expect) ok(spec.expect(value), "export: spec.expect rejected " + JSON.stringify(M.toDisplay(value)));
      }
    }
    await gen.unmount();
  }

  /* 8. hostile text: quotes, entities, markup, braces, backslashes, line breaks */
  {
    const hostile = (i) => 'Say "hi" & <b>{x}</b> \\ path ' + i;
    const nasty = { ...tf };
    let n = 0;
    if (def.common.indexOf("label") !== -1) nasty.label = hostile(n++);
    if (def.common.indexOf("helper") !== -1) nasty.helper = hostile(n++) + "\nsecond line";
    def.settings.forEach((st) => {
      if ((def.hostileSkip || []).indexOf(st.prop) !== -1) return;
      if (st.control === "text") nasty[st.prop] = hostile(n++);
      else if (st.control === "textarea") nasty[st.prop] = hostile(n++) + "\nsecond line";
      else if (st.control === "options") nasty[st.prop] = (nasty[st.prop] || []).map((_, i) => hostile(n++) + " #" + i);
    });
    const safe = normalizeField(clone(nasty), []);
    let code = "";
    try {
      code = generateReactCode({ title: 'Title "q" & <x>', description: "Desc & {y}", theme: "dark" }, [safe]);
      compile(code, "GeneratedForm.jsx", "automatic");
    } catch (err) {
      ok(false, "hostile text: export does not compile: " + String(err.message).split("\n")[0]);
      code = "";
    }
    if (code) {
      const app = await mount(
        React.createElement(FieldCell, { field: safe, value: M.emptyValueFor(safe), onChange() {}, error: null, idPrefix: "", s: STYLES.dark, onReset() {} })
      );
      const gen = await mountGenerated(code, () => {});
      const appCell = app.container.firstElementChild;
      const genCell = gridCell(gen.container);
      if (appCell && genCell) {
        ok(appCell.textContent === genCell.textContent,
          "hostile text: visible text differs — preview " + JSON.stringify(appCell.textContent.slice(0, 160)) + " vs export " + JSON.stringify(genCell.textContent.slice(0, 160)));
        const ATTRS = ["placeholder", "aria-label", "title", "alt", "value", "accept", "href", "src"];
        const attrs = (root) =>
          Array.from(root.querySelectorAll("*"))
            .flatMap((el) => ATTRS.filter((a) => el.hasAttribute(a) && !(a === "value" && /^(INPUT|TEXTAREA)$/.test(el.tagName) && el.type !== "radio" && el.type !== "checkbox" && el.type !== "hidden")).map((a) => el.tagName + "@" + a + "=" + el.getAttribute(a)))
            .sort();
        const pa = attrs(appCell);
        const ga = attrs(genCell);
        const onlyP = pa.filter((x) => ga.indexOf(x) === -1);
        const onlyG = ga.filter((x) => pa.indexOf(x) === -1);
        ok(!onlyP.length && !onlyG.length, "hostile text: attributes differ — preview [" + onlyP.slice(0, 3).join(" | ") + "] export [" + onlyG.slice(0, 3).join(" | ") + "]");
      }
      await app.unmount();
      await gen.unmount();
    }
  }

  /* 9. the real app's Live preview */
  if (!SKIP_APP && def.kind === "input") {
    localStorage.clear();
    localStorage.setItem(M.STORAGE_KEY, JSON.stringify({ version: 3, meta: META(), fields: [tf, submitField()] }));
    const app = await mount(React.createElement(FormBuilder));
    const tab = Array.from(app.container.querySelectorAll("button")).find((b) => b.textContent.trim() === "Live preview");
    if (ok(tab, "app: Live preview tab not found")) {
      await t.click(tab);
      const form = app.container.querySelector("main form");
      const cell = form && gridCell(app.container.querySelector("main"));
      const button = form && form.querySelector('button[type="submit"]');
      if (ok(form && cell && button, "app: preview form not rendered")) {
        await t.click(button);
        if (canRequire(def)) ok(cell.textContent.indexOf(M.requiredMessage(tf)) !== -1, "app: required message not shown");
        /* An always-filled field submits straight away — go back to the form before filling it. */
        let liveCell = cell;
        let liveButton = button;
        const again = Array.from(app.container.querySelectorAll("button")).find((b) => b.textContent.trim() === "Fill it in again");
        if (again) {
          await t.click(again);
          liveCell = gridCell(app.container.querySelector("main"));
          liveButton = app.container.querySelector('main form button[type="submit"]');
        }
        if (!spec.skipFill && ok(liveCell && liveButton, "app: could not return to the form")) {
          if (spec.fill) await spec.fill(liveCell, t);
          else await genericFill(liveCell);
          await t.click(liveButton);
          const pre = app.container.querySelector('[data-testid="submitted-payload"]');
          if (ok(pre, "app: filled form did not submit (" + liveCell.textContent.slice(0, 120) + ")")) {
            const payload = JSON.parse(pre.textContent);
            ok(!M.isBlankValue(payload[tf.key]), "app: submitted value is blank");
          }
        }
      }
    }
    await app.unmount();
    localStorage.clear();
  }
}

/* Inspector: select every element and poke each of its settings. */
async function checkInspector(types, results) {
  localStorage.clear();
  const fields = [];
  types.forEach((type) => fields.push(createField(type, fields)));
  localStorage.setItem(M.STORAGE_KEY, JSON.stringify({ version: 3, meta: META(), fields }));
  const app = await mount(React.createElement(FormBuilder));
  const cards = () => Array.from(app.container.querySelectorAll('main [data-canvas-card], main [role="button"][tabindex="0"]'));
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const def = TYPES[type];
    const r = results.get(type);
    setLog(r.log);
    const card = cards()[i];
    if (!card) {
      r.fails.push("inspector: canvas card missing");
      continue;
    }
    await t.click(card);
    const aside = app.container.querySelectorAll("aside")[1];
    r.count.n++;
    if (!aside || aside.textContent.indexOf("Inspector") === -1) {
      r.fails.push("inspector: did not open");
      continue;
    }
    for (const st of def.settings) {
      const box = aside.querySelector('[data-setting="' + st.prop + '"]');
      r.count.n++;
      if (!box) {
        r.fails.push("inspector: no control rendered for setting '" + st.prop + "'");
        continue;
      }
      if (st.control === "text" || st.control === "textarea") {
        const el = box.querySelector("input, textarea");
        if (el) await t.type(el, (el.value || "") + " edited");
      } else if (st.control === "number") {
        const el = box.querySelector("input");
        const base = typeof st.default === "number" ? st.default : typeof st.min === "number" ? st.min : 1;
        let next = base + (typeof st.step === "number" ? st.step : 1);
        if (typeof st.max === "number") next = Math.min(next, st.max);
        if (el) await t.type(el, String(next));
      } else if (st.control === "toggle") {
        const el = box.querySelector('[role="switch"]');
        if (el) await t.click(el);
      } else if (st.control === "select") {
        const radios = box.querySelectorAll('[role="radio"]');
        const sel = box.querySelector("select");
        if (radios.length) await t.click(radios[radios.length - 1]);
        else if (sel) await t.select(sel, sel.options[sel.options.length - 1].value);
      } else if (st.control === "options") {
        const add = Array.from(box.querySelectorAll("button")).find((b) => b.textContent.trim() === "Add");
        if (add) await t.click(add);
      }
    }
    /* the edited field must still export cleanly */
    const doc = normalizeDocument(JSON.parse(localStorage.getItem(M.STORAGE_KEY)));
    const edited = doc && doc.fields.find((f) => f.type === type);
    r.count.n++;
    if (edited) {
      try {
        compile(generateReactCode(META(), [edited]), "GeneratedForm.jsx", "automatic");
      } catch (err) {
        r.fails.push("inspector: export no longer compiles after editing settings: " + String(err.message).split("\n")[0]);
      }
    } else r.fails.push("inspector: edited field missing from saved document");
  }
  setLog(null);
  await app.unmount();
  localStorage.clear();
}

/* ---------------------------------------------------------------- run it ---- */
const selected = TYPE_ORDER.filter((type) => !ONLY.size || ONLY.has(type));
const unknown = Array.from(ONLY).filter((type) => !TYPES[type]);
const results = new Map();
const started = Date.now();

for (const type of selected) {
  const r = { type, fails: [], log: [], count: { n: 0 } };
  results.set(type, r);
  setLog(r.log);
  try {
    await checkType(type, r.fails, r.count);
  } catch (err) {
    r.fails.push("crashed: " + (err && err.stack ? err.stack.split("\n").slice(0, 4).join(" | ") : String(err)));
  }
  setLog(null);
}

try {
  await checkInspector(selected, results);
} catch (err) {
  stray.push("inspector pass crashed: " + (err && err.stack ? err.stack.split("\n").slice(0, 4).join(" | ") : err));
}

/* Global checks */
const globalFails = [];
{
  setLog([]);
  /* isBlank parity between the preview and the exported helper */
  const helper = M.CODE_HELPERS.isBlank.lines.join("\n") + "\nmodule.exports = isBlank;";
  const genBlank = evaluate(helper, {});
  const samples = [null, undefined, false, true, 0, 1, NaN, "", "  ", "x", [], ["a"], {}, { a: "" }, { a: "x" }, { a: [] }, new window.Blob(["x"]), t.file()];
  samples.forEach((v, i) => {
    if (M.isBlankValue(v) !== genBlank(v)) globalFails.push("isBlank parity differs for sample #" + i);
  });

  /* every selected type together */
  const all = [];
  selected.forEach((type) => all.push(testField(type)));
  all.forEach((f, i) => {
    f.key = f.key + "_" + i;
  });
  for (const theme of ["dark", "light", "auto"]) {
    try {
      compile(generateReactCode(META(theme), all), "GeneratedForm.jsx", "automatic");
    } catch (err) {
      globalFails.push("all-types export (" + theme + ") does not compile: " + String(err.message).split("\n")[0]);
    }
  }
  try {
    const gen = await mountGenerated(generateReactCode(META(), all), () => {});
    await gen.unmount();
  } catch (err) {
    globalFails.push("all-types export failed to mount: " + err.message);
  }
  if (!SKIP_APP) {
    localStorage.clear();
    localStorage.setItem(M.STORAGE_KEY, JSON.stringify({ version: 3, meta: META("light"), fields: all }));
    const app = await mount(React.createElement(FormBuilder));
    const tab = Array.from(app.container.querySelectorAll("button")).find((b) => b.textContent.trim() === "Live preview");
    if (tab) await t.click(tab);
    await app.unmount();
    localStorage.clear();
  }
  getLog().forEach((m) => globalFails.push("warning during global checks: " + m));
  setLog(null);
}

/* ---------------------------------------------------------------- report ---- */
let passed = 0;
const width = Math.max(10, ...selected.map((type) => type.length));
console.log("\nFormcraft element suite — " + selected.length + " type" + (selected.length === 1 ? "" : "s") + "\n");
for (const r of results.values()) {
  const problems = r.fails.concat(r.log.map((m) => "warning: " + m));
  const skipped = r.count.skipped ? "  (" + r.count.skipped + ")" : "";
  if (!problems.length) {
    passed++;
    if (VERBOSE || selected.length <= 20) console.log("  ✓ " + r.type.padEnd(width) + "  " + r.count.n + " checks" + skipped);
  } else {
    console.log("  ✗ " + r.type.padEnd(width) + "  " + problems.length + " problem" + (problems.length === 1 ? "" : "s") + skipped);
    problems.slice(0, VERBOSE ? 50 : 8).forEach((p) => console.log("      - " + p));
    if (!VERBOSE && problems.length > 8) console.log("      … " + (problems.length - 8) + " more (use --verbose)");
  }
}
if (unknown.length) globalFails.push("unknown --only types: " + unknown.join(", "));
stray.forEach((m) => globalFails.push("unattributed warning: " + m));
console.log("\n  global: " + (globalFails.length ? "✗" : "✓") + " isBlank parity · all-types export (3 themes) · all-types mount · all-types app");
globalFails.forEach((m) => console.log("      - " + m));
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log("\n  " + passed + "/" + selected.length + " types passed" + (globalFails.length ? ", global checks failed" : "") + " — " + secs + "s\n");
process.exit(passed === selected.length && !globalFails.length ? 0 : 1);

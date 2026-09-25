/**
 * Formcraft app suite — drives the real builder UI the way a person would:
 * toolbox search, insertion, undo/redo, keyboard shortcuts, command palette,
 * templates, import, form checks, the code panel and saved preferences.
 * Every test also fails on any React warning.
 *
 *   node test/app.mjs [--core ../FormBuilder.jsx] [--types a.jsx,b.jsx] [--only name-fragment]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { window, React, t, mount, clipboard, loadFormBuilder, mountGeneratedCode, withLog, stray } from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? null : argv[i + 1];
};
const list = (value) => (value ? value.split(",").map((s) => s.trim()).filter(Boolean) : []);
const CORE = path.resolve(arg("core") || path.join(here, "..", "..", "FormBuilder.jsx"));
const ONLY = arg("only");

const M = loadFormBuilder({
  core: CORE,
  types: list(arg("types")).map((p) => path.resolve(p)),
  exports: ["TYPES", "TYPE_ORDER", "TEMPLATES", "buildTemplate", "lintDocument", "createField", "buildSchema", "generateReactCode", "normalizeDocument", "STORAGE_KEY", "UI_KEY", "defOf"],
});
const FormBuilder = M.default;

/* ------------------------------------------------------------ harness ---- */
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

class Failure extends Error {}
const expect = (cond, message) => {
  if (!cond) throw new Failure(message);
};

const field = (type, overrides = {}, siblings = []) => ({ ...M.createField(type, siblings), ...overrides });
function doc(fields, meta = {}) {
  return { version: 3, meta: { title: "Test form", description: "", theme: "dark", ...meta }, fields };
}

async function open(document = null, ui = null) {
  window.localStorage.clear();
  if (document) window.localStorage.setItem(M.STORAGE_KEY, JSON.stringify(document));
  if (ui) window.localStorage.setItem(M.UI_KEY, JSON.stringify(ui));
  const app = await mount(React.createElement(FormBuilder));
  const c = app.container;
  const api = {
    c,
    unmount: app.unmount,
    q: (sel) => c.querySelector(sel),
    qa: (sel) => Array.from(c.querySelectorAll(sel)),
    byText: (text, sel = "button") => Array.from(c.querySelectorAll(sel)).find((b) => b.textContent.trim() === text),
    containing: (text, sel = "button") => Array.from(c.querySelectorAll(sel)).find((b) => b.textContent.indexOf(text) !== -1),
    cards: () => Array.from(c.querySelectorAll('main [data-canvas-card]')),
    saved: () => JSON.parse(window.localStorage.getItem(M.STORAGE_KEY) || "null"),
    types: () => (api.saved() ? api.saved().fields.map((f) => f.type) : []),
    search: () => c.querySelector('input[aria-label="Search elements"]'),
    toolboxItem: (name) =>
      Array.from(c.querySelectorAll("aside")[0].querySelectorAll("button")).find(
        (b) => b.querySelector("span span") && b.querySelector("span span").textContent === name
      ),
    press: (key, init = {}) => t.key(window.document.body, key, init),
    dialog: () => window.document.querySelector('[role="dialog"]'),
    undoButton: () => c.querySelector('button[aria-label^="Undo"]'),
    redoButton: () => c.querySelector('button[aria-label^="Redo"]'),
    toastText: () => Array.from(c.querySelectorAll('[role="status"] > div')).map((d) => d.textContent).join(" | "),
  };
  return api;
}

/* -------------------------------------------------------------- tests ---- */

test("toolbox search filters and Enter adds the first match", async () => {
  const app = await open();
  await t.type(app.search(), "email");
  const visible = app.qa("aside")[0].querySelectorAll("section button + div button, section div button");
  expect(visible.length >= 1, "no results for 'email'");
  expect(app.toolboxItem("Short Text") === undefined, "non-matching elements should be hidden while searching");
  await t.key(app.search(), "Enter");
  expect(app.types().join() === "email", "Enter should add the first match, got " + app.types().join());
  expect(app.search().value === "", "search should clear after adding");
  await app.unmount();
});

test("search matches the start of words, not the middle", async () => {
  const app = await open();
  await t.type(app.search(), "date");
  expect(app.toolboxItem("Date"), "“date” should find the Date element");
  expect(app.toolboxItem("Email") === undefined, "“date” must not match Email via “Validated”");
  await app.unmount();
});

test("an empty search shows a helpful message", async () => {
  const app = await open();
  await t.type(app.search(), "zzzz-nothing");
  expect(app.c.textContent.indexOf("No elements match") !== -1, "missing no-results message");
  await t.key(app.search(), "Escape");
  expect(app.search().value === "", "Escape should clear the search");
  await app.unmount();
});

test("slash focuses the element search", async () => {
  const app = await open();
  await app.press("/");
  expect(window.document.activeElement === app.search(), "search input is not focused");
  await app.unmount();
});

test("new elements are inserted after the selected one", async () => {
  const a = field("text", { label: "First" });
  const b = field("text", { label: "Second" }, [a]);
  const app = await open(doc([a, b]));
  await t.click(app.cards()[0]);
  await t.click(app.toolboxItem("Email"));
  const labels = app.saved().fields.map((f) => f.label);
  expect(labels.join("|") === "First|Work email|Second", "unexpected order: " + labels.join("|"));
  expect(app.c.querySelector('main [aria-current="true"]').textContent.indexOf("Work email") !== -1, "the new element should be selected");
  await app.unmount();
});

test("undo and redo walk the history in both directions", async () => {
  const app = await open();
  expect(app.undoButton().disabled, "undo should start disabled");
  await t.click(app.toolboxItem("Short Text"));
  await t.click(app.toolboxItem("Email"));
  await t.click(app.toolboxItem("Number"));
  expect(app.types().length === 3, "expected 3 elements");
  await t.click(app.undoButton());
  await t.click(app.undoButton());
  expect(app.types().join() === "text", "two undos should leave one element, got " + app.types().join());
  await t.click(app.redoButton());
  expect(app.types().join() === "text,email", "redo should bring back email, got " + app.types().join());
  await app.press("z", { ctrlKey: true });
  expect(app.types().join() === "text", "Ctrl+Z should undo");
  await app.press("z", { ctrlKey: true, shiftKey: true });
  expect(app.types().join() === "text,email", "Ctrl+Shift+Z should redo");
  await app.unmount();
});

test("typing into a setting undoes as a single step", async () => {
  const a = field("text", { label: "Name" });
  const app = await open(doc([a]));
  await t.click(app.cards()[0]);
  const input = app.q("#insp-label");
  for (const text of ["N", "Na", "Nam", "Name o", "Name of company"]) await t.type(input, text);
  expect(app.saved().fields[0].label === "Name of company", "label not updated");
  await t.click(app.undoButton());
  expect(app.saved().fields[0].label === "Name", "one undo should restore the original label, got " + app.saved().fields[0].label);
  await app.unmount();
});

test("deleting shows a toast whose Undo restores the element", async () => {
  const a = field("text", { label: "Keep me" });
  const app = await open(doc([a]));
  await t.click(app.cards()[0]);
  await app.press("Delete");
  expect(app.types().length === 0, "element was not deleted");
  expect(app.toastText().indexOf("deleted") !== -1, "no delete toast");
  await t.click(app.byText("Undo"));
  expect(app.types().join() === "text", "toast Undo did not restore the element");
  await app.unmount();
});

test("arrow keys select, Ctrl+D duplicates and Alt+Arrow moves", async () => {
  const a = field("text", { label: "Alpha" });
  const b = field("email", { label: "Beta" }, [a]);
  const app = await open(doc([a, b]));
  await app.press("ArrowDown");
  expect(app.c.querySelector('main [aria-current="true"]').textContent.indexOf("Alpha") !== -1, "ArrowDown should select the first element");
  await app.press("ArrowDown");
  expect(app.c.querySelector('main [aria-current="true"]').textContent.indexOf("Beta") !== -1, "second ArrowDown should select Beta");
  await app.press("ArrowUp");
  await app.press("d", { ctrlKey: true });
  expect(app.saved().fields.map((f) => f.label).join("|") === "Alpha|Alpha|Beta", "Ctrl+D should duplicate in place");
  await app.press("ArrowDown", { altKey: true });
  expect(app.saved().fields.map((f) => f.type).join() === "text,email,text", "Alt+ArrowDown should move the copy down");
  await app.unmount();
});

test("the command palette adds elements and closes", async () => {
  const app = await open();
  await app.press("k", { ctrlKey: true });
  const dialog = app.dialog();
  expect(dialog, "palette did not open");
  const input = dialog.querySelector('input[role="combobox"]');
  expect(window.document.activeElement === input, "palette input should have focus");
  await t.type(input, "slider");
  await t.key(input, "Enter");
  await t.wait(5);
  expect(!app.dialog(), "palette should close after running a command");
  expect(app.types().join() === "range", "palette should have added a slider, got " + app.types().join());
  await app.unmount();
});

test("the palette can jump to an existing field", async () => {
  const a = field("text", { label: "Company name" });
  const b = field("email", {}, [a]);
  const app = await open(doc([a, b]));
  await app.press("k", { ctrlKey: true });
  const input = app.dialog().querySelector('input[role="combobox"]');
  await t.type(input, "company");
  await t.key(input, "Enter");
  await t.wait(5);
  expect(app.c.querySelector('main [aria-current="true"]').textContent.indexOf("Company name") !== -1, "jump did not select the field");
  await app.unmount();
});

test("templates load and can be undone", async () => {
  const app = await open();
  await t.click(app.containing("Templates"));
  expect(app.dialog(), "templates dialog did not open");
  const card = Array.from(app.dialog().querySelectorAll("button")).find((b) => b.textContent.indexOf("Request a demo") !== -1);
  await t.click(card);
  expect(!app.dialog(), "dialog should close");
  expect(app.types().length === 8, "demo template should have 8 elements, got " + app.types().length);
  expect(app.saved().meta.title === "Request a demo", "template title not applied");
  await t.click(app.byText("Undo"));
  expect(app.types().length === 0, "undo should restore the empty canvas");
  await app.unmount();
});

test("every template builds only from registered elements and exports cleanly", async () => {
  const missing = [];
  M.TEMPLATES.forEach((tpl) => tpl.fields.forEach((f) => !M.TYPES[f.type] && missing.push(tpl.id + ":" + f.type)));
  expect(!missing.length, "templates reference unknown types: " + missing.join(", "));
  for (const tpl of M.TEMPLATES) {
    const built = M.buildTemplate(tpl);
    expect(built.fields.length === tpl.fields.length, tpl.id + ": built " + built.fields.length + " of " + tpl.fields.length + " fields");
    const issues = M.lintDocument(built.meta, built.fields).filter((i) => i.level === "warning");
    expect(!issues.length, tpl.id + ": template trips form checks: " + issues.map((i) => i.message).join("; "));
    const gen = await mountGeneratedCode(M.generateReactCode(built.meta, built.fields), () => {});
    await gen.unmount();
  }
});

test("import rejects broken JSON and replaces the canvas with valid JSON", async () => {
  const app = await open(doc([field("text")]));
  await t.click(app.containing("Import"));
  const area = app.dialog().querySelector("textarea");
  await t.type(area, "{ \"fields\": [ {");
  expect(app.dialog().textContent.indexOf("isn't valid JSON") !== -1, "no JSON error shown");
  const replace = Array.from(app.dialog().querySelectorAll("button")).find((b) => b.textContent.indexOf("Replace canvas") !== -1);
  expect(replace.disabled, "import button should be disabled for broken JSON");
  const schema = M.buildSchema({ title: "Imported", description: "", theme: "dark" }, [field("email"), field("select")]);
  await t.type(area, JSON.stringify(schema));
  expect(app.dialog().textContent.indexOf("Ready: 2 elements") !== -1, "valid schema not recognised");
  await t.click(replace);
  expect(app.types().join() === "email,select", "import did not replace the canvas");
  expect(app.saved().meta.title === "Imported", "import did not bring the title");
  await app.unmount();
});

test("a schema export round-trips through import unchanged", async () => {
  const fields = [];
  M.TYPE_ORDER.forEach((type) => fields.push(M.createField(type, fields)));
  const schema = M.buildSchema({ title: "Everything", description: "All elements", theme: "light" }, fields);
  const back = M.normalizeDocument(JSON.parse(JSON.stringify(schema)));
  expect(back.fields.length === fields.length, "field count changed");
  const strip = (f) => JSON.stringify({ ...f, autoKey: true });
  const changed = fields.filter((f, i) => strip(f) !== strip(back.fields[i])).map((f) => f.type);
  expect(!changed.length, "round-trip changed: " + changed.join(", "));
  expect(back.meta.theme === "light" && back.meta.title === "Everything", "meta lost in round-trip");
});

test("form checks flag problems and jump to the field", async () => {
  const text = field("text", { label: "" });
  const select = field("select", { label: "Plan", options: ["Only one"] }, [text]);
  const app = await open(doc([text, select]));
  const health = app.containing("check");
  expect(health, "health button not found");
  await t.click(health);
  const menu = app.c.textContent;
  expect(menu.indexOf("Add a Submit Button") !== -1, "missing submit warning");
  expect(menu.indexOf("has no label") !== -1, "missing empty-label warning");
  expect(menu.indexOf("needs at least 2 options") !== -1, "missing options warning");
  const item = Array.from(app.qa("button")).find((b) => b.textContent.indexOf("needs at least 2 options") !== -1);
  await t.click(item);
  expect(app.c.querySelector('main [aria-current="true"]').textContent.indexOf("Plan") !== -1, "check did not select the field");
  await app.unmount();
});

test("a tidy form reports no problems", async () => {
  const a = field("text");
  const app = await open(doc([a, field("submit", {}, [a])]));
  expect(app.containing("Looks good"), "expected the all-clear state");
  await app.unmount();
});

test("the code panel shows exactly the exported text and copies it", async () => {
  const a = field("email", { required: true });
  const b = field("checkboxes", {}, [a]);
  const s = field("submit", {}, [a, b]);
  const meta = { title: "Copy test", description: "", theme: "dark" };
  const app = await open(doc([a, b, s], meta));
  const code = () => app.q('section[aria-label="Code export"] code').textContent;
  const schemaText = JSON.stringify(M.buildSchema(meta, [a, b, s]), null, 2);
  expect(code() === schemaText, "schema view differs from the schema");
  await t.click(app.byText("React + Tailwind"));
  expect(code() === M.generateReactCode(meta, [a, b, s]), "code view differs from the generated component");
  expect(app.q('section[aria-label="Code export"] code span'), "code is not highlighted");
  clipboard.text = null;
  await t.click(app.byText("Copy"));
  expect(clipboard.text === code(), "Copy did not write the exact code");
  expect(app.byText("Copied"), "no copied feedback");
  await app.unmount();
});

test("a refused clipboard falls back to selecting the code", async () => {
  const app = await open(doc([field("text")]));
  clipboard.fail = true;
  const original = window.document.execCommand;
  window.document.execCommand = () => false;
  try {
    await t.click(app.byText("Copy"));
    await t.wait(5);
    expect(app.containing("Press"), "manual-copy hint not shown");
  } finally {
    clipboard.fail = false;
    window.document.execCommand = original;
  }
  await app.unmount();
});

test("view preferences survive a reload", async () => {
  const app = await open(doc([field("text")]));
  await t.click(app.byText("Live preview"));
  await t.click(app.byText("React + Tailwind"));
  const groupToggle = Array.from(app.qa("aside h3 button")).find((b) => b.textContent.indexOf("Contact") !== -1);
  await t.click(groupToggle);
  const ui = JSON.parse(window.localStorage.getItem(M.UI_KEY));
  await app.unmount();
  const again = await open(doc([field("text")]), ui);
  expect(again.byText("Live preview").getAttribute("aria-selected") === "true", "tab not restored");
  expect(again.byText("React + Tailwind").getAttribute("aria-selected") === "true", "export mode not restored");
  const toggle = Array.from(again.qa("aside h3 button")).find((b) => b.textContent.indexOf("Contact") !== -1);
  expect(toggle.getAttribute("aria-expanded") === "false", "collapsed group not restored");
  await again.unmount();
});

test("? opens the shortcuts sheet and Escape closes it", async () => {
  const app = await open();
  await app.press("?");
  expect(app.dialog() && app.dialog().textContent.indexOf("Keyboard shortcuts") !== -1, "shortcuts did not open");
  await t.key(app.dialog(), "Escape");
  expect(!app.dialog(), "Escape did not close the dialog");
  await app.unmount();
});

test("the card toolbar toggles required", async () => {
  const app = await open(doc([field("text")]));
  const toggle = app.q('button[aria-label="Required"]');
  expect(toggle && toggle.getAttribute("aria-pressed") === "false", "required toggle missing or wrongly pressed");
  await t.click(toggle);
  expect(app.saved().fields[0].required === true, "required not set");
  expect(app.q('button[aria-label="Required"]').getAttribute("aria-pressed") === "true", "toggle did not report its pressed state");
  await app.unmount();
});

/* ---- regressions from the UI review ---- */

test("Backspace on a preview button does not delete a canvas element", async () => {
  const a = field("text", { label: "Alpha" });
  const app = await open(doc([a, field("submit", {}, [a])]));
  await t.click(app.cards()[0]);
  await t.click(app.byText("Live preview"));
  const submit = app.q('main form button[type="submit"]');
  submit.focus();
  await t.key(submit, "Backspace");
  expect(app.types().join() === "text,submit", "an element was deleted from the preview: " + app.types().join());
  await app.unmount();
});

test("arrow keys on the resize handle do not move the canvas selection", async () => {
  const a = field("text");
  const app = await open(doc([a, field("email", {}, [a])]));
  await t.click(app.byText("Live preview"));
  const handle = app.q('[role="separator"]');
  handle.focus();
  await t.key(handle, "ArrowUp");
  expect(app.byText("Live preview").getAttribute("aria-selected") === "true", "the view jumped away from Live preview");
  expect(!app.c.querySelector('main [aria-current="true"]'), "a card got selected");
  await app.unmount();
});

test("Ctrl+K inside the Import dialog keeps what was pasted", async () => {
  const app = await open();
  await t.click(app.containing("Import"));
  const area = app.dialog().querySelector("textarea");
  await t.type(area, "{\"fields\": []}");
  await t.key(area, "k", { ctrlKey: true });
  expect(app.dialog() && app.dialog().querySelector("textarea"), "the Import dialog was replaced");
  expect(app.dialog().querySelector("textarea").value.indexOf("fields") !== -1, "pasted text was lost");
  await app.unmount();
});

test("an old delete toast cannot undo a newer change", async () => {
  const a = field("text", { label: "Alpha" });
  const b = field("email", { label: "Beta" }, [a]);
  const g = field("number", { label: "Gamma" }, [a, b]);
  const app = await open(doc([a, b, g]));
  await t.click(app.cards()[0]);
  await app.press("Delete");
  await app.press("Delete");
  const undos = app.qa('[role="status"] button').filter((x) => x.textContent.trim() === "Undo");
  expect(undos.length === 1, "stale Undo toasts should be withdrawn, found " + undos.length);
  await t.click(undos[0]);
  expect(app.saved().fields.map((f) => f.label).join("|") === "Beta|Gamma", "Undo restored the wrong change: " + app.saved().fields.map((f) => f.label).join("|"));
  await app.unmount();
});

test("an edit that changes nothing keeps the redo history", async () => {
  const app = await open();
  await t.click(app.toolboxItem("Short Text"));
  await t.click(app.undoButton());
  expect(!app.redoButton().disabled, "redo should be available");
  const dark = Array.from(app.qa('[role="radio"]')).find((r) => r.textContent.trim() === "Dark");
  await t.click(dark);
  expect(!app.redoButton().disabled, "clicking the active theme wiped the redo history");
  await app.unmount();
});

test("the field key can be typed with underscores and Escape cancels", async () => {
  const app = await open(doc([field("text", { label: "Name" })]));
  await t.click(app.cards()[0]);
  const input = app.q("#insp-key");
  input.focus();
  for (const text of ["f", "first", "first_", "first_name"]) await t.type(input, text);
  expect(input.value === "first_name", "the draft was rewritten while typing: " + input.value);
  await t.key(input, "Enter");
  expect(app.saved().fields[0].key === "first_name", "key not saved: " + app.saved().fields[0].key);
  input.focus();
  await t.type(input, "oops");
  await t.key(input, "Escape");
  expect(app.saved().fields[0].key === "first_name", "Escape saved the draft instead of cancelling");
  await app.unmount();
});

test("an untouched preview value follows the field's settings", async () => {
  const r = field("range", { label: "Budget" });
  const app = await open(doc([r, field("submit", {}, [r])]));
  await t.click(app.cards()[0]);
  const min = app.q('[data-setting="min"] input');
  await t.type(min, "50");
  await t.click(app.byText("Live preview"));
  const slider = app.q('main input[type="range"]');
  expect(slider && slider.value === "50", "preview slider stayed at " + (slider && slider.value));
  await app.unmount();
});

test("closing a dialog returns focus to the button that opened it", async () => {
  const app = await open();
  const opener = app.q('button[aria-label="Command palette"]');
  opener.focus();
  await t.click(opener);
  expect(app.dialog(), "palette did not open");
  await t.key(app.dialog(), "Escape");
  expect(window.document.activeElement === opener, "focus went to " + window.document.activeElement.tagName);
  await app.unmount();
});

test("Escape still closes a dialog after focus falls to the page", async () => {
  const app = await open();
  await app.press("?");
  window.document.body.focus();
  await app.press("Escape");
  expect(!app.dialog(), "the dialog ignored Escape");
  await app.unmount();
});

test("Enter on a selected card jumps to its label", async () => {
  const app = await open(doc([field("text")]));
  const card = app.cards()[0];
  card.focus();
  await t.key(card, "Enter");
  await t.key(card, "Enter");
  await t.wait(5);
  expect(window.document.activeElement && window.document.activeElement.id === "insp-label", "label not focused");
  await app.unmount();
});

test("double-clicking a card focuses its label in the Inspector", async () => {
  const app = await open(doc([field("text")]));
  await t.dblclick(app.cards()[0]);
  await t.wait(5);
  expect(window.document.activeElement && window.document.activeElement.id === "insp-label", "label input not focused");
  await app.unmount();
});

test("clicking a field key copies it", async () => {
  const a = field("email");
  const app = await open(doc([a]));
  clipboard.text = null;
  await t.click(app.q('button[title="Copy field key"]'));
  await t.wait(5);
  expect(clipboard.text === a.key, "key not copied");
  expect(app.toastText().indexOf(a.key) !== -1, "no copy toast");
  await app.unmount();
});

test("the code panel resizes from the keyboard", async () => {
  const app = await open(doc([field("text")]));
  const handle = app.q('[role="separator"]');
  const panel = handle.parentElement.querySelector("div[style]");
  const before = parseInt(panel.style.height, 10);
  await t.key(handle, "ArrowUp");
  expect(parseInt(panel.style.height, 10) === before + 32, "height did not grow by 32px");
  await app.unmount();
});

test("Escape in the search box clears it without deselecting", async () => {
  const app = await open(doc([field("text")]));
  await t.click(app.cards()[0]);
  await t.type(app.search(), "date");
  await t.key(app.search(), "Escape");
  expect(app.search().value === "", "search not cleared");
  expect(app.c.querySelector('main [aria-current="true"]'), "selection was lost");
  await app.unmount();
});

/* ---------------------------------------------------------------- run ---- */
const started = Date.now();
let passed = 0;
const selected = tests.filter((x) => !ONLY || x.name.indexOf(ONLY) !== -1);
console.log("\nFormcraft app suite — " + selected.length + " scenarios\n");
for (const { name, fn } of selected) {
  const log = [];
  let error = null;
  await withLog(log, async () => {
    try {
      await fn();
    } catch (err) {
      error = err instanceof Failure ? err.message : "crashed: " + (err && err.stack ? err.stack.split("\n").slice(0, 3).join(" | ") : err);
    }
  });
  window.localStorage.clear();
  const problems = (error ? [error] : []).concat(log.map((m) => "warning: " + m));
  if (!problems.length) {
    passed++;
    console.log("  ✓ " + name);
  } else {
    console.log("  ✗ " + name);
    problems.slice(0, 6).forEach((p) => console.log("      - " + p));
  }
}
stray.forEach((m) => console.log("  ! unattributed warning: " + m));
console.log("\n  " + passed + "/" + selected.length + " scenarios passed — " + ((Date.now() - started) / 1000).toFixed(1) + "s\n");
process.exit(passed === selected.length && !stray.length ? 0 : 1);

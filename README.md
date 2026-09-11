# Formcraft

A low-code visual form builder in a single React file. Drop elements on a canvas, shape them in
the inspector, test the result live, then export it as schema JSON or as a production-ready
React + Tailwind component in dark, light, or auto theme.

![status](https://img.shields.io/badge/status-working-brightgreen) ![deps](https://img.shields.io/badge/deps-react%20%7C%20tailwind%20%7C%20lucide-blue)

## Overview

<!-- OVERVIEW:START -->
Formcraft is a single-file React application for building forms visually and exporting them as JSON schemas or production-ready React + Tailwind components. It provides a complete low-code form builder in one portable file (`FormBuilder.jsx`).

**Features:**  
- 18 element types organized into Input (text, email, phone, URL, password, number), Choice (radio, checkbox, select, multi-select, toggle), Date & files (date, time, file upload, range slider), and Layout (heading, divider, spacer) groups  
- Drag-and-drop canvas with reordering, duplication, half/full width layout, and per-field inspector  
- Live preview with required-field validation and typed submit payloads  
- Theme-aware exporter supporting dark, light, and auto modes (with `dark:` variants) driven by a unified token system  
- Undo for delete and clear operations, plus autosave to localStorage with input sanitization  

**Usage:**  
Run `node tools/serve.mjs` to start a local dev server, then open `preview.html` in a browser. The build script (`tools/build-preview.mjs`) generates `preview.html` from `FormBuilder.jsx`.

**Dependencies:**  
React, Tailwind CSS, lucide-react
<!-- OVERVIEW:END -->

## Quick start

```bash
node tools/build-preview.mjs   # regenerate preview.html from the component
```

Then open `preview.html` in any browser — no install, no bundler, no dev server. To use the real
component in your own app:

```jsx
import FormBuilder from "./FormBuilder";

export default function App() {
  return <FormBuilder />;
}
```

Requires `react`, `tailwindcss` and `lucide-react`. Tailwind must scan the file
(`content: ["./src/**/*.{js,jsx}"]`). The three webfonts (Instrument Sans, IBM Plex Sans,
JetBrains Mono) are optional — the component falls back to the system UI stack.

## What it does

**18 elements, four groups.** Input: short text, long text, email, phone, website, password,
number, slider. Choice: dropdown, radio group, checkbox group, toggle. Date & files: date, time,
file upload. Layout: section heading, divider, submit button.

**Canvas.** Every element renders as the real styled control. Click to select, drag to reorder,
or use the arrow buttons. Duplicate and delete from the card toolbar. Half- or full-width per
field, on a two-column grid that matches the export exactly.

**Live preview.** The same form, fully interactive, with required-field validation and the
submitted payload shown as JSON — including the types your handler actually receives: booleans
for toggles, arrays for checkbox groups, numbers for sliders, `File` objects for uploads.

**Inspector.** Label, field key, placeholder, helper text, required toggle, width, per-type extras
(slider min/max/step, accepted file types), and a reorderable options editor for choice fields.
Field keys derive from the label until you override one, and are always unique, always valid JS
identifiers.

**Exporter.** Schema JSON or a React + Tailwind component, regenerating as you type, with a
theme switch:

| Theme | Emits |
| --- | --- |
| `dark` | dark palette classes |
| `light` | light palette classes |
| `auto` | light classes plus `dark:` variants, for apps with a dark mode |

One source of tokens drives the canvas, the preview and all three exports, so what you see is
what you copy. Copy-to-clipboard falls back to selecting the code if the browser refuses
clipboard access.

**Undo.** Deleting an element or clearing the canvas raises a toast with Undo; `Ctrl+Z` works too.

**Autosave.** The document persists to `localStorage` (`formcraft.document.v1`) and is
re-validated field by field on load, so corrupted or hand-edited storage can't break the app.

### Keyboard

| Key | Action |
| --- | --- |
| `Del` | delete the selected element |
| `Alt` + `↑` / `↓` | nudge the selected element |
| `Ctrl` / `⌘` + `Z` | undo the last delete or clear |
| `Esc` | deselect |

## Files

| File | What it is |
| --- | --- |
| `FormBuilder.jsx` | The deliverable. One self-contained component, no placeholders. |
| `preview.html` | Generated standalone page (React UMD + Babel + Tailwind Play CDN + a lucide icon shim). |
| `tools/build-preview.mjs` | Regenerates `preview.html` from the component. |
| `tools/serve.mjs` | Tiny static server for local QA (`PORT=5311 node tools/serve.mjs`). |

`preview.html` is generated — edit `FormBuilder.jsx` and rebuild rather than editing it directly.
The build copies the component source verbatim and only swaps the import statements for globals,
so the preview can't drift from the source.

## Verified

The exported component isn't just syntactically valid. With all 18 element types on the canvas it
was compiled with Babel, mounted into a live React root, and exercised — every control filled,
then submitted:

```json
{
  "full_name": "Ada Lovelace",
  "team_size": "42",
  "monthly_budget": 65,
  "plan": "Growth",
  "what_should_we_cover": ["Pricing", "Migration"],
  "subscribe_to_the_product_newsletter": true,
  "preferred_start_date": "2026-10-01",
  "attach_a_brief": null
}
```

Sliders return numbers, checkbox groups return arrays, toggles return booleans, and headings and
dividers contribute no keys at all. All three theme exports compile; empty required fields block
submission with per-field messages.

## Changelog

<!-- CHANGELOG:START -->
- **2026-09-11** — Add visual form builder with 18 element types, drag reorder, live preview, theme-aware export, and undo/autosave
<!-- CHANGELOG:END -->

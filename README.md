# Formcraft

A low-code visual form builder in a single React file. Pick from 68 elements, shape them in the
inspector, test the result live, then export it as schema JSON or as a production-ready
React + Tailwind component in dark, light or auto theme.

**Live:** https://formcraft-teal-alpha.vercel.app/preview.html

## Overview

<!-- OVERVIEW:START -->
Formcraft is a single-file React application (`FormBuilder.jsx`) for building forms visually and
exporting them as JSON schemas or standalone React + Tailwind components. It ships 68 element
types in nine groups, a live preview that behaves exactly like the export, undo/redo, a command
palette, templates, schema import and document checks. Every element is one self-contained
definition in a registry, verified by a headless test suite.
<!-- OVERVIEW:END -->

## Quick start

Use the component in your own app (needs `react`, `tailwindcss` and `lucide-react`):

```jsx
import FormBuilder from "./FormBuilder";

export default function App() {
  return <FormBuilder />;
}
```

Tailwind must scan the file (`content: ["./src/**/*.{js,jsx}"]`, Tailwind 3.4+). The webfonts
(Instrument Sans, IBM Plex Sans, JetBrains Mono) are optional; the UI falls back to system fonts.

To work on Formcraft itself:

```bash
npm --prefix tools install      # build + test tooling (kept out of the repo root)
npm --prefix tools test         # the element suite
node tools/test/app.mjs         # the app suite
npm --prefix tools run build    # regenerate preview.html
```

`preview.html` is the whole app as one static page, deployed as-is. Its JSX is compiled at build
time, so visitors download React from a CDN (with Subresource Integrity) and nothing else heavy.

## What it does

**68 elements in nine groups.** Text, Contact, Numbers, Choice, Scales, Date & time, Files & media,
Layout and Advanced — from short text and dropdowns to star ratings, NPS, matrix grids, OTP code
boxes, tag inputs, address blocks, signature pads and drop zones. The full catalogue is below.

**Canvas.** Every element renders as its real control. New elements land after the selected one.
Drag to reorder, or use the card toolbar to move, duplicate, delete or mark as required.
Double-click a card to rename it. Click a field key to copy it.

**Live preview.** The same form, fully interactive, with required and format validation (email,
URL, phone, number ranges, JSON, matching passwords…) and the typed payload your `onSubmit`
receives — numbers for sliders, arrays for multi-choice, objects for compound fields, `File`
objects for uploads.

**Inspector.** Generated from each element's settings: labels, keys, placeholders, helper text,
widths, required, and per-element options such as rating size, currency symbol, accepted file
types, matrix rows and columns, or callout tone.

**Exporter.** Schema JSON or a React + Tailwind component, regenerated as you type, with syntax
highlighting, line numbers, a resizable panel, copy and download. The theme switch emits dark,
light, or light-plus-`dark:` variants from one token set that also drives the preview — so what
you see is what you copy. Any text you type (quotes, `&`, `<tags>`, line breaks) survives the
export exactly.

**Productivity.**

| | |
| --- | --- |
| Command palette | `Ctrl/⌘ K` — add any element, jump to a field, run any action |
| Templates | Seven ready forms: demo request, contact, RSVP, feedback, job application, bug report, sign-up |
| Import | Paste or open a schema JSON; errors point at the line and column |
| Form checks | Missing submit button, unlabelled fields, empty or duplicate options — click one to fix it |
| Undo / redo | Every change, with typing grouped into single steps (`Ctrl/⌘ Z`, `Ctrl/⌘ Shift Z`) |
| Toolbox search | `/` to search 68 elements; `Enter` adds the first match |
| Autosave | The document and your view preferences persist in `localStorage` |

### Keyboard

| Key | Action |
| --- | --- |
| `Ctrl/⌘ K` | Command palette |
| `/` | Search elements |
| `?` | Shortcut sheet |
| `↑` / `↓` | Select the previous / next element |
| `Alt` + `↑` / `↓` | Move the selected element |
| `Ctrl/⌘ D` | Duplicate |
| `Enter` | Edit the selected element's label |
| `Del` | Delete (with Undo) |
| `Esc` | Deselect |

## How it's built

Every element is one `defineType({...})` definition that owns its builder rendering (`render`),
its exported code (`emit`), its value, validation and Inspector settings. The rest of the app
never switches on element type. The contract is documented at the top of section 2 of
`FormBuilder.jsx`; the 18 original elements are the worked examples.

Adding an element is: write a definition, run the suite, done. The suite enforces that preview
and export stay identical, so a new element can't quietly drift.

| File | What it is |
| --- | --- |
| `FormBuilder.jsx` | The deliverable: one self-contained component. |
| `preview.html` | Generated standalone page — the live site. |
| `tools/assemble.mjs` | Recomputes the icon and React imports from what the file actually uses (Babel scope analysis) and splices in new element files. |
| `tools/build-preview.mjs` | Builds `preview.html`: compiles the JSX and inlines the exact lucide icons used. |
| `tools/test/run.mjs` | Element suite (below). |
| `tools/test/app.mjs` | App suite: drives the builder UI like a person would. |
| `tools/docs.mjs` | Prints the element catalogue from the registry. |

## Testing

The **element suite** checks every element — 2,987 checks across 68 elements, headless in jsdom:
registry lint; save/load and schema round-trips; rendering in both themes and on the canvas; the
export compiling in all three themes; the exported form blocking an empty required submit and
delivering a filled value; **markup parity** between preview and export (class tokens and
element counts, normal and error state); accessibility wiring (labels, `aria-describedby`,
`aria-labelledby`); **hostile text** (quotes, entities, markup and line breaks in every label,
option and setting must survive the export unchanged); the real app's live preview; editing every
Inspector setting; and zero React warnings throughout.

The **app suite** runs 36 scenarios through the builder UI: search, insertion, undo/redo and its
edge cases, keyboard shortcuts and focus management, the command palette, templates, import,
form checks, the code panel and saved preferences — plus regression tests for every bug found in
review.

## Element catalogue

### Text (10)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **Short Text** `text` | Single-line input | string | Placeholder |
| **Long Text** `textarea` | Multi-line textarea | string | Placeholder, Rows |
| **Password** `password` | Masked input | string | Placeholder, Minimum length |
| **Search** `search` | Search box with icon | string | Placeholder |
| **Username** `username` | Handle with @ prefix | string | Prefix, Placeholder |
| **URL Slug** `slug` | Lowercase web address | string | Prefix, Placeholder |
| **Limited Text** `counted` | Textarea with a counter | string | Placeholder, Rows, Character limit |
| **Code / JSON** `code` | Monospace snippet input | string | Language, Rows, Placeholder |
| **Verification Code** `otp` | One-time code boxes | string | Digits |
| **Tag Input** `tags` | Free-form list of tags | array | Placeholder, Max tags |

### Contact (9)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **Email** `email` | Validated address | string | Placeholder |
| **Phone** `tel` | Telephone number | string | Placeholder |
| **Website** `url` | Link input | string | Placeholder |
| **Full Name** `fullname` | First and last name | `{ first, last }` | First name label, First placeholder, Last name label, Last placeholder |
| **Address** `address` | Postal address block | `{ street, line2, city, postal, country }` | Apartment, suite line, Street label, Line 2 label, City label, Postal code label, Country label, Country placeholder |
| **Phone + Country Code** `phoneIntl` | Dial code and number | `{ code, number }` | Default code, Placeholder |
| **Country** `country` | All 249 countries, A–Z | string | Empty state text, Preselected |
| **Language** `language` | Preferred language | string | Empty state text, Preselected |
| **Time Zone** `timezone` | Auto-detected local zone | string | Preselect the visitor's zone, Empty state text |

### Numbers (7)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **Number** `number` | Numeric input | string | Placeholder, Minimum, Maximum |
| **Slider** `range` | Bounded number | number | Minimum, Maximum, Step |
| **Money Amount** `currency` | Amount with currency | string | Placeholder, Symbol, Currency code |
| **Percentage** `percent` | Number with a % sign | string | Placeholder, Minimum, Maximum |
| **Quantity Stepper** `stepper` | Minus and plus buttons | number | Minimum, Maximum, Step |
| **Measurement** `measure` | Number with a unit | `{ amount, unit }` | Placeholder, Units |
| **Number Range** `numberRange` | From and to values | `{ from, to }` | Prefix, Minimum, Maximum, From label, To label |

### Choice (13)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **Dropdown** `select` | Single choice list | string | Empty state text, Options |
| **Radio Group** `radio` | One of many | string | Options |
| **Checkbox Group** `checkboxes` | Many of many | array | Options |
| **Toggle** `checkbox` | Single boolean | boolean | — |
| **Multi-select List** `multiselect` | Pick several from a list | array | Options |
| **Button Group** `buttons` | Segmented single choice | string | Options |
| **Chip Select** `chips` | Toggleable pills | array | Max selections, Options |
| **Yes / No** `yesno` | Two-button answer | string | Yes label, No label |
| **Card Choice** `cardChoice` | Selectable cards | string | Cards (title | description) |
| **Autocomplete** `combobox` | Text with suggestions | string | Placeholder, Only allow listed values, Suggestions |
| **Consent Checkbox** `consent` | Agree to terms | boolean | Text, Link text, Link URL |
| **Rank Order** `ranking` | Order items by priority | array | Items |
| **Color Swatches** `swatches` | Pick a preset color | string | Colors (name | hex) |

### Scales (5)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **Star Rating** `rating` | Clickable star score | value or `null` | Stars |
| **NPS Score** `nps` | 0–10 likelihood score | value or `null` | Low label, High label |
| **Likert Scale** `likert` | Agree–disagree scale | string | Points |
| **Emoji Reaction** `emoji` | Five-face sentiment | string | — |
| **Matrix Grid** `matrix` | Rate rows on one scale | `{ Ease of use, Performance, Documentation }` | Rows, Columns |

### Date & time (8)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **Date** `date` | Calendar value | string | — |
| **Time** `time` | Clock value | string | — |
| **Date & Time** `datetime` | Date plus clock time | string | Earliest, Latest |
| **Month** `month` | Month and year | string | — |
| **Week** `week` | ISO week of a year | string | — |
| **Date Range** `dateRange` | Start and end dates | `{ start, end }` | Start label, End label |
| **Duration** `duration` | Hours and minutes | `{ hours, minutes }` | — |
| **Year** `year` | Four-digit year | string | Placeholder, Earliest, Latest |

### Files & media (5)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **File Upload** `file` | Attachment picker | File | Accepted types |
| **Image Upload** `image` | Photo with live preview | File | Accepted types, Button text |
| **Multiple Files** `multifile` | Several attachments | array | Accepted types, Maximum files |
| **Drop Zone** `dropzone` | Drag-and-drop upload | File | Accepted types |
| **Signature Pad** `signature` | Draw to sign | string | Hint |

### Layout (8)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **Section Heading** `heading` | Groups the fields below | — | — |
| **Divider** `divider` | Horizontal rule | — | — |
| **Submit Button** `submit` | Ends the form | — | — |
| **Text Block** `paragraph` | Explanatory copy | — | Text, Size |
| **Callout** `callout` | Tinted notice box | — | Tone, Title, Text |
| **Spacer** `spacer` | Vertical breathing room | — | Height |
| **Image** `imageBlock` | Static picture | — | Image URL, Alt text, Caption |
| **Reset Button** `reset` | Clears every field | — | — |

### Advanced (3)

| Element | What it is | Value | Settings |
| --- | --- | --- | --- |
| **Color Picker** `color` | Hex color with swatch | string | Default color |
| **Hidden Value** `hidden` | Invisible tracking data | string | Value |
| **Password + Confirm** `passwordConfirm` | New password, typed twice | `{ password, confirm }` | Minimum length, Password label, Confirm label |


## Changelog

<!-- CHANGELOG:START -->
- **2026-09-11** — Add visual form builder with 18 element types, drag reorder, live preview, theme-aware export, and undo/autosave
<!-- CHANGELOG:END -->

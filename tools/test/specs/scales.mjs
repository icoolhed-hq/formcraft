/**
 * Fill specs for the "Scales & files" family. Besides filling each control,
 * they exercise the paths the generic filler never touches: arrow keys on
 * radio-button scales, append + de-duplicate + remove on Multiple Files, the
 * drop path of the Drop Zone, and pointer drawing on the Signature Pad.
 */

const radios = (cell) => Array.from(cell.querySelectorAll('[role="radio"]'));
const fileInput = (cell) => cell.querySelector('input[type="file"]');
/** Removing a file must hand focus back to the picker, not drop it on <body>. */
function expectPickerFocused(cell) {
  if (cell.ownerDocument.activeElement !== fileInput(cell)) throw new Error("focus did not return to the file input after Remove");
}
const button = (cell, text) => Array.from(cell.querySelectorAll("button")).find((b) => b.textContent.trim() === text);

/** A drop event carrying files, the way a browser delivers one. */
function dropEvent(t, type, files) {
  const event = new t.window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files, types: ["Files"], dropEffect: "none" } });
  return event;
}

export default {
  rating: {
    async fill(cell, t) {
      const stars = radios(cell);
      await t.click(stars[2]);
      await t.key(stars[2], "ArrowRight");
    },
    expect: (value) => value === 4,
  },

  nps: {
    async fill(cell, t) {
      const scores = radios(cell);
      await t.click(scores[9]);
      await t.key(scores[9], "ArrowLeft");
    },
    expect: (value) => value === 8,
  },

  emoji: {
    async fill(cell, t) {
      const faces = radios(cell);
      await t.click(faces[1]);
      await t.key(faces[1], "End");
    },
    expect: (value) => value === "Love it",
  },

  likert: {
    async fill(cell, t) {
      const agree = cell.querySelector('input[type="radio"][value="Agree"]');
      await t.click(agree);
    },
    expect: (value) => value === "Agree",
  },

  matrix: {
    async fill(cell, t) {
      const rows = cell.querySelectorAll("tbody tr");
      for (const row of Array.from(rows)) {
        const choices = row.querySelectorAll('input[type="radio"]');
        await t.click(choices[choices.length - 1]);
      }
    },
    expect: (value) => Object.keys(value).length === 3 && Object.values(value).every((answer) => answer === "Great"),
  },

  image: {
    async fill(cell, t) {
      await t.setFiles(fileInput(cell), [t.file("avatar.png", "image/png")]);
    },
    expect: (value) => Boolean(value) && value.name === "avatar.png" && value.type === "image/png",
  },

  multifile: {
    async fill(cell, t) {
      await t.setFiles(fileInput(cell), [t.file("brief.pdf"), t.file("budget.pdf")]);
      /* Picking again appends and skips the duplicate budget.pdf. */
      await t.setFiles(fileInput(cell), [t.file("budget.pdf"), t.file("timeline.pdf")]);
      await t.click(cell.querySelector('button[aria-label="Remove brief.pdf"]'));
      expectPickerFocused(cell);
    },
    expect: (value) => Array.isArray(value) && value.map((file) => file.name).join(",") === "budget.pdf,timeline.pdf",
  },

  dropzone: {
    async fill(cell, t) {
      /* Pick a file, remove it, then drop another one on the zone. */
      await t.setFiles(fileInput(cell), [t.file("old-statement.pdf")]);
      await t.click(button(cell, "Remove"));
      expectPickerFocused(cell);
      const zone = cell.querySelector('input[type="file"] ~ label');
      const scan = t.file("bank-statement.png", "image/png");
      await t.dispatch(zone, dropEvent(t, "dragover", [scan]));
      await t.dispatch(zone, dropEvent(t, "drop", [scan]));
    },
    expect: (value) => Boolean(value) && value.name === "bank-statement.png",
  },

  signature: {
    async fill(cell, t) {
      const canvas = cell.querySelector("canvas");
      await t.pointer(canvas, "pointerdown", { clientX: 12, clientY: 40 });
      await t.pointer(canvas, "pointermove", { clientX: 30, clientY: 28 });
      await t.pointer(canvas, "pointermove", { clientX: 52, clientY: 44 });
      await t.pointer(canvas, "pointerup", { clientX: 52, clientY: 44 });
    },
    expect: (value) => typeof value === "string" && value.startsWith("data:image/png"),
  },
};

/**
 * Fill specs for the Choice family. Where the generic filler would work,
 * these still drive the controls the way a person would (keyboard included),
 * so the preview and the export are checked for the same behaviour.
 */
const radios = (cell) => Array.from(cell.querySelectorAll('[role="radio"]'));

export default {
  multiselect: {
    expect: (value) => Array.isArray(value) && value.length === 1 && value[0] === "Design",
  },

  /* Click the first option, then End jumps to (and selects) the last one. */
  buttons: {
    async fill(cell, t) {
      const [first] = radios(cell);
      await t.click(first);
      await t.key(first, "End");
    },
    expect: (value) => value === "Yearly",
  },

  /* Toggle a chip on and off again, then pick another one. */
  chips: {
    async fill(cell, t) {
      const chips = Array.from(cell.querySelectorAll("button[aria-pressed]"));
      await t.click(chips[0]);
      await t.click(chips[4]);
      await t.click(chips[0]);
    },
    expect: (value) => Array.isArray(value) && value.length === 1 && value[0] === "Contract",
  },

  /* Answer "Yes", then ArrowRight moves the answer to "No". */
  yesno: {
    async fill(cell, t) {
      const [yes] = radios(cell);
      await t.click(yes);
      await t.key(yes, "ArrowRight");
    },
    expect: (value) => value === "no",
  },

  cardChoice: {
    expect: (value) => value === "Starter",
  },

  consent: {
    expect: (value) => value === true,
  },

  /* Move the first item down: the order changes and nothing else, the live
     region announces the new position and keyboard focus follows the item. */
  ranking: {
    async fill(cell, t) {
      /* In the app step the suite submits once before filling; an always-filled
         field passes that submit, the preview swaps to its "submitted" panel and
         this cell is detached, so there is nothing left to drive. */
      if (!cell.isConnected) return;
      const down = cell.querySelector('button[aria-label="Move Price down"]');
      down.focus();
      await t.click(down);
      const live = cell.querySelector('[aria-live="polite"]');
      const said = live ? live.textContent : "(no live region)";
      if (said !== "Price moved to position 2 of 4") throw new Error("ranking: live region said " + JSON.stringify(said));
      const focused = cell.ownerDocument.activeElement;
      if (!focused || focused.getAttribute("aria-label") !== "Move Price down") {
        throw new Error("ranking: focus did not follow the moved item");
      }
    },
    expect: (value) =>
      Array.isArray(value) && value.join(",") === "Speed,Price,Support,Integrations",
  },

  /* Pick the first swatch, then ArrowLeft wraps round to the last one. */
  swatches: {
    async fill(cell, t) {
      const [first] = radios(cell);
      await t.click(first);
      await t.key(first, "ArrowLeft");
    },
    expect: (value) => value === "#475569",
  },
};

/**
 * Fill specs for the Text inputs family (tools/.work/types/text.jsx).
 * Each fill runs against both the exported component and the app's Live preview.
 */
export default {
  /* "Sample value" has a space, which a username may not contain. */
  username: {
    async fill(cell, t) {
      await t.type(cell.querySelector("input"), "jane_doe");
    },
    expect: (value) => value === "jane_doe",
  },

  /* Exercises the as-you-type normalisation (case, accents, spaces, symbols). */
  slug: {
    async fill(cell, t) {
      await t.type(cell.querySelector("input"), "  Café Launch -- 2026!!x");
    },
    expect: (value) => value === "cafe-launch-2026-x",
  },

  /* The default language is JSON, so the filler's plain text would not validate. */
  code: {
    async fill(cell, t) {
      await t.type(cell.querySelector("textarea"), '{\n  "plan": "growth",\n  "seats": 12\n}');
    },
    expect: (value) => JSON.parse(value).seats === 12,
  },

  /* Pasting a formatted code into the first box fills every box with its digits. */
  otp: {
    async fill(cell, t) {
      const first = cell.querySelector("input");
      const event = new t.window.Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: { getData: () => "Your code: 482-913" } });
      await t.dispatch(first, event);
    },
    expect: (value) => value === "482913",
  },

  /* Enter adds the draft, a comma adds what precedes it, duplicates are ignored. */
  tags: {
    async fill(cell, t) {
      const input = () => cell.querySelector("input");
      await t.type(input(), "Design");
      await t.key(input(), "Enter");
      await t.type(input(), "Research, design,Ops");
      await t.key(input(), "Enter");
    },
    expect: (value) => JSON.stringify(value) === JSON.stringify(["Design", "Research", "Ops"]),
  },
};

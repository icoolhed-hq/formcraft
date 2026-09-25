/**
 * Fill specs for the "Numbers & advanced" family.
 */
export default {
  color: {
    /* Type a bare lowercase hex, then leave the field: blur tidies it to "#0EA5E9". */
    async fill(cell, t) {
      const input = cell.querySelector('input[type="text"]');
      await t.type(input, "0ea5e9");
      await t.dispatch(input, new t.window.FocusEvent("focusout", { bubbles: true }));
    },
    expect: (value) => value === "#0EA5E9",
  },
  hidden: {
    /* Nothing to type: the value comes from the element's settings. */
    async fill() {},
    expect: (value) => value === "spring-campaign",
  },
};

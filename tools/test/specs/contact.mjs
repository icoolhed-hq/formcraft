/**
 * Contact & identity specs.
 *
 * All six types use the generic filler; `expect` pins the submitted value's shape.
 *
 * phoneIntl: the generic filler picks the last dial code and then types the
 * international sample "+46 70 123 45 67" into the number box — which must
 * move "+46" into the code picker and keep the national part as the number.
 */
const keys = (value) => (value && typeof value === "object" ? Object.keys(value).sort().join(",") : "");

export default {
  fullname: {
    expect(value) {
      return keys(value) === "first,last" && value.first === "Sample value" && value.last === "Sample value";
    },
  },
  address: {
    /* includeLine2 is off by default, so line2 is present but empty. */
    expect(value) {
      return (
        keys(value) === "city,country,line2,postal,street" &&
        value.line2 === "" &&
        ["street", "city", "postal", "country"].every((part) => value[part] === "Sample value")
      );
    },
  },
  phoneIntl: {
    expect(value) {
      return keys(value) === "code,number" && value.code === "+46" && value.number === "70 123 45 67";
    },
  },
  country: {
    expect(value) {
      return typeof value === "string" && /^[A-Z]{2}$/.test(value);
    },
  },
  language: {
    expect(value) {
      return typeof value === "string" && /^[a-z]{2,3}$/.test(value);
    },
  },
  timezone: {
    expect(value) {
      return typeof value === "string" && (value === "UTC" || value.indexOf("/") !== -1);
    },
  },
};

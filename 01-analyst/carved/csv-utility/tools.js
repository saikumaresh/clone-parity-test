// CARVED from dist/utility.js lines 634763-634852 (src/lib/data/tools.ts)
const import_lodash58 = { default: require("lodash") };
const utilityLogger_default = { scope: () => console };
const { friendlyJsonObject, stringifyWithBigInt } = require("./helpers.js");
var log53 = utilityLogger_default.scope("data/tools");
function dec28bits(num) {
  return ("00000000" + num.toString(2)).slice(-8);
}
var Mutators = {
  resolveTabulatorMutator(dataType, dialect) {
    const mutator = this.resolveDataMutator(dataType, dialect, true);
    return (v) => mutator(v, true);
  },
  resolveDataMutator(dataType, dialect, mutateJSON = false) {
    if (dataType && dataType === "bit(1)") {
      return this.bit1Mutator.bind(this);
    }
    if (dataType && dataType.startsWith("bit")) {
      return this.bitMutator.bind(this, dialect);
    }
    if (dataType && dataType.startsWith("json") && mutateJSON) {
      return this.jsonMutator.bind(this);
    }
    return this.genericMutator.bind(this);
  },
  mutateRow(row, dataTypes2 = [], preserveComplex = false, dialect) {
    if (import_lodash58.default.isObject(row)) {
      row = Object.values(row);
    }
    return row.map((item, index) => {
      const typ = dataTypes2[index];
      const mutator = this.resolveDataMutator(typ, dialect);
      return mutator(item, preserveComplex);
    });
  },
  /**
   * Mutate database data to make it json-friendly
   * This is particularly useful for binary-type data
   * This is given
   * @param  {any} value
   * @returns JsonFriendly
   */
  genericMutator(value, preserveComplex = false) {
    const mutate = Mutators.genericMutator;
    if (ArrayBuffer.isView(value)) {
      return value;
    }
    if (typeof value === "bigint") return Number(value);
    if (import_lodash58.default.isDate(value)) return value.toISOString();
    if (import_lodash58.default.isArray(value)) return preserveComplex ? value.map((v) => mutate(v, preserveComplex)) : stringifyWithBigInt(value);
    if (import_lodash58.default.isObject(value)) return preserveComplex ? import_lodash58.default.mapValues(value, (v) => mutate(v, preserveComplex)) : stringifyWithBigInt(value);
    if (import_lodash58.default.isBoolean(value)) return value;
    return value;
  },
  /**
   * Convert bit(1) data to a number for use in UIs and JSON.
   * Typically Bit1 data is like a true/false flag.
   * @param  {any} value
   * @returns JsonFriendly
   */
  bit1Mutator(value) {
    if (!value) return 0;
    if (import_lodash58.default.isNumber(value)) return value;
    return Number(value[0]);
  },
  /**
   * Stringify bit data for use in json / UIs
   * @param {Dialect} dialect: The database dialect being used (must be first because the function is called via bind)
   * @param  {any} value
   * @returns JsonFriendly
   */
  bitMutator(dialect, value) {
    if (!value) return value;
    if (dialect && dialect === "sqlserver") return value;
    if (import_lodash58.default.isString(value)) return value;
    const result3 = [];
    for (let index = 0; index < value.length; index++) {
      result3.push(value[index]);
    }
    return `b'${result3.map((d6) => dec28bits(d6)).join("")}'`;
  },
  /** Stringify json data for MySQL column */
  jsonMutator(value) {
    if (!import_lodash58.default.isObject(value)) return value;
    try {
      return friendlyJsonObject(value);
    } catch (e7) {
      log53.debug(`error stringifying json: ${e7}`, value);
      return value;
    }
  }
};
module.exports = { Mutators };

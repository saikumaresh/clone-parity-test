// Supplementary probes (NOT part of the 18-case dataset). Same harness, different inputs.
export const cases = [
  { id: "p_invalid_bytes", columns: [{ columnName: "bin", dataType: "bytea" }], rows: [[Buffer.from([0xff, 0x00, 0x41])]] },
  { id: "p_invalid_date", columns: [{ columnName: "ts", dataType: "timestamp" }], rows: [[new Date("nope")]] },
  { id: "p_dup_columns", columns: [{ columnName: "a", dataType: "text" }, { columnName: "a", dataType: "text" }], rows: [["1", "2"]] },
  { id: "p_bool_in_bit", columns: [{ columnName: "f", dataType: "bit(1)" }, { columnName: "g", dataType: "bit varying" }], rows: [[true, true], [false, "101"]] },
  { id: "p_empty_delim", delimiter: "", columns: [{ columnName: "a", dataType: "text" }, { columnName: "b", dataType: "text" }], rows: [["x,y", "z"]] },
  { id: "p_multi_delim", delimiter: "||", columns: [{ columnName: "a", dataType: "text" }, { columnName: "b", dataType: "text" }], rows: [["x|y", "z||w"]] },
  { id: "p_tab_delim", delimiter: "\t", columns: [{ columnName: "a", dataType: "text" }, { columnName: "b", dataType: "text" }], rows: [["x\ty", " z"]] },
  { id: "p_query_empty", fromQuery: true, columns: [{ columnName: "a", dataType: "text" }], rows: [] },
  { id: "p_150_rows", columns: [{ columnName: "i", dataType: "integer" }], rows: Array.from({ length: 150 }, (_, i) => [i]) },
  { id: "p_nested_array", columns: [{ columnName: "arr", dataType: "integer[]" }], rows: [[[1, [2, 3n]]], [[null]]] },
  { id: "p_symbol_fn", columns: [{ columnName: "o", dataType: "text" }], rows: [[{ toString() { return "custom"; } }]] },
];
